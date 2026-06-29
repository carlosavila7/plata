import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'

const REASONS = ['salary', 'interest', 'refund', 'deposit', 'self', 'rental', 'other', 'investment_withdrawal', 'plr'] as const

const IncomeBody = z.object({
  occurredAt:    z.string().datetime({ offset: true }),
  reason:        z.enum(REASONS),
  amountCents:   z.number().int().positive(),
  toAccountId:   z.string().uuid(),
  fromAccountId: z.string().uuid().optional().nullable(),
  description:   z.string().optional().nullable(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/income', async (req) => {
    const userId = req.user!.id
    const { reason, dateFrom, dateTo, accountId, since } = req.query as Record<string, string | undefined>
    return db().income.findMany({
      where: {
        ...ownedWhere(userId, since),
        ...(reason ? { reason } : {}),
        ...(accountId ? { toAccountId: accountId } : {}),
        ...(dateFrom || dateTo ? { occurredAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
      },
      orderBy: { occurredAt: 'desc' },
    })
  })

  fastify.post('/income', async (req, reply) => {
    const userId = req.user!.id
    const body = IncomeBody.parse(req.body)
    await assertOwned(db(), 'account', body.toAccountId, userId)
    if (body.fromAccountId) await assertOwned(db(), 'account', body.fromAccountId, userId)
    const t = now()
    const record = await db().income.create({
      data: { ...body, userId, id: newId(), occurredAt: new Date(body.occurredAt), createdAt: t, updatedAt: t },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/income/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = IncomeBody.partial().parse(req.body)
    await assertOwned(db(), 'income', id, userId)
    if (body.toAccountId) await assertOwned(db(), 'account', body.toAccountId, userId)
    if (body.fromAccountId) await assertOwned(db(), 'account', body.fromAccountId, userId)
    const record = await db().income.update({
      where: { id },
      data: { ...body, ...(body.occurredAt ? { occurredAt: new Date(body.occurredAt) } : {}), updatedAt: now() },
    })
    return reply.send(record)
  })

  fastify.delete('/income/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'income', id, userId)
    await db().income.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })
}

export default routes
