import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface Account {
  id: string
  name: string
  type: string
  institution: string
}

export interface ExpenseCategory {
  id: string
  name: string
}

export interface ExpenseSubcategory {
  id: string
  name: string
  categoryId: string
}

export interface PaymentType {
  id: string
  name: string
  isVoucher: boolean
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expenseCategories'],
    queryFn: () => apiClient.get<ExpenseCategory[]>('/expense-categories'),
  })
}

// Scoped to a category's id when one is passed, otherwise every subcategory —
// used both to narrow the picker once a category filter is chosen and to
// populate it unscoped before one is.
export function useExpenseSubcategories(categoryId?: string) {
  return useQuery({
    queryKey: ['expenseSubcategories', categoryId ?? null],
    queryFn: () => apiClient.get<ExpenseSubcategory[]>(`/expense-subcategories${categoryId ? `?categoryId=${categoryId}` : ''}`),
  })
}

export function usePaymentTypes() {
  return useQuery({
    queryKey: ['paymentTypes'],
    queryFn: () => apiClient.get<PaymentType[]>('/payment-types'),
  })
}
