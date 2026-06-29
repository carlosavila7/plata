import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAll, getById } from '../../db/stores'
import { border, textPrimary, textSecondary } from '../../theme'

export function StatementExpensesPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([])
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null)
  const [card, setCard] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    Promise.all([
      getAll('creditCardStatements'),
      getAll('expenses'),
      id ? getById('creditCards', id) : Promise.resolve(null),
    ]).then(([stmts, exps, c]) => {
      const stmt = (stmts as Record<string, unknown>[]).find(s => s.id === sid) ?? null
      setStatement(stmt)
      setCard((c as Record<string, unknown>) ?? null)
      const filtered = (exps as Record<string, unknown>[])
        .filter(e => e.creditCardStatementId === sid && !e.deletedAt)
        .sort((a, b) => new Date(b.occurredAt as string).getTime() - new Date(a.occurredAt as string).getTime())
      setExpenses(filtered)
    })
  }, [id, sid])

  const fmt = (cents: unknown) =>
    `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const totalCents = expenses.reduce((sum, e) => sum + (e.costCents as number), 0)

  const stmtLabel = statement
    ? `${(card?.nickname as string) ?? 'Card'} · ${new Date((statement.closeDate as string) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
    : ''

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        <Link to={`/cards/${id}`} style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, flex: 1, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>
          {stmtLabel || 'Statement'}
        </h2>
        <button
          onClick={() => navigate(`/cards/${id}/statements/${sid}/edit`)}
          style={{ background: 'transparent', border: 'none', color: textPrimary, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}
        >
          Edit ›
        </button>
      </div>

      {expenses.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No expenses for this statement.
        </p>
      )}

      {expenses.map((e) => {
        const date = new Date(e.occurredAt as string).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        const meta = `${e.category as string} · ${e.subCategory as string}`
        return (
          <div key={e.id as string} style={{ borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <span style={{ fontSize: '0.75rem', color: textSecondary, flexShrink: 0, width: 52 }}>{date}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: textPrimary }}>{meta}</div>
                {e.description && (
                  <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: 2 }}>{e.description as string}</div>
                )}
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, flexShrink: 0 }}>{fmt(e.costCents)}</span>
            </div>
          </div>
        )
      })}

      {expenses.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0' }}>
          <span style={{ fontSize: '0.875rem', color: textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary }}>{fmt(totalCents)}</span>
        </div>
      )}
    </div>
  )
}
