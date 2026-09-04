import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

interface Account {
  id: string
  name: string
}

export interface DerivedBalanceComponents {
  incomeCents: number
  transfersOutCents: number
  expensesCents: number
  statementsCents: number
  investmentNetCents: number
}

interface DerivedBalance {
  accountId: string
  amountCents: number
  snapshotDate: string | null
  snapshotAmountCents: number
  components: DerivedBalanceComponents
}

export interface AccountDerivedBalance extends DerivedBalance {
  name: string
}

const ZERO_COMPONENTS: DerivedBalanceComponents = {
  incomeCents: 0,
  transfersOutCents: 0,
  expensesCents: 0,
  statementsCents: 0,
  investmentNetCents: 0,
}

// The derived-balance endpoint (#5) carries no Account name — it's keyed by
// accountId, same as every other domain entity. Accounts is the small, rarely
// changing side, so it's fetched alongside and joined here rather than asking
// the endpoint to duplicate what /accounts already owns.
async function fetchDerivedBalances(): Promise<AccountDerivedBalance[]> {
  const [accounts, derived] = await Promise.all([
    apiClient.get<Account[]>('/accounts'),
    apiClient.get<DerivedBalance[]>('/balances/derived'),
  ])
  const derivedByAccountId = new Map(derived.map(d => [d.accountId, d]))

  return accounts.map(account => {
    const d = derivedByAccountId.get(account.id)
    return {
      accountId: account.id,
      name: account.name,
      amountCents: d?.amountCents ?? 0,
      snapshotDate: d?.snapshotDate ?? null,
      snapshotAmountCents: d?.snapshotAmountCents ?? 0,
      components: d?.components ?? ZERO_COMPONENTS,
    }
  })
}

export function useDerivedBalances() {
  return useQuery({
    queryKey: ['derivedBalances'],
    queryFn: fetchDerivedBalances,
  })
}
