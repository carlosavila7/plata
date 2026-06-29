#!/usr/bin/env node
/**
 * Focused importer — reads finance/balance/*.md and inserts balance snapshots
 * into the database via the running API.
 *
 * Usage:
 *   node import-balances.js --source ../finance --api http://localhost:3000 [--force]
 *
 * Steps:
 *   1. Ensure the canonical accounts exist (+ Rico, needed by one snapshot)
 *   2. Preflight: abort if balances already exist (unless --force)
 *   3. Import balances (balance/*.md), resolving origin → account
 */

import { readFileSync } from 'fs'
import { glob } from 'glob'
import matter from 'gray-matter'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
  .option('source', { type: 'string', demandOption: true, describe: 'Path to finance/ directory' })
  .option('api',    { type: 'string', demandOption: true, describe: 'API base URL' })
  .option('force',  { type: 'boolean', default: false, describe: 'Import even if balances already exist' })
  .parseSync()

const SOURCE = argv.source
const API    = argv.api.replace(/\/$/, '')

// ── Helpers ──────────────────────────────────────────────────────────────────

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

function cents(v) {
  return Math.round((Number(v) || 0) * 100)
}

// ── Step 1: Accounts ──────────────────────────────────────────────────────────

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

// ── Origin resolution ─────────────────────────────────────────────────────────

const SKIP = Symbol('skip')

const ACCOUNT_ALIASES = {
  'banco do brasil': 'Banco do Brasil',
  'bb': 'Banco do Brasil',
  'bbr': 'Banco do Brasil',
  'bradesco': 'Bradesco',
  'bra': 'Bradesco',
  'banco inter': 'Banco Inter',
  'inter': 'Banco Inter',
  'int': 'Banco Inter',
  'food voucher': 'Voucher',
  'meal voucher': 'Voucher',
  'foo': 'Voucher',
  'mea': 'Voucher',
  'rico': 'Rico',
  'ric': 'Rico',
  'bb-bi': SKIP,
  'bb-': SKIP,
}

/** Resolve an origin string → account record, SKIP sentinel, or null (unresolved). */
function resolveAccount(accountsByName, origin) {
  if (!origin) return null
  const normalized = String(origin).toLowerCase().trim()
  const canonical = ACCOUNT_ALIASES[normalized]
  if (canonical === SKIP) return SKIP
  return accountsByName[canonical] ?? accountsByName[String(origin)] ?? null
}

// ── Step 3: Balances ───────────────────────────────────────────────────────────

async function importBalances(accountsByName) {
  console.log('\n[3/3] Balances…')
  const files = (await glob(`${SOURCE}/balance/*.md`)).sort()
  let created = 0
  const skipped = []  // { name, reason }

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    // filename: B-{YYMMDD}-{ORIGIN_CODE}
    const parts = name.split('-')

    const date = ymd(fm.date) ?? yymmdd(parts[1])
    if (!date) { skipped.push({ name, reason: 'invalid date' }); continue }

    const origin = fm.origin ?? parts.slice(2).join('-')
    const account = resolveAccount(accountsByName, origin)
    if (account === SKIP) { skipped.push({ name, reason: `intentionally skipped origin "${origin}"` }); continue }
    if (!account) { skipped.push({ name, reason: `unresolved origin "${origin}"` }); continue }

    await api('POST', '/balances', {
      accountId:   account.id,
      date,
      amountCents: cents(fm.value),
    })
    created++
  }

  console.log(`\n  Created ${created} balances. Skipped ${skipped.length}.`)
  if (skipped.length) {
    const byReason = {}
    for (const s of skipped) byReason[s.reason] = (byReason[s.reason] ?? 0) + 1
    console.log('  Skipped by reason:')
    for (const [reason, count] of Object.entries(byReason)) console.log(`    ${count}× ${reason}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Source: ${SOURCE}`)
  console.log(`API:    ${API}`)

  const accountsByName = await ensureAccounts()

  console.log('\n[2/3] Preflight…')
  const existing = await api('GET', '/balances')
  if (existing.length > 0 && !argv.force) {
    console.error(`  Aborting: ${existing.length} balances already exist. Re-run with --force to import anyway.`)
    process.exit(1)
  }
  console.log(`  ${existing.length} existing balances (proceeding${argv.force ? ', --force' : ''}).`)

  await importBalances(accountsByName)
  console.log('\nImport complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
