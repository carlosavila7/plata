import { flushQueue, fetchDelta } from './flush'
import { mergeDuplicateAccounts } from './mergeAccounts'

// Full reconcile: push pending mutations, pull server delta, dedup, push again
// (to propagate any repointed FKs / dup deletes the merge produced). Each step is
// auth-gated inside flush.ts, so calling this while logged out is a safe no-op.
export async function runSync() {
  await flushQueue()
  await fetchDelta()
  await mergeDuplicateAccounts()
  await flushQueue()
}

export function registerSync() {
  // Clean up any duplicate accounts already sitting in local storage, even offline.
  mergeDuplicateAccounts()

  // Initial sync on load is triggered by AuthContext once a session is established;
  // here we only react to regaining connectivity.
  window.addEventListener('online', () => { void runSync() })

  // iOS/WebKit can suspend a hidden tab or standalone PWA almost immediately, with no
  // Background Sync API to catch up later, so push out whatever's queued the moment
  // we go hidden. On resume, do a full reconcile — a page that was only suspended
  // (not reloaded) skips AuthContext's bootstrap effect entirely, so this is the only
  // chance to pull in changes made elsewhere while it was backgrounded.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushQueue()
    else void runSync()
  })
  window.addEventListener('pagehide', () => { void flushQueue() })
}
