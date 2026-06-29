import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db/schema'

export type SyncOperation = 'create' | 'update' | 'delete'

export async function enqueue(
  entity: string,
  entityId: string,
  operation: SyncOperation,
  payload: Record<string, unknown>,
) {
  const db = await getDB()
  await db.put('syncQueue', {
    id: uuidv4(),
    entity,
    entityId,
    operation,
    payload,
    queuedAt: new Date().toISOString(),
  })
}
