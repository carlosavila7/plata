import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAll, softDelete } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { SkeletonRows } from '../../components/Skeleton'
import { surface, border, textPrimary, textSecondary, btnPrimary, btnSecondary } from '../../theme'

export function IncomePage() {
  const navigate = useNavigate()
  const [incomes, setIncomes] = useState<Record<string, unknown>[]>([])
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])
  const [selectedIncome, setSelectedIncome] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [rows, accts] = await Promise.all([getAll('income'), getAll('accounts')])
    rows.sort((a, b) => new Date(b.occurredAt as string).getTime() - new Date(a.occurredAt as string).getTime())
    setIncomes(rows)
    setAccounts(accts)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    await softDelete('income', id)
    await enqueue('income', id, 'delete', { id })
    setSelectedIncome(null)
    load()
  }

  const fmt = (cents: unknown) =>
    `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ paddingBottom: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        <Link to="/" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Income</h2>
      </div>

      {loading && <SkeletonRows count={5} />}

      {!loading && incomes.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No income records yet.
        </p>
      )}

      {incomes.map((item) => {
        const id = item.id as string
        const date = new Date(item.occurredAt as string).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

        return (
          <div
            key={id}
            style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
            onClick={() => setSelectedIncome(item)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <span style={{ fontSize: '0.75rem', color: textSecondary, flexShrink: 0, width: 52 }}>{date}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: textPrimary }}>{item.reason as string}</div>
                {Boolean(item.description) && (
                  <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: 2 }}>{item.description as string}</div>
                )}
              </div>
              <span style={{ color: textPrimary, fontWeight: 600, fontSize: 15, flexShrink: 0 }}>{fmt(item.amountCents)}</span>
            </div>
          </div>
        )
      })}

      <button
        onClick={() => navigate('/income/new')}
        style={{ ...btnPrimary, position: 'fixed', bottom: 16, left: 16, right: 16, width: 'calc(100% - 32px)', minHeight: 56, fontSize: 15, fontWeight: 500 }}
      >
        + Add
      </button>

      {selectedIncome && (
        <IncomeDetailModal
          income={selectedIncome}
          accounts={accounts}
          onClose={() => setSelectedIncome(null)}
          onDelete={() => handleDelete(selectedIncome.id as string)}
          onEdit={() => navigate(`/income/${selectedIncome.id as string}/edit`)}
        />
      )}
    </div>
  )
}

function IncomeDetailModal({
  income,
  accounts,
  onClose,
  onDelete,
  onEdit,
}: {
  income: Record<string, unknown>
  accounts: Record<string, unknown>[]
  onClose: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const brt = new Date(new Date(income.occurredAt as string).getTime() - 3 * 60 * 60 * 1000).toISOString()
  const date = new Date(brt.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR')
  const time = brt.slice(11, 16)

  const toAccount = accounts.find(a => a.id === income.toAccountId)
  const fromAccount = accounts.find(a => a.id === income.fromAccountId)
  const fmt = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: surface, borderTop: `1px solid ${border}`, maxHeight: '85dvh', overflowY: 'auto', padding: '8px 16px 40px' }}
        onClick={e => e.stopPropagation()}
      >
        <DetailRow label="Date" value={date} />
        <DetailRow label="Time" value={time} />
        <DetailRow label="Reason" value={income.reason as string} />
        <DetailRow label="Amount" value={fmt(income.amountCents as number)} />
        <DetailRow label="To account" value={toAccount?.name as string} />
        <DetailRow label="From account" value={fromAccount?.name as string} />
        <DetailRow label="Description" value={income.description as string} />

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {confirmDelete ? (
            <>
              <button onClick={onDelete} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete</button>
              <button onClick={onEdit} style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Edit</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0', borderBottom: `1px solid ${border}` }}>
      <span style={{ fontSize: '0.875rem', color: textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 15, color: textPrimary, textAlign: 'right', marginLeft: 16 }}>{value}</span>
    </div>
  )
}
