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

// occurredAt is a real instant (unlike Balance's date-only string), so this
// formats in the device's own local timezone rather than pinning UTC. Shared
// by every entity with an occurredAt field — Expense today, Income later.
export function formatOccurredAt(occurredAt: string): string {
  const d = new Date(occurredAt)
  const date = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(/\.$/, '')
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

// Renders a Date's own local calendar day, not its UTC one — toISOString()
// would roll the date back for any timezone ahead of UTC.
export function toDateOnlyString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
