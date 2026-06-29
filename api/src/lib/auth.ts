import { hash, verify } from '@node-rs/argon2'

/** Hash a plaintext password with argon2 (defaults: argon2id, memory-hard). */
export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

/** Verify a plaintext password against a stored argon2 hash. */
export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password)
}
