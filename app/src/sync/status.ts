type SyncStatus = 'synced' | 'pending' | 'error'

type Listener = (status: SyncStatus) => void
const listeners = new Set<Listener>()
let current: SyncStatus = 'synced'

export function getSyncStatus() { return current }

export function setSyncStatus(s: SyncStatus) {
  current = s
  listeners.forEach((fn) => fn(s))
}

export function onSyncStatusChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
