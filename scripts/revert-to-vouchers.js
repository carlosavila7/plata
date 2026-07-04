#!/usr/bin/env node
/**
 * One-off: revert the merge-vouchers migration.
 *
 *   - Renames the current "Voucher" account back to "Meal Voucher"
 *   - Creates a new "Food Voucher" account
 *   - Re-attributes expenses:
 *       paymentType "Food Voucher" → accountId = Food Voucher, paymentType = food_voucher
 *       paymentType "Meal Voucher" → paymentType = meal_voucher (account already correct)
 *
 * Idempotent — safe to run more than once.
 *
 * Usage:
 *   node scripts/revert-to-vouchers.js --email <email> --password <pw> [--api http://localhost:3000]
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
    console.error('Usage: node revert-to-vouchers.js --email <email> --password <pw> [--api <url>]')
    process.exit(1)
  }

  await login(EMAIL, PASSWORD)
  const accounts = await api('GET', '/accounts')
  const byName = Object.fromEntries(accounts.map(a => [a.name, a]))

  // 1. Rename "Voucher" → "Meal Voucher".
  let meal = byName['Meal Voucher']
  if (!meal) {
    const legacy = byName['Voucher'] ?? accounts.find(a => a.type === 'voucher' && !a.deletedAt)
    if (!legacy) throw new Error('No "Voucher" or "Meal Voucher" account found.')
    meal = await api('PUT', `/accounts/${legacy.id}`, { name: 'Meal Voucher' })
    console.log(`Renamed "${legacy.name}" (${legacy.id}) → "Meal Voucher"`)
  } else {
    console.log(`"Meal Voucher" already present (${meal.id})`)
  }

  // 2. Ensure "Food Voucher" account exists.
  let food = byName['Food Voucher']
  if (!food) {
    food = await api('POST', '/accounts', { name: 'Food Voucher', type: 'voucher', institution: 'Alelo' })
    console.log(`Created "Food Voucher" (${food.id})`)
  } else {
    console.log(`"Food Voucher" already present (${food.id})`)
  }

  // 3. Re-attribute expenses.
  const expenses = await api('GET', '/expenses')
  let updated = 0

  for (const e of expenses) {
    if (e.paymentType === 'Food Voucher') {
      await api('PUT', `/expenses/${e.id}`, { accountId: food.id, paymentType: 'food_voucher' })
      updated++
    } else if (e.paymentType === 'Meal Voucher') {
      await api('PUT', `/expenses/${e.id}`, { paymentType: 'meal_voucher' })
      updated++
    }
  }

  console.log(`Updated ${updated} expense(s).`)
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
