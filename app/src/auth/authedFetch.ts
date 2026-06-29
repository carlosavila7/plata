import { getAccessToken, setAccessToken, clearAccessToken } from './token'
import type { SessionUser } from './session'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Called when re-authentication is impossible (refresh failed). AuthContext wires
// this up to drop to the login screen.
let onUnauthenticated: () => void = () => {}
export function setUnauthenticatedHandler(fn: () => void): void {
  onUnauthenticated = fn
}

// De-dupes concurrent refreshes so a burst of 401s triggers a single /auth/refresh.
let refreshPromise: Promise<SessionUser | null> | null = null

/** Silently mint a new access token from the refresh cookie. Returns the user, or null. */
export function refreshAccessToken(): Promise<SessionUser | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (!res.ok) return null
      const data = (await res.json()) as { accessToken: string; user: SessionUser }
      setAccessToken(data.accessToken)
      return data.user
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/** True if we already hold an access token, or can silently obtain one. */
export async function ensureAuthed(): Promise<boolean> {
  if (getAccessToken()) return true
  return (await refreshAccessToken()) !== null
}

/**
 * fetch wrapper used by the API client AND the sync layer. Adds the bearer token,
 * sends the refresh cookie, and on a 401 (for non-auth endpoints) tries one silent
 * refresh + retry before giving up.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(init.headers)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  }

  let res = await doFetch()
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const user = await refreshAccessToken()
    if (user) {
      res = await doFetch()
    } else {
      clearAccessToken()
      onUnauthenticated()
    }
  }
  return res
}
