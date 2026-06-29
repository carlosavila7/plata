// In-memory brute-force throttle for the login endpoint. A login key
// (email + client IP) is locked out after MAX_FAILS failed attempts within
// WINDOW_MS, for LOCK_MS. Counters are per-process and reset on restart —
// sufficient for a single-instance deployment.

const MAX_FAILS = 5
const WINDOW_MS = 15 * 60_000 // window in which failures accumulate
const LOCK_MS = 15 * 60_000 // lockout duration once the threshold is hit

interface Entry {
  fails: number
  windowStart: number
  lockedUntil: number | null
}

const attempts = new Map<string, Entry>()

/** Build the throttle key. Email-primary; IP is best-effort (often the proxy's). */
export function throttleKey(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`
}

/** Seconds remaining on an active lockout, or 0 if not locked. Clears expired locks. */
export function retryAfterSeconds(key: string): number {
  const entry = attempts.get(key)
  if (!entry?.lockedUntil) return 0
  const remainingMs = entry.lockedUntil - Date.now()
  if (remainingMs <= 0) {
    attempts.delete(key)
    return 0
  }
  return Math.ceil(remainingMs / 1000)
}

/** Record a failed attempt, opening a lockout once MAX_FAILS is reached. */
export function recordFailure(key: string): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { fails: 1, windowStart: now, lockedUntil: null })
    return
  }
  entry.fails += 1
  if (entry.fails >= MAX_FAILS) entry.lockedUntil = now + LOCK_MS
}

/** Clear all state for a key after a successful login. */
export function recordSuccess(key: string): void {
  attempts.delete(key)
}

// Drop fully-expired entries so the map stays bounded (the endpoint is public).
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of attempts) {
    const lockExpired = !entry.lockedUntil || entry.lockedUntil <= now
    if (lockExpired && now - entry.windowStart > WINDOW_MS) attempts.delete(key)
  }
}, WINDOW_MS)
sweep.unref()
