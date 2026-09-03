# The native client is online-only

The PWA in `app/` is local-first: every screen reads whole IndexedDB stores, and
`syncQueue` + `/sync` exist so an expense can be captured with no connectivity at
all. The React Native client in `mobile/` deliberately drops this. It holds no
domain data on the device, reads every screen from the API, and writes straight
through the validated REST routes; when a write fails there is no queue, only an
error and a retry. We accept losing offline capture — the app's most
network-hostile use case, standing at a counter with bad signal — in exchange for
deleting the entire sync layer from the client and moving the derived-balance
logic to a place both clients can share.

## Consequences

- "No local persistence" is a claim about *domain data*. The refresh token is
  persisted in the OS keystore via `expo-secure-store`, and an in-memory query
  cache lives for the duration of a session. Neither contradicts this decision.
- There is no cheap middle ground. A durable outbox for failed writes needs
  client-generated ids, client `updatedAt` and conflict handling on replay — at
  which point `syncQueue`, `flush.ts` and `/sync` have been rebuilt. If offline
  capture turns out to be non-negotiable in daily use, reverse this decision
  knowingly rather than growing back into it one feature at a time.
- The PWA stays installed during the transition and remains the fallback for
  offline capture until the native client has proven itself.
