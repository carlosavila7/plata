/**
 * Expense.fuelDetails is stored as JSON text (SQLite has no JSON type), but the
 * API contract — and every client — treats it as an object. Parse it on the way
 * out so no response leaks the raw string.
 */
export function toApiExpense<T extends { fuelDetails?: string | null }>(record: T) {
  const { fuelDetails } = record
  if (typeof fuelDetails !== 'string') return record
  try {
    return { ...record, fuelDetails: JSON.parse(fuelDetails) as unknown }
  } catch {
    return { ...record, fuelDetails: null }
  }
}
