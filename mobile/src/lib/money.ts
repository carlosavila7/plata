export function formatMoneyCents(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

// Snapshot dates are bare YYYY-MM-DD strings with no time zone of their own.
// Formatting must pin timeZone: 'UTC' — otherwise a BRT (UTC-3) device rolls
// the date back a day (2026-08-12 midnight UTC reads as Aug 11 locally).
export function formatSnapshotDate(date: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${date}T00:00:00.000Z`))
  const day = parts.find(p => p.type === 'day')?.value ?? date
  const month = (parts.find(p => p.type === 'month')?.value ?? '').replace(/\.$/, '')
  return `${day} ${month}`
}
