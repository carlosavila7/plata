import { getAllRaw } from '../db/stores'
import { apiClient } from '../api/client'

export interface PushLookupsSummary {
  created: number
  updated: number
  unchanged: number
}

export interface PushLookupsResult {
  expenseCategories: PushLookupsSummary
  expenseSubcategories: PushLookupsSummary
  paymentTypes: PushLookupsSummary
  cities: PushLookupsSummary
}

/**
 * One-off migration action for Settings: pushes every locally-stored category,
 * subcategory, payment type and city — including soft-deleted ones, so a local
 * delete is carried across rather than leaving a stale row on the server — to
 * `/lookups/push`. Safe to run any number of times: the server upserts by id.
 */
export async function pushLookups(): Promise<PushLookupsResult> {
  const [expenseCategories, expenseSubcategories, paymentTypes, cities] = await Promise.all([
    getAllRaw('expenseCategories'),
    getAllRaw('expenseSubcategories'),
    getAllRaw('paymentTypes'),
    getAllRaw('cities'),
  ])

  return apiClient.post<PushLookupsResult>('/lookups/push', {
    expenseCategories, expenseSubcategories, paymentTypes, cities,
  })
}
