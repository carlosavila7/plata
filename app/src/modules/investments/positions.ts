import { v4 as uuidv4 } from 'uuid'
import { getById, getAll, upsert } from '../../db/stores'
import { enqueue } from '../../sync/queue'

export interface PositionTotals {
  quantity: number
  avgPriceCents: number
}

/**
 * Asset types entered as "quantity × unit price" (shares/coins). Everything else
 * (fund, fixed_income, other) is entered as a single invested amount.
 */
export const UNIT_BASED_ASSET_TYPES = ['stock', 'crypto']

export function isUnitBased(assetType?: string): boolean {
  return assetType ? UNIT_BASED_ASSET_TYPES.includes(assetType) : true
}

/**
 * Projection of a position from its events.
 *
 * Unit-based (stock/crypto) — weighted-average cost:
 *   - buy: adds to quantity and cost basis
 *   - sell: reduces quantity at the running average; does NOT change avg price
 *
 * Amount-based (fund/fixed_income/other) — net invested amount, stored as
 *   quantity = 1 and avgPriceCents = net, so Total (qty × avg) = net invested:
 *   - buy (invest): adds its amount (priceCents) to the net
 *   - sell (withdraw): subtracts its amount from the net
 */
export function computePositionTotals(events: Record<string, unknown>[], assetType?: string): PositionTotals {
  const sorted = [...events]
    .filter((e) => !e.deletedAt)
    .sort((a, b) => {
      const t = new Date(a.occurredAt as string).getTime() - new Date(b.occurredAt as string).getTime()
      if (t !== 0) return t
      return new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
    })

  if (!isUnitBased(assetType)) {
    let netCents = 0
    for (const e of sorted) {
      const amt = Number(e.priceCents)
      if (!Number.isFinite(amt)) continue
      if (e.type === 'buy') netCents += amt
      else if (e.type === 'sell') netCents -= amt
    }
    netCents = Math.max(0, Math.round(netCents))
    return { quantity: netCents > 0 ? 1 : 0, avgPriceCents: netCents }
  }

  let qty = 0
  let costBasisCents = 0

  for (const e of sorted) {
    const eQty = Number(e.quantity)
    const ePrice = Number(e.priceCents)
    if (!Number.isFinite(eQty) || eQty <= 0) continue

    if (e.type === 'buy') {
      qty += eQty
      costBasisCents += eQty * ePrice
    } else if (e.type === 'sell') {
      if (qty <= 0) continue
      const avg = costBasisCents / qty
      const sellQty = Math.min(eQty, qty)
      qty -= sellQty
      costBasisCents -= sellQty * avg
      if (qty <= 1e-9) {
        qty = 0
        costBasisCents = 0
      }
    }
  }

  return {
    quantity: qty,
    avgPriceCents: qty > 0 ? Math.round(costBasisCents / qty) : 0,
  }
}

/**
 * Recompute a position's quantity/avgPriceCents from its events and persist + enqueue
 * the change. No-op if the position is missing/deleted or the totals are unchanged.
 */
export async function recomputePosition(positionId: string): Promise<void> {
  const pos = await getById('investmentPositions', positionId)
  if (!pos || pos.deletedAt) return

  const allEvents = (await getAll('investmentEvents')) as Record<string, unknown>[]
  const events = allEvents.filter((e) => e.positionId === positionId)
  const { quantity, avgPriceCents } = computePositionTotals(events, pos.assetType as string)

  if (pos.quantity === quantity && pos.avgPriceCents === avgPriceCents) return

  const updated = { ...pos, quantity, avgPriceCents, updatedAt: new Date().toISOString() }
  await upsert('investmentPositions', updated)
  await enqueue('investmentPositions', positionId, 'update', updated)
}

/**
 * Create a new position from event-entry metadata. quantity/avgPriceCents start at 0 and are
 * filled in by recomputePosition once events exist. Returns the new position id.
 */
export async function createPosition(
  { name, assetType, accountId }: { name: string; assetType: string; accountId: string | null },
): Promise<string> {
  const id = uuidv4()
  const now = new Date().toISOString()
  const record = {
    id,
    name,
    assetType,
    accountId,
    quantity: 0,
    avgPriceCents: 0,
    currentPriceCents: null,
    lastPriceUpdatedAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await upsert('investmentPositions', record)
  await enqueue('investmentPositions', id, 'create', record)
  return id
}
