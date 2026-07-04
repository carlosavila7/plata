#!/usr/bin/env node
/**
 * Focused importer — reads finance/in/*.md and inserts income records into the
 * database via the running API.
 *
 * Usage:
 *   node import-income.js --source ../finance --api http://localhost:3000 [--force]
 *
 * Steps:
 *   1. Ensure the canonical accounts exist (+ Rico, referenced as to/from account)
 *   2. Preflight: abort if income already exists (unless --force)
 *   3. Import income (in/*.md): resolve account/from-account, map reason, build occurredAt
 *
 * Note: the markdown `time:` field is unquoted (e.g. 10:54) and YAML mis-parses it as a
 * sexagesimal number, so we never trust it — occurredAt is built from the reliable
 * `timestamp` (epoch ms), falling back to noon BRT on `date`.
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
  .option('force',    { type: 'boolean', default: false,     describe: 'Import even if income already exists' })
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

function ymd(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function cents(v) {
  return Math.round((Number(v) || 0) * 100)
}

function orNull(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/** occurredAt as ISO UTC. Prefer epoch-ms `timestamp`; else noon BRT on `date`. */
function occurredAt(fm) {
  const ts = Number(fm.timestamp)
  if (Number.isFinite(ts) && ts > 0) return new Date(ts).toISOString()
  const d = ymd(fm.date)
  return d ? new Date(`${d}T12:00:00-03:00`).toISOString() : null
}

/** Markdown reason → app enum value (lowercase, spaces → underscore). */
function normalizeReason(v) {
  return String(v ?? '').toLowerCase().trim().replace(/\s+/g, '_')
}

// ── Accounts ───────────────────────────────────────────────────────────────────

const CANONICAL_ACCOUNTS = [
  { name: 'Banco do Brasil', type: 'checking', institution: 'Banco do Brasil' },
  { name: 'Bradesco',        type: 'checking', institution: 'Bradesco' },
  { name: 'Banco Inter',     type: 'checking', institution: 'Banco Inter' },
  { name: 'Voucher',         type: 'voucher',  institution: 'Alelo' },
  { name: 'Rico',            type: 'savings',  institution: 'Rico' },
]

async function ensureAccounts() {
  console.log('\n[1/3] Accounts…')
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

const ACCOUNT_ALIASES = {
  'banco do brasil': 'Banco do Brasil',
  'bradesco': 'Bradesco',
  'banco inter': 'Banco Inter',
  'food voucher': 'Voucher',
  'meal voucher': 'Voucher',
  'rico': 'Rico',
}

/** Resolve an account-name string → account record, or null (external/unknown). */
function resolveAccount(accountsByName, name) {
  if (!name) return null
  const normalized = String(name).toLowerCase().trim()
  const canonical = ACCOUNT_ALIASES[normalized]
  return accountsByName[canonical] ?? accountsByName[String(name)] ?? null
}

// ── Income ───────────────────────────────────────────────────────────────────

async function importIncome(accountsByName) {
  console.log('\n[3/3] Income…')
  const files = (await glob(`${SOURCE}/in/*.md`)).sort()
  let created = 0
  const skipped = []  // { name, reason }
  const byReason = {}

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')

    const when = occurredAt(fm)
    if (!when) { skipped.push({ name, reason: 'no usable date/timestamp' }); continue }

    const toAccount = resolveAccount(accountsByName, fm.account)
    if (!toAccount) { skipped.push({ name, reason: `unresolved account "${fm.account}"` }); continue }

    const amountCents = cents(fm.amount)
    if (amountCents <= 0) { skipped.push({ name, reason: 'missing/zero amount' }); continue }

    const reason = normalizeReason(fm.reason)
    // from-account: resolve real account names; "thirdparty"/"self"/external → null
    const fromAccount = resolveAccount(accountsByName, fm['from-account'])

    await api('POST', '/income', {
      occurredAt:    when,
      reason,
      amountCents,
      toAccountId:   toAccount.id,
      fromAccountId: fromAccount ? fromAccount.id : null,
      description:   orNull(fm.description),
    })
    created++
    byReason[reason] = (byReason[reason] ?? 0) + 1
  }

  console.log(`\n  Created ${created} income records. Skipped ${skipped.length}.`)
  if (Object.keys(byReason).length) {
    console.log('  By reason:')
    for (const [r, c] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`    ${c}× ${r}`)
  }
  if (skipped.length) {
    const grouped = {}
    for (const s of skipped) grouped[s.reason] = (grouped[s.reason] ?? 0) + 1
    console.log('  Skipped by reason:')
    for (const [r, c] of Object.entries(grouped)) console.log(`    ${c}× ${r}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Source: ${SOURCE}`)
  console.log(`API:    ${API}`)

  await login(argv.email, argv.password)

  const accountsByName = await ensureAccounts()

  console.log('\n[2/3] Preflight…')
  const existing = await api('GET', '/income')
  if (existing.length > 0 && !argv.force) {
    console.error(`  Aborting: ${existing.length} income records already exist. Re-run with --force to import anyway.`)
    process.exit(1)
  }
  console.log(`  ${existing.length} existing income records (proceeding${argv.force ? ', --force' : ''}).`)

  await importIncome(accountsByName)
  console.log('\nImport complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
