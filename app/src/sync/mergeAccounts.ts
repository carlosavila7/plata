import { getDB } from '../db/schema'
import { enqueue } from './queue'

// Records that reference an account by id. Statements link to an account by the
// `bank` string instead, so they need no repointing here.
const FK_FIELDS: Record<string, string[]> = {
  balances: ['accountId'],
  expenses: ['accountId'],
  income:   ['toAccountId', 'fromAccountId'],
}

/**
 * Repoint every record that references `fromId` to `toId`, then soft-delete the
 * `fromId` account. Repointed rows and (optionally) the account delete are
 * enqueued for sync.
 */
async function repointAndRetire(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  account: Record<string, unknown>,
  toId: string,
  syncDeleteAccount: boolean,
) {
  const fromId = account.id as string
  const now = new Date().toISOString()

  for (const [store, fields] of Object.entries(FK_FIELDS)) {
    const rows = (await db.getAll(store)) as Record<string, unknown>[]
    for (const row of rows) {
      let changed = false
      for (const field of fields) {
        if (row[field] === fromId) { row[field] = toId; changed = true }
      }
      if (changed) {
        row.updatedAt = now
        await db.put(store, row)
        await enqueue(store, row.id as string, 'update', row)
      }
    }
  }

  await db.put('accounts', { ...account, deletedAt: now, updatedAt: now })
  if (syncDeleteAccount) await enqueue('accounts', fromId, 'delete', { id: fromId })
}

/**
 * Reconcile account records so each logical account is a single row.
 *
 * 1. Collapse accounts that share a name but have different ids (client seeds
 *    placeholders with fixed ids like `acc-banco-do-brasil`; the server seeds the
 *    same names with UUIDs, and delta-sync stores both). The server-style UUID
 *    wins; FKs are repointed and the placeholder is soft-deleted.
 * 2. Fold any legacy single "Voucher" account into "Meal Voucher" — the voucher
 *    account was split into Food/Meal Voucher, with the baseline kept on Meal.
 *
 * Idempotent — a no-op once accounts are already reconciled.
 */
export async function mergeDuplicateAccounts() {
  const db = await getDB()
  const accounts = (await (db as unknown as { getAll(s: string): Promise<Record<string, unknown>[]> }).getAll('accounts'))
    .filter(a => !a.deletedAt)

  // 1. Collapse same-name duplicates.
  const byName = new Map<string, Record<string, unknown>[]>()
  for (const a of accounts) {
    const name = a.name as string
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name)!.push(a)
  }

  for (const group of byName.values()) {
    if (group.length < 2) continue

    // Canonical = a real server record (id not prefixed `acc-`); tiebreak by the
    // earliest createdAt so the choice is deterministic.
    const sorted = [...group].sort((a, b) => {
      const aSeed = (a.id as string).startsWith('acc-') ? 1 : 0
      const bSeed = (b.id as string).startsWith('acc-') ? 1 : 0
      if (aSeed !== bSeed) return aSeed - bSeed
      return (a.createdAt as string).localeCompare(b.createdAt as string)
    })

    const canonicalId = sorted[0].id as string
    for (const dup of sorted.slice(1)) {
      // Placeholder (`acc-`) ids were never synced to the server, so only real
      // server duplicates get a sync delete enqueued.
      await repointAndRetire(db, dup, canonicalId, !(dup.id as string).startsWith('acc-'))
    }
  }

  // 2. Fold a leftover "Voucher" account into "Meal Voucher".
  const mealVoucher = accounts.find(a => a.name === 'Meal Voucher' && !a.deletedAt)
  if (mealVoucher) {
    for (const stray of accounts.filter(a => a.name === 'Voucher' && !a.deletedAt)) {
      await repointAndRetire(db, stray, mealVoucher.id as string, !(stray.id as string).startsWith('acc-'))
    }
  }
}
