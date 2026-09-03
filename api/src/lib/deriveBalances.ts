/**
 * Derived balance — the single most valuable piece of domain logic in the
 * project (see CONTEXT.md). Ported from the PWA's HomePage screen so every
 * client agrees on what an Account holds, without porting the PWA itself.
 *
 * Kept as a pure function over record sets — no HTTP, no database — so it is
 * one place to exercise directly when two clients disagree on a number. The
 * component breakdown is not incidental: with no automated tests on this
 * derivation, it is what localises a disagreement to a single term.
 */

interface AccountLike {
  id: string
}

interface SnapshotLike {
  accountId: string
  date: string // YYYY-MM-DD
  amountCents: number
  deletedAt: Date | null
}

interface IncomeLike {
  toAccountId: string
  fromAccountId: string | null
  amountCents: number
  occurredAt: Date
  deletedAt: Date | null
}

interface ExpenseLike {
  accountId: string
  paymentType: string
  costCents: number
  occurredAt: Date
  deletedAt: Date | null
}

interface CreditCardLike {
  id: string
  settlementAccountId: string | null
  deletedAt: Date | null
}

interface StatementLike {
  creditCardId: string | null
  status: string
  totalCents: number | null
  dueDate: string // YYYY-MM-DD
  deletedAt: Date | null
}

interface InvestmentPositionLike {
  id: string
  accountId: string | null
  deletedAt: Date | null
}

interface InvestmentEventLike {
  positionId: string
  type: string // buy | sell
  quantity: number
  priceCents: number
  occurredAt: Date
  deletedAt: Date | null
}

export interface DeriveBalancesInput {
  accounts: AccountLike[]
  balances: SnapshotLike[]
  income: IncomeLike[]
  expenses: ExpenseLike[]
  creditCards: CreditCardLike[]
  statements: StatementLike[]
  investmentPositions: InvestmentPositionLike[]
  investmentEvents: InvestmentEventLike[]
}

export interface DerivedAccountBalance {
  accountId: string
  amountCents: number
  snapshotDate: string | null
  snapshotAmountCents: number
  components: {
    incomeCents: number
    transfersOutCents: number
    expensesCents: number
    statementsCents: number
    investmentNetCents: number
  }
}

/**
 * One entry per Account: its Derived balance plus every component that went
 * into it. Soft-deleted records are excluded here, not left to the caller,
 * so the guarantee holds however this function is invoked.
 */
export function deriveAccountBalances(input: DeriveBalancesInput): DerivedAccountBalance[] {
  const accounts = input.accounts
  const balances = input.balances.filter(b => !b.deletedAt)
  const income = input.income.filter(i => !i.deletedAt)
  const expenses = input.expenses.filter(e => !e.deletedAt)
  const creditCards = input.creditCards.filter(c => !c.deletedAt)
  const statements = input.statements.filter(s => !s.deletedAt)
  const investmentPositions = input.investmentPositions.filter(p => !p.deletedAt)
  const investmentEvents = input.investmentEvents.filter(ev => !ev.deletedAt)

  // Statements join to Accounts through this FK — never by matching bank name.
  const settlementAccountByCard = new Map(
    creditCards
      .filter((c): c is CreditCardLike & { settlementAccountId: string } => c.settlementAccountId !== null)
      .map(c => [c.id, c.settlementAccountId]),
  )

  return accounts.map(account => {
    const accountId = account.id

    const lastSnapshot = balances
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]

    const snapshotDate = lastSnapshot?.date ?? null
    const snapshotAmountCents = lastSnapshot?.amountCents ?? 0

    // Snapshot is taken at the start of its date. A transaction counts only
    // when it falls strictly after that instant — same-day-but-later still
    // counts, but nothing at or before the snapshot instant does.
    const snapshotStart = snapshotDate ? new Date(`${snapshotDate}T00:00:00.000Z`) : null
    const after = (occurredAt: Date) => !snapshotStart || occurredAt.getTime() > snapshotStart.getTime()

    // Statements key off a date-only dueDate, and count on or after the
    // snapshot date under the same start-of-day semantics.
    const onOrAfterSnapshot = (date: string) => !snapshotDate || date >= snapshotDate

    const incomeCents = income
      .filter(i => i.toAccountId === accountId && after(i.occurredAt))
      .reduce((sum, i) => sum + i.amountCents, 0)

    // Income carrying a fromAccountId is an internal transfer — it debits the
    // source Account so transfers between own Accounts net to zero.
    const transfersOutCents = income
      .filter(i => i.fromAccountId === accountId && after(i.occurredAt))
      .reduce((sum, i) => sum + i.amountCents, 0)

    // Credit-payment Expenses are excluded here — they arrive through their
    // Statement instead.
    const expensesCents = expenses
      .filter(e => e.accountId === accountId && e.paymentType !== 'credit' && after(e.occurredAt))
      .reduce((sum, e) => sum + e.costCents, 0)

    const statementsCents = statements
      .filter(s =>
        s.creditCardId !== null &&
        settlementAccountByCard.get(s.creditCardId) === accountId &&
        (s.status === 'closed' || s.status === 'paid') &&
        onOrAfterSnapshot(s.dueDate))
      .reduce((sum, s) => sum + (s.totalCents ?? 0), 0)

    const investmentPositionIds = new Set(
      investmentPositions.filter(p => p.accountId === accountId).map(p => p.id))
    const investmentNetCents = Math.round(investmentEvents
      .filter(ev => investmentPositionIds.has(ev.positionId) && after(ev.occurredAt))
      .reduce((sum, ev) => {
        const cash = ev.quantity * ev.priceCents
        return sum + (ev.type === 'buy' ? cash : -cash)
      }, 0))

    return {
      accountId,
      snapshotDate,
      snapshotAmountCents,
      amountCents:
        snapshotAmountCents + incomeCents - expensesCents - transfersOutCents - statementsCents - investmentNetCents,
      components: {
        incomeCents,
        transfersOutCents,
        expensesCents,
        statementsCents,
        investmentNetCents,
      },
    }
  })
}
