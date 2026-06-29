import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAll, softDelete } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { surface, border, textPrimary, textSecondary, btnPrimary, btnSecondary, bg, inactive } from '../../theme'
import { SelectPicker } from '../../components/SelectPicker'
import { DatePicker } from '../../components/DatePicker'
import { SkeletonRows } from '../../components/Skeleton'

type Row = Record<string, unknown>

const PAGE_SIZE = 50

export function TransactionsPage() {
  const navigate = useNavigate()
  const [expenses, setExpenses]       = useState<Row[]>([])
  const [accounts, setAccounts]       = useState<Row[]>([])
  const [statements, setStatements]   = useState<Row[]>([])
  const [cardNameById, setCardNameById] = useState<Record<string, string>>({})
  const [categories, setCategories]   = useState<Row[]>([])
  const [subcategories, setSubcategories] = useState<Row[]>([])
  const [paymentTypes, setPaymentTypes]   = useState<Row[]>([])
  const [selectedExpense, setSelectedExpense] = useState<Row | null>(null)

  const [filtersOpen, setFiltersOpen]           = useState(false)
  const [filterPayment, setFilterPayment]       = useState('')
  const [filterCategory, setFilterCategory]     = useState('')
  const [filterSubcategory, setFilterSubcategory] = useState('')
  const [filterDateFrom, setFilterDateFrom]     = useState('')
  const [filterDateTo, setFilterDateTo]         = useState('')
  const [visibleCount, setVisibleCount]         = useState(PAGE_SIZE)
  const [loading, setLoading]                   = useState(true)

  async function load() {
    const [rows, accts, stmts, cats, subs, pts, cards] = await Promise.all([
      getAll('expenses'),
      getAll('accounts'),
      getAll('creditCardStatements'),
      getAll('expenseCategories'),
      getAll('expenseSubcategories'),
      getAll('paymentTypes'),
      getAll('creditCards'),
    ])
    rows.sort((a, b) => new Date(b.occurredAt as string).getTime() - new Date(a.occurredAt as string).getTime())
    setExpenses(rows)
    setCardNameById(Object.fromEntries(cards.map(c => [c.id as string, c.nickname as string])))
    setAccounts(accts)
    setStatements(stmts)
    setCategories(cats)
    setSubcategories(subs)
    setPaymentTypes(pts)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filterPayment, filterCategory, filterSubcategory, filterDateFrom, filterDateTo, expenses])

  async function handleDelete(id: string) {
    await softDelete('expenses', id)
    await enqueue('expenses', id, 'delete', { id })
    setSelectedExpense(null)
    load()
  }

  const fmt = (cents: unknown) =>
    `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const activeCount = [filterPayment, filterCategory, filterSubcategory, filterDateFrom, filterDateTo].filter(Boolean).length

  function clearFilters() {
    setFilterPayment('')
    setFilterCategory('')
    setFilterSubcategory('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const filtered = expenses.filter(e => {
    const day = (e.occurredAt as string).slice(0, 10)
    if (filterPayment     && e.paymentType !== filterPayment)     return false
    if (filterCategory    && e.category    !== filterCategory)    return false
    if (filterSubcategory && e.subCategory !== filterSubcategory) return false
    if (filterDateFrom    && day < filterDateFrom)                return false
    if (filterDateTo      && day > filterDateTo)                  return false
    return true
  })

  const visible = filtered.slice(0, visibleCount)

  const catOptions = [
    { value: '', label: 'All' },
    ...categories.map(c => ({ value: c.name as string, label: c.name as string })),
  ]

  const selectedCatId = categories.find(c => c.name === filterCategory)?.id
  const subOptions = [
    { value: '', label: 'All' },
    ...subcategories
      .filter(s => !filterCategory || s.categoryId === selectedCatId)
      .map(s => ({ value: s.name as string, label: s.name as string })),
  ]

  return (
    <div style={{ paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Link to="/" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Transactions</h2>
      </div>

      {/* Filter toggle row */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer', marginBottom: filtersOpen ? 0 : 16 }}
        onClick={() => setFiltersOpen(o => !o)}
      >
        <span style={{ fontSize: '0.875rem', color: activeCount > 0 ? textPrimary : textSecondary }}>
          {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
        </span>
        <span style={{ color: textSecondary, fontSize: 12 }}>{filtersOpen ? '▲' : '▼'}</span>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div style={{ marginBottom: 16 }}>

          {/* Payment chips */}
          <div style={{ padding: '12px 0', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontSize: '0.75rem', color: textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Payment</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {paymentTypes.map(pt => {
                const name = pt.name as string
                const active = filterPayment === name
                return (
                  <button
                    key={pt.id as string}
                    type="button"
                    onClick={() => setFilterPayment(active ? '' : name)}
                    style={{
                      background: active ? textPrimary : 'transparent',
                      color: active ? bg : textSecondary,
                      border: `1px solid ${active ? textPrimary : inactive}`,
                      borderRadius: 0, fontSize: '0.8125rem',
                      padding: '5px 10px', cursor: 'pointer',
                    }}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <SelectPicker
            label="Category"
            value={filterCategory}
            options={catOptions}
            onChange={v => { setFilterCategory(v); setFilterSubcategory('') }}
            placeholder="All"
          />

          {/* Subcategory */}
          <SelectPicker
            label="Subcategory"
            value={filterSubcategory}
            options={subOptions}
            onChange={setFilterSubcategory}
            placeholder="All"
          />

          {/* Date range */}
          <DatePicker label="From" value={filterDateFrom} onChange={setFilterDateFrom} />
          <DatePicker label="To"   value={filterDateTo}   onChange={setFilterDateTo} />

          {activeCount > 0 && (
            <button type="button" onClick={clearFilters} style={{ ...btnSecondary, width: '100%', marginTop: 8 }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading && <SkeletonRows count={8} />}

      {!loading && filtered.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No transactions yet.
        </p>
      )}

      {visible.map(e => {
        const id   = e.id as string
        const meta = `${e.category as string} · ${e.subCategory as string}`
        const date = new Date(e.occurredAt as string).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

        return (
          <div
            key={id}
            style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
            onClick={() => setSelectedExpense(e)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <span style={{ fontSize: '0.75rem', color: textSecondary, flexShrink: 0, width: 52 }}>{date}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: textPrimary }}>{meta}</div>
                {Boolean(e.description) && (
                  <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: 2 }}>{e.description as string}</div>
                )}
              </div>
              <span style={{ color: textPrimary, fontWeight: 600, fontSize: 15, flexShrink: 0 }}>{fmt(e.costCents)}</span>
            </div>
          </div>
        )
      })}

      {visibleCount < filtered.length && (
        <button
          type="button"
          onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
          style={{ ...btnSecondary, width: '100%', marginTop: 16 }}
        >
          Load more ({filtered.length - visibleCount} remaining)
        </button>
      )}

      <button
        onClick={() => navigate('/expenses/new')}
        style={{ ...btnPrimary, position: 'fixed', bottom: 16, left: 16, right: 16, width: 'calc(100% - 32px)', minHeight: 56, fontSize: 15, fontWeight: 500 }}
      >
        + Add
      </button>

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          accounts={accounts}
          statements={statements}
          cardNameById={cardNameById}
          onClose={() => setSelectedExpense(null)}
          onDelete={() => handleDelete(selectedExpense.id as string)}
          onEdit={() => navigate(`/expenses/${selectedExpense.id as string}/edit`)}
        />
      )}
    </div>
  )
}

function ExpenseDetailModal({
  expense, accounts, statements, cardNameById, onClose, onDelete, onEdit,
}: {
  expense: Row; accounts: Row[]; statements: Row[]; cardNameById: Record<string, string>
  onClose: () => void; onDelete: () => void; onEdit: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const brt = new Date(new Date(expense.occurredAt as string).getTime() - 3 * 60 * 60 * 1000).toISOString()
  const date = new Date(brt.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR')
  const time = brt.slice(11, 16)

  const account = accounts.find(a => a.id === expense.accountId)
  const statement = statements.find(s => s.id === expense.creditCardStatementId)
  const statementLabel = statement
    ? `${cardNameById[statement.creditCardId as string] ?? 'Card'} · ${new Date(statement.closeDate as string).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`
    : null

  const fd = (expense.fuelDetails ?? null) as { fullTank?: boolean; pricePerLiterCents?: number; odometerKm?: number } | null
  const fmt = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: surface, borderTop: `1px solid ${border}`, maxHeight: '85dvh', overflowY: 'auto', padding: '8px 16px 40px' }}
        onClick={e => e.stopPropagation()}
      >
        <DetailRow label="Date"       value={date} />
        <DetailRow label="Time"       value={time} />
        <DetailRow label="Category"   value={expense.category as string} />
        <DetailRow label="Subcategory" value={expense.subCategory as string} />
        <DetailRow label="Amount"     value={fmt(expense.costCents as number)} />
        <DetailRow label="Account"    value={account?.name as string} />
        <DetailRow label="Payment"    value={expense.paymentType as string} />
        {statementLabel && <DetailRow label="Statement" value={statementLabel} />}
        <DetailRow label="Bought at"  value={expense.boughtAt as string} />
        <DetailRow label="Description" value={expense.description as string} />
        <DetailRow label="City"       value={expense.city as string} />
        <DetailRow label="Person"     value={expense.person as string} />
        {expense.category === 'food' && <DetailRow label="Delivery" value={(expense.isDelivery as boolean) ? 'Yes' : 'No'} />}
        <DetailRow label="Recurrent"  value={(expense.isRecurrent as boolean) ? 'Yes' : 'No'} />
        {fd && (
          <>
            <DetailRow label="Full tank"    value={fd.fullTank ? 'Yes' : 'No'} />
            {fd.pricePerLiterCents != null && <DetailRow label="Price / liter" value={fmt(fd.pricePerLiterCents)} />}
            {fd.odometerKm        != null && <DetailRow label="Odometer"      value={`${fd.odometerKm} km`} />}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {confirmDelete ? (
            <>
              <button onClick={onDelete}                    style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ ...btnPrimary,   flex: 1, minHeight: 52 }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete</button>
              <button onClick={onEdit}                      style={{ ...btnPrimary,   flex: 1, minHeight: 52 }}>Edit</button>
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
