#!/usr/bin/env node
/**
 * One-off: merge "Food Voucher" and "Meal Voucher" accounts back into a single
 * "Voucher" account, and rename the paymentType values:
 *   food_voucher → Food Voucher
 *   meal_voucher → Meal Voucher
 *
 * Idempotent — safe to run more than once.
 *
 * Usage:
 *   node scripts/merge-vouchers.js --email <email> --password <pw> [--api http://localhost:3000]
 */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : fallback
}

const API      = arg('api', 'http://localhost:3000').replace(/\/$/, '')
const EMAIL    = arg('email', '')
const PASSWORD = arg('password', '')

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

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Usage: node merge-vouchers.js --email <email> --password <pw> [--api <url>]')
    process.exit(1)
  }

  await login(EMAIL, PASSWORD)
  const accounts = await api('GET', '/accounts')
  const byName = Object.fromEntries(accounts.map(a => [a.name, a]))

  // 1. Ensure a canonical "Voucher" account exists.
  let voucher = byName['Voucher']
  if (!voucher) {
    // Pick whichever legacy account has balances/income to keep (prefer Meal Voucher
    // since it held the original baseline), rename it, and retire the other.
    const meal = byName['Meal Voucher']
    if (!meal) throw new Error('No "Meal Voucher" or "Voucher" account found.')
    voucher = await api('PUT', `/accounts/${meal.id}`, { name: 'Voucher' })
    console.log(`Renamed "Meal Voucher" (${meal.id}) → "Voucher"`)
  } else {
    console.log(`"Voucher" account already present (${voucher.id})`)
  }

  // 2. Soft-delete any remaining "Food Voucher" or "Meal Voucher" accounts
  //    after repointing their expenses (step 3 handles repointing first).
  const legacyIds = new Set(
    ['Food Voucher', 'Meal Voucher']
      .map(name => byName[name])
      .filter(Boolean)
      .filter(a => a.id !== voucher.id)
      .map(a => a.id),
  )

  // 3. Update all expenses from legacy accounts + rename paymentType.
  const PAYMENT_TYPE_MAP = { food_voucher: 'Food Voucher', meal_voucher: 'Meal Voucher' }
  const expenses = await api('GET', '/expenses')
  let moved = 0

  for (const e of expenses) {
    const needsAccount   = legacyIds.has(e.accountId)
    const newPaymentType = PAYMENT_TYPE_MAP[e.paymentType]
    const needsPayment   = Boolean(newPaymentType)

    if (!needsAccount && !needsPayment) continue

    await api('PUT', `/expenses/${e.id}`, {
      ...(needsAccount ? { accountId: voucher.id }                 : {}),
      ...(needsPayment ? { paymentType: newPaymentType ?? e.paymentType } : {}),
    })
    moved++
  }
  console.log(`Updated ${moved} expense(s).`)

  // 4. Soft-delete now-empty legacy accounts.
  for (const id of legacyIds) {
    await api('DELETE', `/accounts/${id}`)
    const name = accounts.find(a => a.id === id)?.name ?? id
    console.log(`Soft-deleted legacy account "${name}" (${id})`)
  }

  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
