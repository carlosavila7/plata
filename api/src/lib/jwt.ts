import jwt from 'jsonwebtoken'
import { randomBytes, createHash } from 'node:crypto'

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET ?? 'dev-access-secret-change-me'
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m'
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30)

export interface AuthUser {
  id: string
  email: string
}

/** Sign a short-lived access token. `sub` carries the user id. */
export function signAccessToken(user: AuthUser): string {
  const options: jwt.SignOptions = {
    subject: user.id,
    expiresIn: ACCESS_TTL as jwt.SignOptions['expiresIn'],
  }
  return jwt.sign({ email: user.email }, ACCESS_SECRET, options)
}

/** Verify an access token and return the identity it carries. Throws if invalid/expired. */
export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload
  return { id: String(payload.sub), email: String(payload.email) }
}

/**
 * Mint an opaque refresh token. The raw value goes to the client (httpOnly cookie);
 * only its hash is persisted, so tokens are revocable and never recoverable from the DB.
 */
export function generateRefreshToken() {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  return { token, tokenHash: hashToken(token), expiresAt }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60
