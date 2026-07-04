import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAll } from '../../db/stores'
import { SkeletonRows } from '../../components/Skeleton'
import { textPrimary, textSecondary, border } from '../../theme'

export function UnlinkedStatementsPage() {
  const navigate = useNavigate()
  const [statements, setStatements] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAll('creditCardStatements').then((rows) => {
      const filtered = rows
        .filter((s) => !s.creditCardId)
        .sort((a, b) => (b.closeDate as string).localeCompare(a.closeDate as string))
      setStatements(filtered)
      setLoading(false)
    })
  }, [])

  const fmt = (cents: unknown) =>
    cents == null ? '—' : `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const fmtDate = (d: unknown) =>
    d ? new Date((d as string) + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        <Link to="/cards" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Unlinked Statements</h2>
      </div>

      {loading && <SkeletonRows count={4} />}

      {!loading && statements.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No unlinked statements.
        </p>
      )}

      {statements.map((s) => (
        <div
          key={s.id as string}
          style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer', gap: 12 }}
          onClick={() => navigate(`/cards/statements/unlinked/${s.id as string}/link`)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.875rem', color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {fmtDate(s.closeDate)} · {s.status as string}
            </div>
            <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: 2 }}>
              Open {fmtDate(s.openDate)} · Due {fmtDate(s.dueDate)}
            </div>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, flexShrink: 0 }}>{fmt(s.totalCents)}</span>
        </div>
      ))}
    </div>
  )
}
