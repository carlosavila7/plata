import { getDB } from './schema'

export async function getAll(store: string) {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = db.transaction(store as any, 'readonly')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = await (tx.store as any).getAll()
  return (all as Array<Record<string, unknown>>).filter((r) => !r.deletedAt)
}

/** Unfiltered read — includes soft-deleted rows, unlike {@link getAll}. */
export async function getAllRaw(store: string) {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = db.transaction(store as any, 'readonly')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (tx.store as any).getAll()) as Array<Record<string, unknown>>
}

export async function getById(store: string, id: string) {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).get(store, id)
}

export async function upsert(store: string, record: Record<string, unknown>) {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).put(store, record)
}

export async function getRecentBoughtAt(category: string, subCategory: string, limit = 3): Promise<string[]> {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (db as any).transaction('expenses', 'readonly')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, unknown>[] = await tx.store.index('byCategory').getAll(category)
  const filtered = rows
    .filter(e => !e.deletedAt && e.subCategory === subCategory && e.boughtAt)
    .sort((a, b) => new Date(b.occurredAt as string).getTime() - new Date(a.occurredAt as string).getTime())
  const seen = new Set<string>()
  const result: string[] = []
  for (const e of filtered) {
    const val = e.boughtAt as string
    if (!seen.has(val)) { seen.add(val); result.push(val) }
    if (result.length >= limit) break
  }
  return result
}

// Domain data stores + the pending mutation queue. Lookup stores (categories,
// payment types, cities, persons) are global reference data and intentionally kept.
const OWNED_STORES = [
  'accounts', 'balances', 'expenses', 'income',
  'creditCards', 'creditCardStatements', 'investmentPositions', 'investmentEvents',
  'syncQueue',
] as const

/**
 * Wipe every owned record and the pending sync queue from IndexedDB, and reset the
 * delta cursor so the next session does a full pull from epoch. Used on logout and
 * when a different user logs in on the same device, so one user's cached financial
 * data never leaks to the next (records carry no userId locally; the server scopes
 * everything, but the cache must not outlive the session).
 */
export async function clearAllData() {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (db as any).transaction([...OWNED_STORES], 'readwrite')
  await Promise.all(OWNED_STORES.map((s) => tx.objectStore(s).clear()))
  await tx.done
  await db.delete('meta', 'lastSyncedAt')
}

export async function softDelete(store: string, id: string) {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any).get(store, id)
  if (!existing) return
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).put(store, { ...existing, deletedAt: now, updatedAt: now })
}
