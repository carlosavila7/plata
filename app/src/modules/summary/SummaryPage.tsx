import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAll } from '../../db/stores'
import { border, textPrimary, textSecondary, inactive } from '../../theme'
import { DatePicker } from '../../components/DatePicker'

type Row = Record<string, unknown>

const fmt = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

interface Group { name: string; total: number }

function groupBy(expenses: Row[], key: 'category' | 'subCategory'): Group[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    const name = (e[key] as string) ?? 'other'
    totals.set(name, (totals.get(name) ?? 0) + Number(e.costCents))
  }
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}

export function SummaryPage() {
  const [expenses, setExpenses] = useState<Row[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo]     = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => { getAll('expenses').then(setExpenses) }, [])

  const filtered = useMemo(() => expenses.filter(e => {
    if (e.deletedAt) return false
    const day = (e.occurredAt as string).slice(0, 10)
    if (from && day < from) return false
    if (to   && day > to)   return false
    return true
  }), [expenses, from, to])

  const grandTotal = useMemo(() => filtered.reduce((s, e) => s + Number(e.costCents), 0), [filtered])

  const rows = useMemo(() => {
    if (selectedCategory === null) return groupBy(filtered, 'category')
    return groupBy(filtered.filter(e => e.category === selectedCategory), 'subCategory')
  }, [filtered, selectedCategory])

  const maxTotal = rows.length ? rows[0].total : 0

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Link to="/" style={{ color: textSecondary, textDecoration: 'none', fontSize: 20, lineHeight: 1, marginRight: 12 }}>‹</Link>
        <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: textSecondary }}>Summary</h2>
      </div>

      {/* Date range */}
      <DatePicker label="From" value={from} onChange={setFrom} />
      <DatePicker label="To"   value={to}   onChange={setTo} />

      {/* Grand total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px 0', borderBottom: `1px solid ${border}` }}>
        <span style={{ fontSize: '0.75rem', color: textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: textPrimary }}>{fmt(grandTotal)}</span>
      </div>

      {/* Drill-down sub-header */}
      {selectedCategory !== null && (
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
          onClick={() => setSelectedCategory(null)}
        >
          <span style={{ color: textSecondary, fontSize: 18, lineHeight: 1, marginRight: 10 }}>‹</span>
          <span style={{ fontSize: '0.875rem', color: textPrimary }}>{selectedCategory}</span>
        </div>
      )}

      {/* Rows */}
      {rows.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', borderBottom: `1px solid ${border}`, paddingBottom: 16 }}>
          No expenses in this range.
        </p>
      )}

      {rows.map(({ name, total }) => {
        const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0
        const clickable = selectedCategory === null
        return (
          <div
            key={name}
            style={{ borderBottom: `1px solid ${border}`, cursor: clickable ? 'pointer' : 'default', padding: '12px 0' }}
            onClick={clickable ? () => setSelectedCategory(name) : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: '0.875rem', color: textPrimary }}>{name}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, flexShrink: 0 }}>{fmt(total)}</span>
            </div>
            {/* proportion bar */}
            <div style={{ height: 3, background: border, marginTop: 8 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: clickable ? textSecondary : inactive }} />
            </div>
          </div>
        )
      })}

    </div>
  )
}
