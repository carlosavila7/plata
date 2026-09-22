import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { toApiExpense } from '../lib/expense.js'

type Operation = 'create' | 'update' | 'delete'
type Entity = 'accounts' | 'balances' | 'expenses' | 'income' | 'creditCards' | 'creditCardStatements' | 'investmentPositions' | 'investmentEvents'

interface QueueItem {
  id: string
  entity: Entity
  entityId: string
  operation: Operation
  payload: Record<string, unknown>
  queuedAt: string
}

const TABLE_MAP: Record<Entity, keyof PrismaClient> = {
  accounts:             'account',
  balances:             'balance',
  expenses:             'expense',
  income:               'income',
  creditCards:          'creditCard',
  creditCardStatements: 'creditCardStatement',
  investmentPositions:  'investmentPosition',
  investmentEvents:     'investmentEvent',
}

// Columns stored as JSON text (SQLite has no JSON type). Clients queue them as
// objects, so serialize before handing the payload to Prisma — the same thing the
// REST routes do (see POST /expenses).
const JSON_COLUMNS: Partial<Record<Entity, string[]>> = {
  expenses: ['fuelDetails'],
}

function toRow(entity: Entity, payload: Record<string, unknown>): Record<string, unknown> {
  const columns = JSON_COLUMNS[entity]
  if (!columns) return payload
  const row = { ...payload }
  for (const col of columns) {
    if (row[col] != null && typeof row[col] !== 'string') row[col] = JSON.stringify(row[col])
  }
  return row
}

// Inverse of toRow for records sent back to the client.
function fromRow(entity: Entity, record: Record<string, unknown>) {
  return entity === 'expenses' ? toApiExpense(record as { fuelDetails?: string | null }) : record
}

export async function processBatch(prisma: PrismaClient, userId: string, items: QueueItem[]) {
  const results: Array<{ id: string; status: 'ok' | 'conflict' | 'error'; record?: unknown; error?: string }> = []

  // Sort chronologically so later writes win on conflict
  const sorted = [...items].sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())

  for (const item of sorted) {
    const table = TABLE_MAP[item.entity]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = (prisma as any)[table]
    try {
      const incomingUpdatedAt = item.payload.updatedAt ? new Date(item.payload.updatedAt as string) : new Date()

      // Data ownership: a write may only ever touch a row the caller owns. Scope
      // delete/update by userId, and confirm an existing row's owner before mutating.
      if (item.operation === 'delete') {
        await repo.updateMany({
          where: { id: item.entityId, userId },
          data: { deletedAt: incomingUpdatedAt, updatedAt: incomingUpdatedAt },
        })
        results.push({ id: item.id, status: 'ok' })
        continue
      }

      const existing = await repo.findUnique({ where: { id: item.entityId } }).catch(() => null)

      // A row exists but belongs to someone else → never create or mutate across owners.
      if (existing && existing.userId !== userId) {
        results.push({ id: item.id, status: 'error', error: 'Not owned by requester.' })
        continue
      }

      if (!existing) {
        // Force userId from the session — never trust a client-supplied owner.
        const record = await repo.create({
          data: { ...toRow(item.entity, item.payload), userId, id: item.entityId, createdAt: incomingUpdatedAt, updatedAt: incomingUpdatedAt },
        })
        results.push({ id: item.id, status: 'ok', record: fromRow(item.entity, record) })
        continue
      }

      // Conflict resolution: last write wins by updatedAt
      if (new Date(existing.updatedAt) > incomingUpdatedAt) {
        results.push({ id: item.id, status: 'conflict', record: fromRow(item.entity, existing) })
        continue
      }

      const record = await repo.update({
        where: { id: item.entityId },
        data: { ...toRow(item.entity, item.payload), userId, updatedAt: incomingUpdatedAt },
      })
      results.push({ id: item.id, status: 'ok', record: fromRow(item.entity, record) })
    } catch (err) {
      results.push({ id: item.id, status: 'error', error: String(err) })
    }
  }

  return results
}
