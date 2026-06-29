import type { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

export function newId() { return uuidv4() }
export function now() { return new Date() }

/** Build a `where` filter that excludes soft-deleted records and optionally applies `?since=` */
export function baseWhere(since?: string) {
  return {
    deletedAt: null,
    ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
  }
}

/**
 * Data-ownership variant of `baseWhere`: also scopes to a single user so reads
 * never cross the owner boundary. Use for every ownable domain entity.
 */
export function ownedWhere(userId: string, since?: string) {
  return { ...baseWhere(since), userId }
}

/** Throw an RFC 7807-shaped 404 (formatted by the global error handler). */
function notFound(detail: string) {
  const err = new Error(detail) as Error & { statusCode?: number }
  err.name = 'Not Found'
  err.statusCode = 404
  return err
}

/**
 * Assert that a referenced record exists AND belongs to `userId`. Used to validate
 * foreign keys on create/update (e.g. an expense's accountId must be the caller's),
 * so a user can never attach their records to another user's parent. Returns a
 * uniform 404 for both "missing" and "not yours" — no ownership leak via status.
 */
export type OwnableModel =
  | 'account' | 'balance' | 'expense' | 'income'
  | 'creditCard' | 'creditCardStatement' | 'investmentPosition' | 'investmentEvent'

export async function assertOwned(
  prisma: PrismaClient,
  model: OwnableModel,
  id: string,
  userId: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = await (prisma as any)[model].findFirst({ where: { id, userId, deletedAt: null } })
  if (!found) throw notFound(`Referenced ${model} ${id} not found.`)
}
