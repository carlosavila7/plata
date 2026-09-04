import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

export interface Expense {
  id: string
  occurredAt: string
  category: string
  subCategory: string
  costCents: number
  accountId: string
  paymentType: string
  creditCardStatementId: string | null
  boughtAt: string | null
  city: string | null
  description: string | null
  groupingTag: string | null
  isRecurrent: boolean
  person: string | null
  isDelivery: boolean | null
}

export interface ExpenseFilters {
  category?: string
  subCategory?: string
  paymentType?: string
  accountId?: string
  dateFrom?: string
  dateTo?: string
}

interface ExpenseListPage {
  items: Expense[]
  nextCursor?: string
}

function toQueryString(filters: ExpenseFilters, cursor?: string): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

const expenseListQueryKey = (filters: ExpenseFilters) => ['expenses', filters] as const

// Filters live in the query key, so changing any of them (via a new `filters`
// object) starts a brand-new query at page one rather than filtering the
// pages already cached under the old key — required by #11, since this
// client holds nothing locally to filter against.
export function useExpenseList(filters: ExpenseFilters) {
  return useInfiniteQuery({
    queryKey: expenseListQueryKey(filters),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.get<ExpenseListPage>(`/expenses${toQueryString(filters, pageParam)}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

// Pull-to-refresh must land back on the newest page, not replay the whole
// loaded scroll — `refetch()` on an infinite query re-requests every cached
// page in cursor order, which would re-issue one request per page already
// scrolled through. `resetQueries` would fix that but flips the query back to
// `pending`, which unmounts the list (and the pull spinner living inside it)
// for a full-skeleton flash mid-gesture. Fetching page one directly and
// overwriting the cache with just that page gets the same "back to page one"
// result while the query stays in its `success` state throughout, so the list
// and its native pull spinner never unmount.
export function useResetExpenseList(filters: ExpenseFilters) {
  const queryClient = useQueryClient()
  return async () => {
    const page = await apiClient.get<ExpenseListPage>(`/expenses${toQueryString(filters)}`)
    queryClient.setQueryData(expenseListQueryKey(filters), { pages: [page], pageParams: [undefined] })
  }
}
