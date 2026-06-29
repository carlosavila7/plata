import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'

const CardBody = z.object({
  nickname:   z.string().min(1),
  bank:       z.string().min(1),
  network:    z.string().min(1),
  closingDay: z.number().int().min(1).max(31),
  dueDay:     z.number().int().min(1).max(31),
  limitCents: z.number().int().nonnegative().optional().nullable(),
})

const StatementBody = z.object({
  openDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closeDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:     z.enum(['open', 'closed', 'paid']),
  totalCents: z.number().int().optional().nullable(),
})

const StatementPatch = z.object({
  status:     z.enum(['open', 'closed', 'paid']).optional(),
  totalCents: z.number().int().optional().nullable(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  // ---- Cards ----
  fastify.get('/credit-cards', async (req) => {
    const userId = req.user!.id
    const { since } = req.query as { since?: string }
    return db().creditCard.findMany({ where: ownedWhere(userId, since) })
  })

  fastify.post('/credit-cards', async (req, reply) => {
    const userId = req.user!.id
    const body = CardBody.parse(req.body)
    const t = now()
    const record = await db().creditCard.create({
      data: { ...body, userId, id: newId(), createdAt: t, updatedAt: t },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/credit-cards/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = CardBody.partial().parse(req.body)
    await assertOwned(db(), 'creditCard', id, userId)
    const record = await db().creditCard.update({
      where: { id },
      data: { ...body, updatedAt: now() },
    })
    return reply.send(record)
  })

  fastify.delete('/credit-cards/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'creditCard', id, userId)
    await db().creditCard.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })

  // ---- Statements (nested under a card) ----
  fastify.get('/credit-cards/:id/statements', async (req) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const { since } = req.query as { since?: string }
    return db().creditCardStatement.findMany({ where: { creditCardId: id, ...ownedWhere(userId, since) } })
  })

  fastify.post('/credit-cards/:id/statements', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = StatementBody.parse(req.body)
    await assertOwned(db(), 'creditCard', id, userId)
    const t = now()
    const record = await db().creditCardStatement.create({
      data: { ...body, userId, id: newId(), creditCardId: id, createdAt: t, updatedAt: t },
    })
    return reply.status(201).send(record)
  })

  fastify.patch('/credit-cards/:id/statements/:sid', async (req, reply) => {
    const userId = req.user!.id
    const { sid } = req.params as { id: string; sid: string }
    const body = StatementPatch.parse(req.body)
    await assertOwned(db(), 'creditCardStatement', sid, userId)
    const record = await db().creditCardStatement.update({
      where: { id: sid },
      data: { ...body, updatedAt: now() },
    })
    return reply.send(record)
  })
}

export default routes
