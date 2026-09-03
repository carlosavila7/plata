import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'
import { deriveAccountBalances } from '../lib/deriveBalances.js'

const BalanceBody = z.object({
  accountId:   z.string().uuid(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/balances', async (req) => {
    const userId = req.user!.id
    const { accountId, dateFrom, dateTo, since } = req.query as Record<string, string | undefined>
    return db().balance.findMany({
      where: {
        ...ownedWhere(userId, since),
        ...(accountId ? { accountId } : {}),
        ...(dateFrom || dateTo ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
      },
    })
  })

  // Derived balance per Account — see CONTEXT.md. The math lives in
  // lib/deriveBalances.ts as a pure function; this just gathers the record
  // sets it needs.
  fastify.get('/balances/derived', async (req) => {
    const userId = req.user!.id
    const [accounts, balances, income, expenses, creditCards, statements, investmentPositions, investmentEvents] =
      await Promise.all([
        db().account.findMany({ where: ownedWhere(userId) }),
        db().balance.findMany({ where: ownedWhere(userId) }),
        db().income.findMany({ where: ownedWhere(userId) }),
        db().expense.findMany({ where: ownedWhere(userId) }),
        db().creditCard.findMany({ where: ownedWhere(userId) }),
        db().creditCardStatement.findMany({ where: ownedWhere(userId) }),
        db().investmentPosition.findMany({ where: ownedWhere(userId) }),
        db().investmentEvent.findMany({ where: ownedWhere(userId) }),
      ])

    return deriveAccountBalances({
      accounts,
      balances,
      income,
      expenses,
      creditCards,
      statements,
      investmentPositions,
      investmentEvents,
    })
  })

  fastify.post('/balances', async (req, reply) => {
    const userId = req.user!.id
    const body = BalanceBody.parse(req.body)
    await assertOwned(db(), 'account', body.accountId, userId)
    const t = now()
    const record = await db().balance.create({ data: { ...body, userId, id: newId(), createdAt: t, updatedAt: t } })
    return reply.status(201).send(record)
  })

  fastify.put('/balances/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = BalanceBody.partial().parse(req.body)
    await assertOwned(db(), 'balance', id, userId)
    if (body.accountId) await assertOwned(db(), 'account', body.accountId, userId)
    const record = await db().balance.update({ where: { id }, data: { ...body, updatedAt: now() } })
    return reply.send(record)
  })

  fastify.delete('/balances/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'balance', id, userId)
    await db().balance.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })
}

export default routes
