export type FuelDetails = { fullTank?: boolean; pricePerLiterCents?: number; odometerKm?: number | null }

// Records cached in IndexedDB before the API started parsing fuelDetails still hold
// it as JSON text, and delta sync never resends an unchanged row — accept both.
export function readFuelDetails(value: unknown): FuelDetails | null {
  if (typeof value !== 'string') return (value ?? null) as FuelDetails | null
  try { return JSON.parse(value) as FuelDetails } catch { return null }
}
