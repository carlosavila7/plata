import { Outlet, useLocation } from 'react-router-dom'
import { SyncStatus } from './SyncStatus'
import { useAuth } from '../auth/AuthContext'
import { bg, border, textPrimary, textSecondary } from '../theme'

export function Layout() {
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const isHome = pathname === '/'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: bg, color: textPrimary, fontFamily: 'system-ui, sans-serif' }}>
      {isHome && (
        <header style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: `1px solid ${border}` }}>
          <span style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => { void logout() }}
              style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', padding: 0 }}
            >
              Sign out
            </button>
          </span>
          <span style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 16, letterSpacing: '0.12em', textTransform: 'uppercase' }}>(Plata)</span>
          <span style={{ display: 'flex', justifyContent: 'flex-end' }}><SyncStatus /></span>
        </header>
      )}

      <main style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}
