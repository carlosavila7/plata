import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAll } from '../../db/stores'
import { SkeletonRows } from '../../components/Skeleton'
import { textPrimary, textSecondary, border, btnPrimary } from '../../theme'

export function CreditCardsPage() {
  const navigate = useNavigate()
  const [cards, setCards] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAll('creditCards').then((rows) => {
      rows.sort((a, b) => (a.nickname as string).localeCompare(b.nickname as string))
      setCards(rows)
      setLoading(false)
    })
  }, [])

  const fmt = (cents: unknown) =>
    cents == null ? '—' : `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ paddingBottom: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        <Link to="/" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Credit Cards</h2>
      </div>

      {loading && <SkeletonRows count={4} />}

      {!loading && cards.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No cards yet.
        </p>
      )}

      {cards.map((c) => (
        <div
          key={c.id as string}
          style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer', gap: 12 }}
          onClick={() => navigate(`/cards/${c.id as string}`)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.875rem', color: textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.nickname as string}</div>
            <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: 2 }}>{c.bank as string} · {c.network as string}</div>
          </div>
          <span style={{ fontSize: '0.75rem', color: textSecondary, flexShrink: 0 }}>{fmt(c.limitCents)}</span>
        </div>
      ))}

      <button
        onClick={() => navigate('/cards/new')}
        style={{ ...btnPrimary, position: 'fixed', bottom: 16, left: 16, right: 16, width: 'calc(100% - 32px)', minHeight: 56, fontSize: 15, fontWeight: 500 }}
      >
        + New card
      </button>
    </div>
  )
}
