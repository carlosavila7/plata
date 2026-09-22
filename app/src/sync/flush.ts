import { getDB } from '../db/schema'
import { upsert } from '../db/stores'
import { setSyncStatus } from './status'
import { authedFetch, ensureAuthed } from '../auth/authedFetch'

// De-dupes concurrent flushes (debounced enqueue, visibility hide/resume, the
// periodic safety net, `online`, login/bootstrap, logout) into a single /sync POST.
let inFlight: Promise<void> | null = null

export function flushQueue(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = flushQueueImpl().finally(() => { inFlight = null })
  return inFlight
}

async function flushQueueImpl() {
  const db = await getDB()
  const items = await db.getAllFromIndex('syncQueue', 'byQueuedAt')
  if (items.length === 0) { setSyncStatus('synced'); return }

  // No live session (e.g. offline-authed) → leave the queue pending until reconnect.
  if (!(await ensureAuthed())) { setSyncStatus('pending'); return }

  setSyncStatus('pending')
  try {
    const res = await authedFetch('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
    if (!res.ok) throw new Error(`/sync returned ${res.status}`)

    const { results } = await res.json() as { results: Array<{ id: string; status: string; record?: Record<string, unknown> }> }

    const tx = db.transaction(['syncQueue'], 'readwrite')
    const sqStore = tx.objectStore('syncQueue')
    for (const result of results) {
      if (result.status === 'ok' || result.status === 'conflict') {
        await sqStore.delete(result.id)
        if (result.record) {
          const item = items.find((i) => i.id === result.id)
          if (item) await upsert(item.entity as Parameters<typeof upsert>[0], result.record)
        }
      }
    }
    await tx.done
    // Rejected items stay queued for retry; surface them instead of reporting
    // "synced" while they silently never land (e.g. the fuelDetails bug).
    const rejected = results.filter((r) => r.status === 'error')
    if (rejected.length > 0) {
      console.warn(`flushQueue: ${rejected.length} item(s) rejected by /sync`, rejected)
      setSyncStatus('error')
    } else {
      setSyncStatus('synced')
    }
  } catch {
    setSyncStatus('error')
  }
}

export async function fetchDelta() {
  const db = await getDB()
  const lastSync = (await db.get('meta', 'lastSyncedAt')) ?? '1970-01-01T00:00:00Z'

  if (!(await ensureAuthed())) return

  try {
    const res = await authedFetch(`/sync/delta?since=${encodeURIComponent(lastSync)}`)
    if (!res.ok) return
    const delta = await res.json() as Record<string, Array<Record<string, unknown>>>

    const storeMap: Record<string, string> = {
      accounts: 'accounts', balances: 'balances', expenses: 'expenses', income: 'income',
      creditCards: 'creditCards', creditCardStatements: 'creditCardStatements',
      investmentPositions: 'investmentPositions', investmentEvents: 'investmentEvents',
    }

    for (const [key, records] of Object.entries(delta)) {
      const store = storeMap[key]
      if (!store) continue
      for (const serverRecord of records) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const local = await (db as any).get(store, serverRecord.id as string) as Record<string, unknown> | undefined
        if (!local || new Date(serverRecord.updatedAt as string) > new Date(local.updatedAt as string)) {
          await upsert(store, serverRecord)
        }
      }
    }

    await db.put('meta', new Date().toISOString(), 'lastSyncedAt')
  } catch {
    // Stay offline-capable — ignore delta errors
  }
}
