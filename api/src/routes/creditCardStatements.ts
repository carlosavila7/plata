import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'

const StatementBody = z.object({
  creditCardId: z.string().optional().nullable(),
  openDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closeDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:     z.enum(['open', 'closed', 'paid']),
  totalCents: z.number().int().optional().nullable(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/credit-card-statements', async (req) => {
    const userId = req.user!.id
    const { since } = req.query as { since?: string }
    return db().creditCardStatement.findMany({ where: ownedWhere(userId, since) })
  })

  fastify.post('/credit-card-statements', async (req, reply) => {
    const userId = req.user!.id
    const body = StatementBody.parse(req.body)
    if (body.creditCardId) await assertOwned(db(), 'creditCard', body.creditCardId, userId)
    const t = now()
    const record = await db().creditCardStatement.create({
      data: { ...body, userId, id: newId(), createdAt: t, updatedAt: t },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/credit-card-statements/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = StatementBody.partial().parse(req.body)
    await assertOwned(db(), 'creditCardStatement', id, userId)
    if (body.creditCardId) await assertOwned(db(), 'creditCard', body.creditCardId, userId)
    const record = await db().creditCardStatement.update({
      where: { id },
      data: { ...body, updatedAt: now() },
    })
    return reply.send(record)
  })

  fastify.delete('/credit-card-statements/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'creditCardStatement', id, userId)
    await db().creditCardStatement.update({
      where: { id },
      data: { deletedAt: now(), updatedAt: now() },
    })
    return reply.status(204).send()
  })
}

export default routes
