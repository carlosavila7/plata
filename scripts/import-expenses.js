#!/usr/bin/env node
/**
 * Focused importer — reads finance/credit-card-statements/*.md and finance/out/*.md
 * and inserts them into the database via the running API.
 *
 * Usage:
 *   node import-expenses.js --source ../finance --api http://localhost:3000 [--force]
 *
 * Steps:
 *   1. Ensure the 4 canonical accounts exist (seed any missing via POST /accounts)
 *   2. Import credit-card statements → build slug → id map
 *   3. Preflight: abort if expenses already exist (unless --force)
 *   4. Import expenses (out/*.md), linking credit expenses to statements
 */

import { readFileSync } from 'fs'
import { glob } from 'glob'
import matter from 'gray-matter'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
  .option('source',   { type: 'string', demandOption: true,  describe: 'Path to finance/ directory' })
  .option('api',      { type: 'string', demandOption: true,  describe: 'API base URL' })
  .option('email',    { type: 'string', demandOption: true,  describe: 'User email' })
  .option('password', { type: 'string', demandOption: true,  describe: 'User password' })
  .option('force',    { type: 'boolean', default: false,     describe: 'Import even if expenses already exist' })
  .parseSync()

const SOURCE = argv.source
const API    = argv.api.replace(/\/$/, '')

// ── Auth ─────────────────────────────────────────────────────────────────────

