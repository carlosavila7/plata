import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiClient } from '../api/client'
import { getAccessToken, setAccessToken, clearAccessToken } from './token'
import { refreshAccessToken, setUnauthenticatedHandler } from './authedFetch'
import { saveSession, loadSession, clearSession, type SessionUser } from './session'
import { clearAllData } from '../db/stores'
import { runSync } from '../sync/register'

type Status = 'loading' | 'authenticated' | 'offline-authed' | 'unauthenticated'

interface AuthContextValue {
  status: Status
  user: SessionUser | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthResponse {
  accessToken: string
  user: SessionUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)

  // If a different user is taking over this device, drop the previous user's cached
  // data before establishing the new session. Must run before saveSession (which
  // overwrites the marker loadSession reads).
  async function wipeIfUserChanged(nextUser: SessionUser) {
    const prev = await loadSession()
    if (prev && prev.id !== nextUser.id) await clearAllData()
  }

  async function applySession(data: AuthResponse) {
    await wipeIfUserChanged(data.user)
    setAccessToken(data.accessToken)
    await saveSession(data.user)
    setUser(data.user)
    setStatus('authenticated')
    void runSync()
  }

  async function login(email: string, password: string) {
    const data = await apiClient.post<AuthResponse>('/auth/login', { email, password })
    await applySession(data)
  }

  async function register(email: string, password: string) {
    const data = await apiClient.post<AuthResponse>('/auth/register', { email, password })
    await applySession(data)
  }

  async function logout() {
    try {
      await apiClient.post('/auth/logout', {})
    } catch {
      // Best-effort; the cookie is cleared server-side when reachable.
    }
    clearAccessToken()
    await clearSession()
    // Drop all cached financial data so it can't outlive the session on a shared device.
    // Tradeoff: any unsynced offline edits still in the queue are discarded.
    await clearAllData()
    setUser(null)
    setStatus('unauthenticated')
  }

  useEffect(() => {
    // Drop to login if a silent refresh ever fails mid-session.
    setUnauthenticatedHandler(() => {
      clearAccessToken()
      void clearSession()
      setUser(null)
      setStatus('unauthenticated')
    })

    let cancelled = false

    async function bootstrap() {
      const marker = await loadSession()

      if (navigator.onLine) {
        const refreshed = await refreshAccessToken()
        if (cancelled) return
        if (refreshed) {
          // Different user than the cached marker → wipe stale data first.
          if (marker && marker.id !== refreshed.id) await clearAllData()
          await saveSession(refreshed)
          setUser(refreshed)
          setStatus('authenticated')
          void runSync()
        } else {
          // Online but no valid session → truly logged out.
          await clearSession()
          setStatus('unauthenticated')
        }
      } else if (marker) {
        setUser(marker)
        setStatus('offline-authed')
      } else {
        setStatus('unauthenticated')
      }
    }

    void bootstrap()

    // Coming back online while offline-authed → upgrade to a live session.
    const onOnline = async () => {
      if (getAccessToken()) return
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        await saveSession(refreshed)
        setUser(refreshed)
        setStatus('authenticated')
      }
    }
    window.addEventListener('online', onOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
