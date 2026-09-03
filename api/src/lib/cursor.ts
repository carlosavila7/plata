import { badRequest } from './helpers.js'

/**
 * Keyset pagination cursor for lists ordered by `occurredAt desc, id desc`.
 * A composite key (rather than `occurredAt` alone) keeps pages stable when
 * rows share a timestamp, and keyset (rather than offset) keeps them stable
 * when a new row is inserted at the newest end mid-scroll.
 */
export type Cursor = { occurredAt: Date; id: string }

export function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): Cursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8')
  const sep = decoded.lastIndexOf('|')
  const occurredAtRaw = sep === -1 ? '' : decoded.slice(0, sep)
  const id = sep === -1 ? '' : decoded.slice(sep + 1)
  const occurredAt = new Date(occurredAtRaw)
  if (!id || Number.isNaN(occurredAt.getTime())) throw badRequest('Invalid cursor.')
  return { occurredAt, id }
}