let token = null

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const { accessToken } = await res.json()
  token = accessToken
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${endpoint} → ${res.status}: ${text}`)
  }
  return res.status === 204 ? null : res.json()
}

function readMd(file) {
  return matter(readFileSync(file, 'utf8')).data
}

/** A YAML value that may be a JS Date, a string, or empty → 'YYYY-MM-DD' or null. */
function ymd(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Convert a YYMMDD filename segment → 'YYYY-MM-DD'. */
function yymmdd(s) {
  if (!/^\d{6}$/.test(String(s ?? ''))) return null
  const str = String(s)
  return `20${str.slice(0, 2)}-${str.slice(2, 4)}-${str.slice(4, 6)}`
}

/**
 * Build occurredAt from the filename's date (YYMMDD) + time (HHMM), anchored to
 * Brasília (UTC-3). The filename is the source of truth: unquoted `time:` values
 * like 12:37 are mis-parsed by YAML as sexagesimal numbers, so we never trust them.
 */
function isoBRT(dateSeg, timeSeg) {
  const d = yymmdd(dateSeg)
  if (!d) return null
  const t = String(timeSeg ?? '').replace(/[^0-9]/g, '').padStart(4, '0').slice(0, 4)
  const hh = t.slice(0, 2), mm = t.slice(2, 4)
  if (Number(hh) > 23 || Number(mm) > 59) return null
  return `${d}T${hh}:${mm}:00-03:00`
}

/** Empty string / null / undefined → null; otherwise the trimmed string. */
function orNull(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Trim and capitalize the first letter; empty → null. */
function capitalizeFirst(v) {
  const s = orNull(v)
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null
}

function cents(v) {
  return Math.round((Number(v) || 0) * 100)
}

function normalizePaymentType(p) {
  const map = {
    debt: 'debit', debit: 'debit', credit: 'credit', pix: 'pix',
    'food voucher': 'food_voucher', 'meal voucher': 'meal_voucher',
    food_voucher: 'food_voucher', meal_voucher: 'meal_voucher',
  }
  return map[String(p ?? '').toLowerCase().trim()] ?? 'debit'
}

// ── Step 1: Accounts ──────────────────────────────────────────────────────────

const CANONICAL_ACCOUNTS = [
  { name: 'Banco do Brasil', type: 'checking', institution: 'Banco do Brasil' },
  { name: 'Bradesco',        type: 'checking', institution: 'Bradesco' },
  { name: 'Banco Inter',     type: 'checking', institution: 'Banco Inter' },
  { name: 'Meal Voucher',    type: 'voucher',  institution: 'Alelo' },
  { name: 'Food Voucher',    type: 'voucher',  institution: 'Alelo' },
]

async function ensureAccounts() {
  console.log('\n[1/4] Accounts…')
  const existing = await api('GET', '/accounts')
  const byName = Object.fromEntries(existing.map(a => [a.name, a]))
  for (const acc of CANONICAL_ACCOUNTS) {
    if (!byName[acc.name]) {
      byName[acc.name] = await api('POST', '/accounts', acc)
      console.log(`  Created account: ${acc.name}`)
    }
  }
  console.log(`  ${Object.keys(byName).length} accounts ready.`)
  return byName
}

// ── Step 2: Credit-card statements ────────────────────────────────────────────

async function importStatements() {
  console.log('\n[2/4] Credit-card statements…')
  const files = (await glob(`${SOURCE}/credit-card-statements/*.md`)).sort()
  // Idempotency: an existing statement is identified by nickname + openDate.
  const existing = await api('GET', '/credit-card-statements')
  const existingByKey = new Map(existing.map(s => [`${s.nickname}|${s.openDate}`, s.id]))
  const bySlug = new Map() // filename slug → statement id
  let createdCount = 0
  for (const file of files) {
    const fm = readMd(file)
    const slug = path.basename(file, '.md')
    const openDate  = ymd(fm['open-date'])
    const closeDate = ymd(fm['close-date'])
    const dueDate   = ymd(fm['due-date'])
    if (!openDate || !closeDate || !dueDate) {
      console.warn(`  Warning: ${slug} missing/invalid dates — skipped`)
      continue
    }
    const nickname = String(fm['card-name'] ?? 'Unknown')
    const key = `${nickname}|${openDate}`
    if (existingByKey.has(key)) {
      bySlug.set(slug, existingByKey.get(key))
      continue
    }
    const record = await api('POST', '/credit-card-statements', {
      bank:       String(fm.bank ?? 'Unknown'),
      nickname,
      network:    String(fm.network ?? 'Unknown'),
      openDate, closeDate, dueDate,
      status:     ['open', 'closed', 'paid'].includes(fm.status) ? fm.status : 'paid',
      totalCents: fm.value != null ? cents(fm.value) : null,
    })
    existingByKey.set(key, record.id)
    bySlug.set(slug, record.id)
    createdCount++
  }
  console.log(`  ${bySlug.size} statements ready (${createdCount} created, ${bySlug.size - createdCount} already existed).`)
  return bySlug
}

// ── Step 4: Expenses ──────────────────────────────────────────────────────────

async function importExpenses(accountsByName, statementsBySlug) {
  console.log('\n[4/4] Expenses…')
  const files = (await glob(`${SOURCE}/out/*.md`)).sort()
  let created = 0
  const skipped = []          // { name, reason }
  const missingStatements = new Map() // slug → count

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    // filename: E-{YYMMDD}-{HHMM}-{CATSUBCAT}-{ORIGIN}-{PERSON}-{RECURRENT}-{ID}
    const parts = name.split('-')

    const when = isoBRT(parts[1], parts[2])
    if (!when) { skipped.push({ name, reason: 'invalid date/time in filename' }); continue }

    const costCents = cents(fm.cost)
    if (costCents <= 0) { skipped.push({ name, reason: 'missing/zero cost' }); continue }

    const category    = String(fm.category ?? 'other').trim()
    const subCategory = String(fm['sub-category'] ?? 'other').trim() || 'other'
    const paymentType = normalizePaymentType(fm['payment-type'])

    // Origin → account. A "Voucher" origin is split into Meal/Food Voucher by payment type.
    const origin = String(fm.origin ?? '').trim()
    const account = origin.toLowerCase() === 'voucher'
      ? accountsByName[paymentType === 'food_voucher' ? 'Food Voucher'
                     : paymentType === 'meal_voucher' ? 'Meal Voucher'
                     : '']
      : accountsByName[origin]
    if (!account) { skipped.push({ name, reason: `unresolved origin "${fm.origin}"` }); continue }

    let creditCardStatementId = null
    if (paymentType === 'credit') {
      const slug = orNull(fm['credit-card-statement'])
      if (slug) {
        creditCardStatementId = statementsBySlug.get(slug) ?? null
        if (!creditCardStatementId) {
          missingStatements.set(slug, (missingStatements.get(slug) ?? 0) + 1)
        }
      }
    }

    let fuelDetails = null
    if (subCategory.toLowerCase() === 'fuel') {
      const odo = Number(fm['odometer-reading'])
      fuelDetails = {
        fullTank:           Boolean(fm['full-fuel']),
        odometerKm:         Number.isFinite(odo) && odo > 0 ? odo : null,
        pricePerLiterCents: cents(fm['fuel-price']),
      }
    }

    await api('POST', '/expenses', {
      occurredAt:  when,
      category,
      subCategory,
      costCents,
      accountId:   account.id,
      paymentType,
      creditCardStatementId,
      boughtAt:    capitalizeFirst(fm['bought-at']),
      city:        orNull(fm.city),
      description: orNull(fm.description),
      groupingTag: orNull(fm['grouping-tag']),
      isRecurrent: Boolean(fm['is-recurrent']),
      person:      orNull(fm.person),
      isDelivery:  category === 'food' ? Boolean(fm['is-delivery']) : null,
      fuelDetails,
    })
    created++
  }

  console.log(`\n  Created ${created} expenses. Skipped ${skipped.length}.`)
  if (skipped.length) {
    const byReason = {}
    for (const s of skipped) byReason[s.reason] = (byReason[s.reason] ?? 0) + 1
    console.log('  Skipped by reason:')
    for (const [reason, count] of Object.entries(byReason)) console.log(`    ${count}× ${reason}`)
  }
  if (missingStatements.size) {
    console.log('  Credit expenses referencing an unknown statement slug (left unlinked):')
    for (const [slug, count] of missingStatements) console.log(`    ${count}× ${slug}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Source: ${SOURCE}`)
  console.log(`API:    ${API}`)

  await login(argv.email, argv.password)

  const accountsByName = await ensureAccounts()
  const statementsBySlug = await importStatements()

  console.log('\n[3/4] Preflight…')
  const existing = await api('GET', '/expenses')
  if (existing.length > 0 && !argv.force) {
    console.error(`  Aborting: ${existing.length} expenses already exist. Re-run with --force to import anyway.`)
    process.exit(1)
  }
  console.log(`  ${existing.length} existing expenses (proceeding${argv.force ? ', --force' : ''}).`)

  await importExpenses(accountsByName, statementsBySlug)
  console.log('\nImport complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
