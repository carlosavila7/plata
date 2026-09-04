import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { setAccessToken, clearAccessToken } from './accessToken'
import { getRefreshToken, setRefreshToken, clearRefreshToken } from './refreshTokenStore'
import { refreshAccessToken, setUnauthenticatedHandler, type SessionUser } from './authedFetch'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: Status
  user: SessionUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: SessionUser
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const queryClient = useQueryClient()

  async function login(email: string, password: string) {
    const data = await apiClient.post<AuthResponse>('/auth/login', { email, password })
    // Commit before acting on the response — see authedFetch.refreshAccessToken.
    await setRefreshToken(data.refreshToken)
    setAccessToken(data.accessToken)
    setUser(data.user)
    setStatus('authenticated')
  }

  async function logout() {
    try {
      // The body-transport /auth/logout route only revokes the token it's handed —
      // omitting it here would leave the refresh token valid server-side until its
      // 30-day TTL, even though the app has dropped it locally.
      const stored = await getRefreshToken()
      await apiClient.post('/auth/logout', { refreshToken: stored })
    } catch {
      // Best-effort; the stored token is dropped locally regardless.
    }
    clearAccessToken()
    await clearRefreshToken()
    queryClient.clear()
    setUser(null)
    setStatus('unauthenticated')
  }

  useEffect(() => {
    // Drop to login if a silent refresh ever fails mid-session.
    setUnauthenticatedHandler(() => {
      clearAccessToken()
      void clearRefreshToken()
      queryClient.clear()
      setUser(null)
      setStatus('unauthenticated')
    })

    let cancelled = false

    async function bootstrap() {
      const stored = await getRefreshToken()
      if (!stored) {
        setStatus('unauthenticated')
        return
      }

      const refreshed = await refreshAccessToken()
      if (cancelled) return
      if (refreshed) {
        setUser(refreshed)
        setStatus('authenticated')
      } else {
        setStatus('unauthenticated')
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
