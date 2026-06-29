import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAll } from '../../db/stores'
import { SkeletonRows } from '../../components/Skeleton'
import { border, textPrimary, textSecondary } from '../../theme'

const ENTITIES = [
  { label: 'Expenses',     to: '/expenses'    },
  { label: 'Summary',      to: '/summary'     },
  { label: 'Income',       to: '/income'      },
  { label: 'Balances',     to: '/balances'    },
  { label: 'Credit Cards', to: '/cards'       },
  { label: 'Investments',  to: '/investments' },
  { label: 'Settings',     to: '/settings'   },
]

interface AccountBalance {
  name: string
  amountCents: number
}

export function HomePage() {
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getAll('accounts'),
      getAll('balances'),
      getAll('income'),
      getAll('expenses'),
      getAll('creditCardStatements'),
      getAll('creditCards'),
      getAll('investmentPositions'),
      getAll('investmentEvents'),
    ]).then(([accounts, snapshots, incomes, expenses, statements, cards, positions, events]) => {
      const bankByCard = new Map(cards.filter(c => !c.deletedAt).map(c => [c.id as string, c.bank as string]))
      const computed = accounts
        .filter(a => !a.deletedAt)
        .map(account => {
          const accountId = account.id as string
          const accountName = account.name as string

          const lastSnapshot = snapshots
            .filter(b => b.accountId === accountId && !b.deletedAt)
            .sort((a, b) => (b.date as string).localeCompare(a.date as string))[0]

          const snapshotDate = (lastSnapshot?.date as string) ?? null
          const snapshotAmount = (lastSnapshot?.amountCents as number) ?? 0

          // Snapshot is taken at the start of its date, so any transaction whose
          // datetime falls on or after that date counts. Comparing the full
          // ISO datetime against the date string gives start-of-day semantics:
          // same-day transactions ("...T08:00Z" > "YYYY-MM-DD") are included.
          const after = (occurredAt: string) =>
            !snapshotDate || occurredAt > snapshotDate

          // Date-only counterpart for statement dueDate (YYYY-MM-DD). Uses >= so a
          // statement due ON the snapshot date still counts under start-of-day.
          const afterDate = (date: string) =>
            !snapshotDate || (!!date && date >= snapshotDate)

          const incomeTotal = incomes
            .filter(i => i.toAccountId === accountId && !i.deletedAt && after(i.occurredAt as string))
            .reduce((sum, i) => sum + (i.amountCents as number), 0)

          // Internal transfers (income with a fromAccountId) move money OUT of the
          // source account — debit it so transfers between own accounts net to zero.
          const transfersOut = incomes
            .filter(i => i.fromAccountId === accountId && !i.deletedAt && after(i.occurredAt as string))
            .reduce((sum, i) => sum + (i.amountCents as number), 0)

          // Credit expenses are ignored here — credit-card spending hits the
          // balance through its statement total instead (see statementTotal).
          const expenseTotal = expenses
            .filter(e =>
              e.accountId === accountId &&
              !e.deletedAt &&
              e.paymentType !== 'credit' &&
              after(e.occurredAt as string))
            .reduce((sum, e) => sum + (e.costCents as number), 0)

          // Subtract every closed/paid statement for this account's bank whose
          // dueDate falls after the snapshot cutoff.
          const statementTotal = statements
            .filter(s =>
              !s.deletedAt &&
              bankByCard.get(s.creditCardId as string) === accountName &&
              (s.status === 'closed' || s.status === 'paid') &&
              afterDate(s.dueDate as string))
            .reduce((sum, s) => sum + ((s.totalCents as number) ?? 0), 0)

          // Investments funded from this account move cash out on buys and back in
          // on sells. Net cash out = Σ(buy qty×price) − Σ(sell qty×price) for events
          // after the snapshot cutoff, across positions linked to this account.
          const investPositionIds = new Set(
            positions.filter(p => !p.deletedAt && p.accountId === accountId).map(p => p.id))
          const investmentNet = Math.round(events
            .filter(ev =>
              !ev.deletedAt &&
              investPositionIds.has(ev.positionId) &&
              after(ev.occurredAt as string))
            .reduce((sum, ev) => {
              const cash = Number(ev.quantity) * Number(ev.priceCents)
              return sum + (ev.type === 'buy' ? cash : -cash)
            }, 0))

          return {
            name: accountName,
            amountCents: snapshotAmount + incomeTotal - expenseTotal - transfersOut - statementTotal - investmentNet,
          }
        })

      setAccountBalances(computed)
      setLoading(false)
    })
  }, [])

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div>
      {(loading || accountBalances.length > 0) && (
        <div style={{ marginBottom: 32 }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase', paddingBottom: 8 }}>
            Balance
          </span>
          {loading && <SkeletonRows count={4} />}
          {!loading && accountBalances.map(({ name, amountCents }) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
              <span style={{ fontSize: '0.875rem', color: textSecondary }}>{name}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary }}>{fmt(amountCents)}</span>
            </div>
          ))}
        </div>
      )}

      {ENTITIES.map(({ label, to }) => (
        <Link
          key={to}
          to={to}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            textDecoration: 'none',
            color: textPrimary,
            borderBottom: `1px solid ${border}`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 400 }}>{label}</span>
          <span style={{ fontSize: 14, color: textSecondary }}>→</span>
        </Link>
      ))}
    </div>
  )
}
