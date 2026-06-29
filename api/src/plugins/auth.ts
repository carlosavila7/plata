import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyAccessToken, REFRESH_TTL_SECONDS, type AuthUser } from '../lib/jwt.js'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    // Set by `authenticate`. Ownership enforcement off this is a later iteration.
    user?: AuthUser
  }
}

export const REFRESH_COOKIE_NAME = 'refreshToken'
const isProd = process.env.NODE_ENV === 'production'

/** Throw an RFC 7807-shaped 401 (formatted by the global error handler). */
function unauthorized(detail: string) {
  const err = new Error(detail) as Error & { statusCode?: number }
  err.name = 'Unauthorized'
  err.statusCode = 401
  return err
}

export function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    // Scoped to '/' (not '/auth') so the cookie is sent on the refresh request
    // even when the PWA reaches the API through the '/api' nginx proxy prefix
    // (browser would otherwise never send a Path=/auth cookie to /api/auth/refresh).
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  })
}

export function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' })
}

export default fp(async (fastify) => {
  await fastify.register(cookie)

  // Verifies the bearer access token and attaches `req.user`. Used both as a
  // per-route preHandler and by the global guard hook in index.ts.
  fastify.decorate('authenticate', async (req: FastifyRequest) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Missing bearer token.')
    }
    try {
      req.user = verifyAccessToken(header.slice('Bearer '.length))
    } catch {
      throw unauthorized('Invalid or expired access token.')
    }
  })
})
