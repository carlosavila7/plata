import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'

const ASSET_TYPES = ['stock', 'fund', 'fixed_income', 'crypto', 'other'] as const

const PositionBody = z.object({
  name:               z.string().min(1),
  assetType:          z.enum(ASSET_TYPES),
  accountId:          z.string().optional().nullable(),
  quantity:           z.number().positive(),
  avgPriceCents:      z.number().int().nonnegative(),
  currentPriceCents:  z.number().int().nonnegative().optional().nullable(),
  lastPriceUpdatedAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes:              z.string().optional().nullable(),
})

const EventBody = z.object({
  type:       z.enum(['buy', 'sell']),
  occurredAt: z.string().datetime({ offset: true }),
  quantity:   z.number().positive(),
  priceCents: z.number().int().positive(),
  notes:      z.string().optional().nullable(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  // ---- Positions ----
  fastify.get('/investments', async (req) => {
    const userId = req.user!.id
    const { since } = req.query as { since?: string }
    return db().investmentPosition.findMany({ where: ownedWhere(userId, since) })
  })

  fastify.post('/investments', async (req, reply) => {
    const userId = req.user!.id
    const body = PositionBody.parse(req.body)
    if (body.accountId) await assertOwned(db(), 'account', body.accountId, userId)
    const t = now()
    const record = await db().investmentPosition.create({
      data: {
        ...body,
        userId,
        id: newId(),
        lastPriceUpdatedAt: body.lastPriceUpdatedAt ? new Date(body.lastPriceUpdatedAt) : null,
        createdAt: t,
        updatedAt: t,
      },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/investments/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = PositionBody.partial().parse(req.body)
    await assertOwned(db(), 'investmentPosition', id, userId)
    if (body.accountId) await assertOwned(db(), 'account', body.accountId, userId)
    const record = await db().investmentPosition.update({
      where: { id },
      data: {
        ...body,
        ...(body.lastPriceUpdatedAt !== undefined
          ? { lastPriceUpdatedAt: body.lastPriceUpdatedAt ? new Date(body.lastPriceUpdatedAt) : null }
          : {}),
        updatedAt: now(),
      },
    })
    return reply.send(record)
  })

  fastify.delete('/investments/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'investmentPosition', id, userId)
    await db().investmentPosition.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })

  // ---- Events ----
  fastify.get('/investments/:id/events', async (req) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const { since } = req.query as { since?: string }
    return db().investmentEvent.findMany({
      where: { positionId: id, ...ownedWhere(userId, since) },
      orderBy: { occurredAt: 'desc' },
    })
  })

  fastify.post('/investments/:id/events', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = EventBody.parse(req.body)
    await assertOwned(db(), 'investmentPosition', id, userId)
    const t = now()
    const record = await db().investmentEvent.create({
      data: { ...body, userId, id: newId(), positionId: id, occurredAt: new Date(body.occurredAt), createdAt: t, updatedAt: t },
    })
    return reply.status(201).send(record)
  })
}

export default routes
