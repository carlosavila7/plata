import { getDB } from '../db/schema'

export interface SessionUser {
  id: string
  email: string
}

// Persisted in the existing `meta` IndexedDB store. Its presence is what lets the
// app open and use local data OFFLINE after a first successful login.
const KEY = 'authedUser'

export async function saveSession(user: SessionUser): Promise<void> {
  const db = await getDB()
  await db.put('meta', JSON.stringify(user), KEY)
}

export async function loadSession(): Promise<SessionUser | null> {
  const db = await getDB()
  const raw = await db.get('meta', KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const db = await getDB()
  await db.delete('meta', KEY)
}
