import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAll } from '../../db/stores'
import { isUnitBased } from './positions'
import { SkeletonRows } from '../../components/Skeleton'
import { textPrimary, textSecondary, cardStyle, btnPrimary } from '../../theme'

export function InvestmentsPage() {
  const navigate = useNavigate()
  const [positions, setPositions] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAll('investmentPositions').then((rows) => {
      setPositions(rows)
      setLoading(false)
    })
  }, [])

  const fmt = (cents: unknown) =>
    cents == null ? '—' : `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  function allocatedValue(pos: Record<string, unknown>) {
    const qty = Number(pos.quantity)
    const avg = Number(pos.avgPriceCents)
    return Math.round(qty * avg)
  }

  return (
    <div style={{ paddingBottom: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <Link to="/" style={{ color: textSecondary, textDecoration: 'none', fontSize: 18, lineHeight: 1, marginRight: 8 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: textPrimary }}>Investments</h2>
      </div>
      {loading && <SkeletonRows count={4} />}
      {!loading && positions.length === 0 && <p style={{ color: textSecondary, fontSize: 13 }}>No positions yet.</p>}
      {positions.map((pos) => (
        <div
          key={pos.id as string}
          style={{ ...cardStyle, cursor: 'pointer' }}
          onClick={() => navigate(`/investments/${pos.id as string}`)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: textPrimary }}>{pos.name as string}</span>
            <span style={{ fontSize: 11, color: textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{pos.assetType as string}</span>
          </div>
          <div style={{ fontSize: 12, marginTop: 8, display: 'flex', gap: 16, color: textSecondary }}>
            {isUnitBased(pos.assetType as string) && (
              <>
                <span>Qty: {Number(pos.quantity).toLocaleString('pt-BR')}</span>
                <span>Avg: {fmt(pos.avgPriceCents)}</span>
              </>
            )}
            <span>Total: {fmt(allocatedValue(pos))}</span>
          </div>
          {(pos.notes as string | undefined) && <div style={{ fontSize: 12, color: textSecondary, marginTop: 6 }}>{pos.notes as string}</div>}
        </div>
      ))}

      <button
        onClick={() => navigate('/investments/events/new')}
        style={{ ...btnPrimary, position: 'fixed', bottom: 16, left: 16, right: 16, width: 'calc(100% - 32px)', minHeight: 56, fontSize: 15, fontWeight: 500 }}
      >
        + Add event
      </button>
    </div>
  )
}
