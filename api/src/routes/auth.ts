import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now } from '../lib/helpers.js'
import { hashPassword, verifyPassword } from '../lib/auth.js'
import { signAccessToken, generateRefreshToken, hashToken } from '../lib/jwt.js'
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../plugins/auth.js'
import { throttleKey, retryAfterSeconds, recordFailure, recordSuccess } from '../lib/loginThrottle.js'

const Credentials = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
})

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
    return reply.status(201).send({ accessToken, user: { id: user.id, email: user.email } })
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
    return reply.send({ accessToken, user: { id: user.id, email: user.email } })
  })

  // Rotate: validate the cookie's token, revoke it, issue a new one.
  fastify.post('/auth/refresh', async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE_NAME]
    const invalid = () => reply.status(401).send({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid refresh token.',
    })
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
    return reply.send({ accessToken, user: { id: user.id, email: user.email } })
  })

  fastify.post('/auth/logout', async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE_NAME]
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
