import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { bg, textSecondary } from '../theme'

export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: bg, color: textSecondary, fontFamily: 'system-ui, sans-serif' }}>
        …
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  // authenticated | offline-authed
  return <Outlet />
}
