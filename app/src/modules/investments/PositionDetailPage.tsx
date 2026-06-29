import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getById, getAll } from '../../db/stores'
import { isUnitBased } from './positions'
import { border, textPrimary, textSecondary, btnPrimary } from '../../theme'

export function PositionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [position, setPosition] = useState<Record<string, unknown> | null>(null)
  const [events, setEvents] = useState<Record<string, unknown>[]>([])
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    if (!id) return
    Promise.all([
      getById('investmentPositions', id),
      getAll('investmentEvents'),
      getAll('accounts'),
    ]).then(([pos, evs, accts]) => {
      setPosition(pos ?? null)
      setAccounts(accts as Record<string, unknown>[])
      const filtered = (evs as Record<string, unknown>[])
        .filter(e => e.positionId === id && !e.deletedAt)
        .sort((a, b) => new Date(b.occurredAt as string).getTime() - new Date(a.occurredAt as string).getTime())
      setEvents(filtered)
    })
  }, [id])

  const fmt = (cents: unknown) =>
    cents == null ? '—' : `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const qty = position ? Number(position.quantity) : 0
  const currentPrice = position?.currentPriceCents as number | null | undefined
  const currentValue = currentPrice != null ? qty * currentPrice : null
  const unit = isUnitBased(position?.assetType as string | undefined)
  const allocated = Math.round(qty * Number(position?.avgPriceCents ?? 0))
  const accountName = accounts.find(a => a.id === position?.accountId)?.name as string | undefined

  return (
    <div style={{ paddingBottom: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <Link to="/investments" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>
          {(position?.name as string) ?? 'Position'}
        </h2>
      </div>

      {position && (
        <div style={{ borderBottom: `1px solid ${border}`, paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{position.assetType as string}</span>
            <button
              onClick={() => navigate(`/investments/${id}/edit`)}
              style={{ background: 'transparent', border: 'none', color: textPrimary, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}
            >
              Edit ›
            </button>
          </div>
          <div style={{ fontSize: 12, display: 'flex', gap: 16, color: textSecondary, flexWrap: 'wrap' }}>
            {unit ? (
              <>
                <span>Qty: {qty.toLocaleString('pt-BR')}</span>
                <span>Avg: {fmt(position.avgPriceCents)}</span>
                <span>Total: {fmt(allocated)}</span>
                <span>Now: {fmt(currentValue)}</span>
              </>
            ) : (
              <span>Total: {fmt(allocated)}</span>
            )}
          </div>
          {accountName && (
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 8 }}>Account: {accountName}</div>
          )}
          {(position.notes as string | undefined) && (
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 8 }}>{position.notes as string}</div>
          )}
        </div>
      )}

      <h3 style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Events</h3>

      {events.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No events yet.
        </p>
      )}

      {events.map((e) => {
        const date = new Date(e.occurredAt as string).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        return (
          <div
            key={e.id as string}
            style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
            onClick={() => navigate(`/investments/${id}/events/${e.id as string}/edit`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <span style={{ fontSize: '0.75rem', color: textSecondary, flexShrink: 0, width: 52 }}>{date}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {unit ? (e.type as string) : (e.type === 'buy' ? 'invest' : 'withdraw')}
                </div>
                {e.notes != null && (
                  <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: 2 }}>{e.notes as string}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.875rem', color: textPrimary }}>
                  {unit ? `${Number(e.quantity).toLocaleString('pt-BR')} × ${fmt(e.priceCents)}` : fmt(e.priceCents)}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <button
        onClick={() => navigate(`/investments/${id}/events/new`)}
        style={{ ...btnPrimary, position: 'fixed', bottom: 16, left: 16, right: 16, width: 'calc(100% - 32px)', minHeight: 56, fontSize: 15, fontWeight: 500 }}
      >
        + Add event
      </button>
    </div>
  )
}
