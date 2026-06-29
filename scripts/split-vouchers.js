#!/usr/bin/env node
/**
 * One-off: split the consolidated "Voucher" account into "Food Voucher" and
 * "Meal Voucher" via the running API.
 *
 *   - The existing Voucher account is renamed to "Meal Voucher" and KEEPS its
 *     baseline (balance snapshots + income top-ups).
 *   - A new "Food Voucher" account is created.
 *   - Expenses are re-attributed by paymentType:
 *       food_voucher → Food Voucher
 *       meal_voucher → Meal Voucher
 *
 * Both accounts use type 'voucher' (the API enum) and are distinguished by name.
 * Idempotent — safe to run more than once.
 *
 * Usage:
 *   node scripts/split-vouchers.js [--api http://localhost:3000]
 */

const API = (process.argv.includes('--api')
  ? process.argv[process.argv.indexOf('--api') + 1]
  : 'http://localhost:3000').replace(/\/$/, '')

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function main() {
  const accounts = await api('GET', '/accounts')
  const byName = Object.fromEntries(accounts.map(a => [a.name, a]))

  // 1. Meal Voucher = the existing voucher account, renamed (keeps its baseline).
  let meal = byName['Meal Voucher']
  if (!meal) {
    const legacy = byName['Voucher'] ?? accounts.find(a => a.type === 'voucher')
    if (!legacy) throw new Error('No existing Voucher account found to rename.')
    meal = await api('PUT', `/accounts/${legacy.id}`, { name: 'Meal Voucher' })
    console.log(`Renamed "${legacy.name}" (${legacy.id}) → "Meal Voucher"`)
  } else {
    console.log(`Meal Voucher already present (${meal.id})`)
  }

  // 2. Food Voucher = new account.
  let food = byName['Food Voucher']
  if (!food) {
    food = await api('POST', '/accounts', { name: 'Food Voucher', type: 'voucher', institution: 'Alelo' })
    console.log(`Created "Food Voucher" (${food.id})`)
  } else {
    console.log(`Food Voucher already present (${food.id})`)
  }

  // 3. Re-attribute expenses by paymentType.
  const expenses = await api('GET', '/expenses')
  const target = { food_voucher: food.id, meal_voucher: meal.id }
  let moved = 0
  for (const e of expenses) {
    const want = target[e.paymentType]
    if (want && e.accountId !== want) {
      await api('PUT', `/expenses/${e.id}`, { accountId: want })
      moved++
    }
  }
  console.log(`Re-attributed ${moved} voucher expense(s).`)
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
