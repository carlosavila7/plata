#!/usr/bin/env node
/**
 * Migration CLI — reads markdown-frontmatter finance files and seeds the API.
 *
 * Usage:
 *   node migrate.js --source ./finance --api http://localhost:3000
 *
 * Migration order (as per spec):
 *   1. Credit cards (from statement filenames)
 *   2. Accounts (idempotent seed via GET)
 *   3. Credit card statements
 *   4. Balances
 *   5. Income
 *   6. Expenses
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
  const raw = readFileSync(file, 'utf8')
  return matter(raw).data
}

/** Convert YYMMDD → YYYY-MM-DD */
function yymmdd(s) {
  if (!s) return null
  const str = String(s).padStart(6, '0')
  return `20${str.slice(0, 2)}-${str.slice(2, 4)}-${str.slice(4, 6)}`
}

/** Merge YYYY-MM-DD + HH:MM → ISO 8601 UTC. Falls back to timestamp field, then midnight UTC. */
function mergeDateTime(date, time, timestamp) {
  if (timestamp) return new Date(Number(timestamp) * 1000).toISOString()
  const d = typeof date === 'string' ? date : yymmdd(date)
  const t = time ? String(time).replace(/[^0-9]/g, '').padStart(4, '0') : '0000'
  return `${d}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`
}

function slug(bank, network, cardName) {
  return `${bank}|${network}|${cardName}`.toLowerCase()
}

// ── Step 1: Credit cards ──────────────────────────────────────────────────────

async function migrateCards() {
  console.log('\n[1/6] Credit cards…')
  const files = await glob(`${SOURCE}/credit-card-statements/*.md`)
  const cardMap = new Map() // slug → { id, closingDay, dueDay, limitCents }

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    // filename: S-{MONTH}-{BANK_CODE}-{NETWORK}-{CARD_NAME}
    const parts = name.split('-')
    const bank    = fm.bank    ?? parts[2] ?? 'Unknown'
    const network = fm.network ?? parts[3] ?? 'Unknown'
    const cardName = fm['card-name'] ?? fm.cardName ?? parts.slice(4).join('-') ?? 'Unknown'
    const key = slug(bank, network, cardName)
    if (!cardMap.has(key)) {
      const record = await api('POST', '/credit-cards', {
        nickname:   cardName,
        bank,
        network,
        closingDay: fm['closing-day'] ?? fm.closingDay ?? 1,
        dueDay:     fm['due-day']     ?? fm.dueDay     ?? 10,
        limitCents: fm['limit-cents'] ?? fm.limitCents ?? null,
      })
      cardMap.set(key, record)
      console.log(`  Created card: ${cardName} (${bank}/${network})`)
    }
  }
  return cardMap
}

// ── Step 2: Accounts ──────────────────────────────────────────────────────────

async function migrateAccounts() {
  console.log('\n[2/6] Accounts…')
  const existing = await api('GET', '/accounts')
  if (existing.length > 0) {
    console.log(`  ${existing.length} accounts already seeded.`)
    return existing
  }
  // Seed via API — the API relies on the seed script; tell user to run it
  console.log('  No accounts found. Run: cd api && npx tsx prisma/seed.ts')
  return []
}

// ── Step 3: Credit card statements ───────────────────────────────────────────

async function migrateStatements(cardMap) {
  console.log('\n[3/6] Credit card statements…')
  const files = await glob(`${SOURCE}/credit-card-statements/*.md`)
  const statementMap = new Map() // original slug/filename → statement id

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    const parts = name.split('-')
    const bank     = fm.bank     ?? parts[2] ?? 'Unknown'
    const network  = fm.network  ?? parts[3] ?? 'Unknown'
    const cardName = fm['card-name'] ?? fm.cardName ?? parts.slice(4).join('-') ?? 'Unknown'
    const key = slug(bank, network, cardName)
    const card = cardMap.get(key)
    if (!card) { console.warn(`  Warning: no card for ${name}`); continue }

    const openDate  = fm['open-date']  ?? fm.openDate  ?? yymmdd(parts[1]) ?? '2000-01-01'
    const closeDate = fm['close-date'] ?? fm.closeDate ?? openDate
    const dueDate   = fm['due-date']   ?? fm.dueDate   ?? openDate

    const record = await api('POST', `/credit-cards/${card.id}/statements`, {
      openDate,
      closeDate,
      dueDate,
      status:     fm.status     ?? 'paid',
      totalCents: fm['total-cents'] ?? fm.totalCents ?? null,
    })
    statementMap.set(name, record.id)
    console.log(`  Created statement: ${name}`)
  }
  return statementMap
}

// ── Step 4: Balances ─────────────────────────────────────────────────────────

async function migrateBalances(accountsByName) {
  console.log('\n[4/6] Balances…')
  const files = await glob(`${SOURCE}/balance/*.md`)
  let count = 0

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    // filename: B-{YYMMDD}-{ORIGIN_CODE}
    const parts = name.split('-')
    const date = yymmdd(parts[1]) ?? fm.date ?? '2000-01-01'
    const originCode = parts.slice(2).join('-')
    const account = resolveAccount(accountsByName, fm.origin ?? fm.account ?? originCode)
    if (!account) { console.warn(`  Warning: no account for balance ${name} (${originCode})`); continue }

    await api('POST', '/balances', {
      accountId:   account.id,
      date,
      amountCents: Math.round((fm.amount ?? fm.balance ?? 0) * 100),
    })
    count++
  }
  console.log(`  Migrated ${count} balances.`)
}

// ── Step 5: Income ────────────────────────────────────────────────────────────

