import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now } from '../lib/helpers.js'
import { hashPassword, verifyPassword } from '../lib/auth.js'
import { signAccessToken, generateRefreshToken, hashToken } from '../lib/jwt.js'
import {
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  wantsBodyRefreshTransport,
} from '../plugins/auth.js'
import { throttleKey, retryAfterSeconds, recordFailure, recordSuccess } from '../lib/loginThrottle.js'

const Credentials = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
})

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
})

// Only include `refreshToken` in the JSON body when the caller opted in via
// the transport header (ADR-0002) — the cookie is set unconditionally either way.
function authResponseBody(
  bodyTransport: boolean,
  base: { accessToken: string; user: { id: string; email: string } },
  refreshToken: string,
) {
  return bodyTransport ? { ...base, refreshToken } : base
}

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  // Issue an access token + a fresh refresh-token row/cookie for a user.
  async function issueSession(userId: string, email: string) {
    const { token, tokenHash, expiresAt } = generateRefreshToken()
    await db().refreshToken.create({
      data: { id: newId(), userId, tokenHash, expiresAt, createdAt: now() },
    })
    return { accessToken: signAccessToken({ id: userId, email }), refreshToken: token }
  }

  fastify.post('/auth/register', async (req, reply) => {
    if (process.env.DISABLE_REGISTRATION === 'true') {
      return reply.status(403).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Forbidden',
        status: 403,
        detail: 'New account registration is currently disabled.',
      })
    }

    const { email, password } = Credentials.parse(req.body)

    const existing = await db().user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Conflict',
        status: 409,
        detail: 'A user with this email already exists.',
      })
    }

    const t = now()
    const user = await db().user.create({
      data: { id: newId(), email, passwordHash: await hashPassword(password), createdAt: t, updatedAt: t },
    })

    const { accessToken, refreshToken } = await issueSession(user.id, user.email)
    setRefreshCookie(reply, refreshToken)
    return reply.status(201).send(
      authResponseBody(wantsBodyRefreshTransport(req), { accessToken, user: { id: user.id, email: user.email } }, refreshToken),
    )
  })

  fastify.post('/auth/login', async (req, reply) => {
    const { email, password } = Credentials.parse(req.body)
    const key = throttleKey(email, req.ip)

    // Gate before the user lookup / argon2 verify: skip the work entirely while locked.
    const retry = retryAfterSeconds(key)
    if (retry > 0) {
      return reply.status(429).header('Retry-After', String(retry)).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Too Many Requests',
        status: 429,
        detail: `Too many failed login attempts. Try again in ${retry}s.`,
        retryAfter: retry,
      })
    }

    const user = await db().user.findUnique({ where: { email } })
    if (!user || user.deletedAt || !(await verifyPassword(user.passwordHash, password))) {
      recordFailure(key)
      return reply.status(401).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password.',
      })
    }

    recordSuccess(key)
    const { accessToken, refreshToken } = await issueSession(user.id, user.email)
    setRefreshCookie(reply, refreshToken)
    return reply.send(
      authResponseBody(wantsBodyRefreshTransport(req), { accessToken, user: { id: user.id, email: user.email } }, refreshToken),
    )
  })

  // Rotate: validate the presented token, revoke it, issue a new one. The token
  // comes from the cookie unless the caller opts in to body transport (ADR-0002).
  fastify.post('/auth/refresh', async (req, reply) => {
    const bodyTransport = wantsBodyRefreshTransport(req)
    const invalid = () => reply.status(401).send({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid refresh token.',
    })

    // safeParse, not .parse(): a malformed body collapses into the same generic
    // 401 as an invalid token, rather than a 400 that would reveal *why* it failed.
    let raw: string | undefined
    if (bodyTransport) {
      const parsed = RefreshBody.safeParse(req.body)
      if (!parsed.success) return invalid()
      raw = parsed.data.refreshToken
    } else {
      raw = req.cookies[REFRESH_COOKIE_NAME]
    }
    if (!raw) return invalid()

    const row = await db().refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } })
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      clearRefreshCookie(reply)
      return invalid()
    }

    const user = await db().user.findUnique({ where: { id: row.userId } })
    if (!user || user.deletedAt) {
      clearRefreshCookie(reply)
      return invalid()
    }

    await db().refreshToken.update({ where: { id: row.id }, data: { revokedAt: now() } })
    const { accessToken, refreshToken } = await issueSession(user.id, user.email)
    setRefreshCookie(reply, refreshToken)
    return reply.send(
      authResponseBody(bodyTransport, { accessToken, user: { id: user.id, email: user.email } }, refreshToken),
    )
  })

  fastify.post('/auth/logout', async (req, reply) => {
    // Revocation is shared across transports too: a body-transport client has
    // no cookie to fall back on, so honour its token the same way refresh does.
    const raw = wantsBodyRefreshTransport(req)
      ? RefreshBody.safeParse(req.body).data?.refreshToken
      : req.cookies[REFRESH_COOKIE_NAME]
    if (raw) {
      await db().refreshToken.updateMany({
        where: { tokenHash: hashToken(raw), revokedAt: null },
        data: { revokedAt: now() },
      })
    }
    clearRefreshCookie(reply)
    return reply.status(204).send()
  })

  fastify.get('/auth/me', { preHandler: (req, reply) => fastify.authenticate(req, reply) }, async (req) => {
    return req.user
  })
}

export default routes
