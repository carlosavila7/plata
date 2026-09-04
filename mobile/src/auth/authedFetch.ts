import { getApiBaseUrl } from '../config/apiBaseUrl'
import { getAccessToken, setAccessToken, clearAccessToken } from './accessToken'
import { getRefreshToken, setRefreshToken, clearRefreshToken } from './refreshTokenStore'

export interface SessionUser {
  id: string
  email: string
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: SessionUser
}

// React Native holds no httpOnly cookie, so every authenticated request opts
// in to the body refresh transport (ADR-0002).
const REFRESH_TRANSPORT_HEADER = 'X-Refresh-Transport'
const REFRESH_TRANSPORT_VALUE = 'body'

// Called when re-authentication is impossible (refresh failed or absent).
// AuthContext wires this up to drop to the login screen.
let onUnauthenticated: () => void = () => {}
export function setUnauthenticatedHandler(fn: () => void): void {
  onUnauthenticated = fn
}

// De-dupes concurrent refreshes so a burst of 401s triggers a single /auth/refresh.
let refreshPromise: Promise<SessionUser | null> | null = null

/**
 * Silently mint a new access token from the stored refresh token. Rotation is
 * destructive server-side (the presented token is revoked), so the rotated
 * token is committed to the keystore before anything else happens with the
 * response — an app kill between the response arriving and the write landing
 * would otherwise strand the user logged out with no valid token anywhere.
 */
export function refreshAccessToken(): Promise<SessionUser | null> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const stored = await getRefreshToken()
      if (!stored) return null

      const base = await getApiBaseUrl()
      const res = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [REFRESH_TRANSPORT_HEADER]: REFRESH_TRANSPORT_VALUE },
        body: JSON.stringify({ refreshToken: stored }),
      })
      if (!res.ok) {
        await clearRefreshToken()
        return null
      }

      const data = (await res.json()) as AuthResponse
      await setRefreshToken(data.refreshToken)
      setAccessToken(data.accessToken)
      return data.user
    } catch {
      // Network failure: leave the stored refresh token alone, nothing was rotated.
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/**
 * fetch wrapper used by the API client. Adds the bearer token and the opt-in
 * refresh-transport header, and on a 401 (for non-auth endpoints) tries one
 * silent refresh + retry before dropping to the login screen.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = await getApiBaseUrl()

  const doFetch = () => {
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    headers.set(REFRESH_TRANSPORT_HEADER, REFRESH_TRANSPORT_VALUE)
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${base}${path}`, { ...init, headers })
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
