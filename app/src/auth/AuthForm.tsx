import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { bg, border, textPrimary, textSecondary, btnPrimary, inputStyle, labelStyle } from '../theme'

interface Props {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: Props) {
  const { status, login, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'authenticated' || status === 'offline-authed') {
    return <Navigate to="/" replace />
  }

  const isLogin = mode === 'login'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (isLogin) await login(email, password)
      else await register(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      const detail = (err as { body?: { detail?: string }; message?: string })
      setError(detail.body?.detail ?? detail.message ?? 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: bg, color: textPrimary, fontFamily: 'system-ui, sans-serif', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 22, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 32, textAlign: 'center' }}>
          (Plata)
        </h1>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={labelStyle}>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </label>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, marginTop: 8 }}>
            {busy ? '…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: textSecondary }}>
          {isLogin ? (
            <>No account? <Link to="/register" style={{ color: textPrimary }}>Register</Link></>
          ) : (
            <>Have an account? <Link to="/login" style={{ color: textPrimary }}>Sign in</Link></>
          )}
        </div>

        <div style={{ marginTop: 24, height: 1, background: border }} />
      </div>
    </div>
  )
}
