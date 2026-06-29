import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getById, getAll } from '../../db/stores'
import { border, textPrimary, textSecondary, btnPrimary } from '../../theme'

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [card, setCard] = useState<Record<string, unknown> | null>(null)
  const [statements, setStatements] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    if (!id) return
    Promise.all([
      getById('creditCards', id),
      getAll('creditCardStatements'),
    ]).then(([c, stmts]) => {
      setCard(c ?? null)
      const filtered = (stmts as Record<string, unknown>[])
        .filter(s => s.creditCardId === id && !s.deletedAt)
        .sort((a, b) => (b.closeDate as string).localeCompare(a.closeDate as string))
      setStatements(filtered)
    })
  }, [id])

  const fmt = (cents: unknown) =>
    cents == null ? '—' : `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ paddingBottom: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Link to="/cards" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>
          {(card?.nickname as string) ?? 'Card'}
        </h2>
      </div>

      {card && (
        <div style={{ borderBottom: `1px solid ${border}`, paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {card.bank as string} · {card.network as string}
            </span>
            <button
              onClick={() => navigate(`/cards/${id}/edit`)}
              style={{ background: 'transparent', border: 'none', color: textPrimary, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}
            >
              Edit ›
            </button>
          </div>
          <div style={{ fontSize: 12, display: 'flex', gap: 16, color: textSecondary, flexWrap: 'wrap' }}>
            <span>Closing: day {Number(card.closingDay)}</span>
            <span>Due: day {Number(card.dueDay)}</span>
            <span>Limit: {fmt(card.limitCents)}</span>
          </div>
        </div>
      )}

      <h3 style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Statements</h3>

      {statements.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No statements yet.
        </p>
      )}

      {statements.map((s) => {
        const date = new Date((s.closeDate as string) + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        return (
          <div
            key={s.id as string}
            style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer', gap: 12 }}
            onClick={() => navigate(`/cards/${id}/statements/${s.id as string}/expenses`)}
          >
            <span style={{ fontSize: '0.875rem', color: textSecondary, flexShrink: 0, width: 56 }}>{date}</span>
            <span style={{ flex: 1, fontSize: '0.875rem', color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.status as string}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, flexShrink: 0 }}>{fmt(s.totalCents)}</span>
          </div>
        )
      })}

      <button
        onClick={() => navigate(`/cards/${id}/statements/new`)}
        style={{ ...btnPrimary, position: 'fixed', bottom: 16, left: 16, right: 16, width: 'calc(100% - 32px)', minHeight: 56, fontSize: 15, fontWeight: 500 }}
      >
        + Add statement
      </button>
    </div>
  )
}