async function migrateIncome(accountsByName) {
  console.log('\n[5/6] Income…')
  const files = await glob(`${SOURCE}/in/*.md`)
  let count = 0

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    // filename: T-{YYMMDD}-{ACCOUNT_CODE}-{REASON_CODE}
    const parts = name.split('-')
    const date = yymmdd(parts[1])
    const occurredAt = mergeDateTime(date, fm.time, fm.timestamp)
    const toAccount   = resolveAccount(accountsByName, fm.account ?? parts[2])
    const fromAccount = fm['from-account'] ?? fm.fromAccount ? resolveAccount(accountsByName, fm['from-account'] ?? fm.fromAccount) : null

    if (!toAccount) { console.warn(`  Warning: no toAccount for income ${name}`); continue }

    await api('POST', '/income', {
      occurredAt,
      reason:        normalizeReason(fm.reason ?? parts[3]),
      amountCents:   Math.round((fm.amount ?? 0) * 100),
      toAccountId:   toAccount.id,
      fromAccountId: fromAccount?.id ?? null,
      description:   fm.description ?? fm.desc ?? null,
    })
    count++
  }
  console.log(`  Migrated ${count} income records.`)
}

// ── Step 6: Expenses ──────────────────────────────────────────────────────────

async function migrateExpenses(accountsByName, statementMap) {
  console.log('\n[6/6] Expenses…')
  const files = await glob(`${SOURCE}/out/*.md`)
  let count = 0
  let skipped = 0

  for (const file of files) {
    const fm = readMd(file)
    const name = path.basename(file, '.md')
    // filename: E-{YYMMDD}-{HHMM}-{CATCODE}{SUBCATCODE}-{ORIGIN_CODE}-{PERSON_CODE}-{RECURRENT_CODE}-{ID}
    const parts = name.split('-')
    const date = yymmdd(parts[1])
    const time = parts[2]
    const occurredAt = mergeDateTime(date, time, fm.timestamp)
    const account = resolveAccount(accountsByName, fm.origin ?? fm.account ?? parts[4])
    if (!account) { console.warn(`  Warning: no account for expense ${name}`); skipped++; continue }

    const category    = fm.category    ?? 'other'
    const subCategory = fm['sub-category'] ?? fm.subCategory ?? fm['sub_category'] ?? 'other'
    const paymentType = normalizePaymentType(fm['payment-type'] ?? fm.paymentType ?? fm.payment ?? 'debit')

    let creditCardStatementId = null
    const statSlug = fm['credit-card-statement'] ?? fm.creditCardStatement
    if (statSlug) {
      creditCardStatementId = statementMap.get(statSlug) ?? null
    }

    // Fuel details JSON
    let fuelDetails = null
    if (subCategory === 'fuel' || fm['full-tank'] !== undefined) {
      fuelDetails = {
        fullTank:           fm['full-tank'] ?? false,
        odometerKm:         fm['odometer-km'] ?? fm.odometer ?? null,
        pricePerLiterCents: Math.round((fm['price-per-liter'] ?? 0) * 100),
      }
    }

    await api('POST', '/expenses', {
      occurredAt,
      category,
      subCategory,
      costCents:            Math.round((fm.cost ?? 0) * 100),
      accountId:            account.id,
      paymentType,
      creditCardStatementId,
      boughtAt:             fm['bought-at']  ?? fm.boughtAt  ?? null,
      city:                 fm.city          ?? null,
      description:          fm.description   ?? fm.desc      ?? null,
      groupingTag:          fm['grouping-tag'] ?? fm.groupingTag ?? null,
      isRecurrent:          fm.recurrent      ?? fm.isRecurrent ?? false,
      person:               fm.person         ?? null,
      isDelivery:           category === 'food' ? (fm['is-delivery'] ?? fm.isDelivery ?? false) : null,
      fuelDetails,
    })
    count++
  }
  console.log(`  Migrated ${count} expenses (skipped ${skipped}).`)
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

const ACCOUNT_ALIASES = {
  bb:    'Banco do Brasil',
  'banco-do-brasil': 'Banco do Brasil',
  bradesco: 'Bradesco',
  inter: 'Banco Inter',
  'banco-inter': 'Banco Inter',
  food:  'food voucher',
  meal:  'meal voucher',
  'food-voucher': 'food voucher',
  'meal-voucher': 'meal voucher',
}

function resolveAccount(accountsByName, code) {
  if (!code) return null
  const normalized = String(code).toLowerCase().trim()
  const canonical  = ACCOUNT_ALIASES[normalized] ?? code
  return accountsByName[canonical] ?? accountsByName[String(code)] ?? null
}

function normalizeReason(r) {
  const map = { sal: 'salary', int: 'interest', ref: 'refund', dep: 'deposit', self: 'self' }
  return map[String(r).toLowerCase()] ?? r ?? 'deposit'
}

function normalizePaymentType(p) {
  const map = { debt: 'debit', debit: 'debit', credit: 'credit', pix: 'pix', food_voucher: 'food_voucher', meal_voucher: 'meal_voucher', food: 'food_voucher', meal: 'meal_voucher' }
  return map[String(p).toLowerCase()] ?? 'debit'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Source: ${SOURCE}`)
  console.log(`API:    ${API}`)

  const cardMap = await migrateCards()
  const accounts = await migrateAccounts()
  const accountsByName = Object.fromEntries(accounts.map(a => [a.name, a]))
  const statementMap = await migrateStatements(cardMap)
  await migrateBalances(accountsByName)
  await migrateIncome(accountsByName)
  await migrateExpenses(accountsByName, statementMap)

  console.log('\nMigration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
