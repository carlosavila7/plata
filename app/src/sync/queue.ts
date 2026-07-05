import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db/schema'
import { flushQueue } from './flush'

export type SyncOperation = 'create' | 'update' | 'delete'

// Debounce so a burst of enqueues (a form writing several related records, or
// mergeAccounts's repoint loop) collapses into a single /sync POST.
const FLUSH_DEBOUNCE_MS = 1500
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushQueue()
  }, FLUSH_DEBOUNCE_MS)
}

export async function enqueue(
  entity: string,
  entityId: string,
  operation: SyncOperation,
  payload: Record<string, unknown>,
) {
  const db = await getDB()
  await db.put('syncQueue', {
    id: uuidv4(),
    entity,
    entityId,
    operation,
    payload,
    queuedAt: new Date().toISOString(),
  })
  scheduleFlush()
}

export async function countQueued(): Promise<number> {
  const db = await getDB()
  return db.count('syncQueue')
}
