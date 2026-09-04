import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface SummaryRow {
  category: string
  totalCents: number
}

export interface ExpenseSummary {
  totalCents: number
  rows: SummaryRow[]
}

interface CategorySummaryResponse {
  categories: { category: string; totalCents: number }[]
  totalCents: number
}

interface SubCategorySummaryResponse {
  subcategories: { subCategory: string; totalCents: number }[]
  totalCents: number
}

function sortDescending(rows: SummaryRow[]): SummaryRow[] {
  return [...rows].sort((a, b) => b.totalCents - a.totalCents)
}

// Category totals for the range, largest first, reading the grouped result
// straight from #6's endpoint instead of pulling every Expense ever recorded
// like the PWA's version does (see #14).
export function useExpenseCategorySummary(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['expenseSummary', dateFrom, dateTo],
    queryFn: async (): Promise<ExpenseSummary> => {
      const params = new URLSearchParams({ dateFrom, dateTo })
      const res = await apiClient.get<CategorySummaryResponse>(`/expenses/summary?${params}`)
      return { totalCents: res.totalCents, rows: sortDescending(res.categories) }
    },
  })
}

// Subcategory breakdown for one category within the same range — the drill-down.
export function useExpenseSubCategorySummary(dateFrom: string, dateTo: string, category: string | null) {
  return useQuery({
    queryKey: ['expenseSummary', dateFrom, dateTo, category],
    queryFn: async (): Promise<ExpenseSummary> => {
      if (category === null) throw new Error('useExpenseSubCategorySummary: category is required once enabled')
      const params = new URLSearchParams({ dateFrom, dateTo, category })
      const res = await apiClient.get<SubCategorySummaryResponse>(`/expenses/summary?${params}`)
      const rows = res.subcategories.map(r => ({ category: r.subCategory, totalCents: r.totalCents }))
      return { totalCents: res.totalCents, rows: sortDescending(rows) }
    },
    enabled: category !== null,
  })
}
