import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'

const CATEGORIES = ['food', 'transport', 'vehicle', 'streaming', 'housing', 'personal', 'health', 'subscriptions', 'entertainment', 'education', 'sidequests', 'other'] as const
const PAYMENT_TYPES = ['debit', 'credit', 'pix', 'food_voucher', 'meal_voucher'] as const

const FuelDetails = z.object({
  fullTank:           z.boolean(),
  odometerKm:         z.number().nullable(),
  pricePerLiterCents: z.number().int(),
})

const ExpenseBody = z.object({
  occurredAt:           z.string().datetime({ offset: true }),
  category:             z.enum(CATEGORIES),
  subCategory:          z.string().min(1),
  costCents:            z.number().int().positive(),
  accountId:            z.string().uuid(),
  paymentType:          z.enum(PAYMENT_TYPES),
  creditCardStatementId: z.string().uuid().optional().nullable(),
  boughtAt:             z.string().optional().nullable(),
  city:                 z.string().optional().nullable(),
  description:          z.string().optional().nullable(),
  groupingTag:          z.string().optional().nullable(),
  isRecurrent:          z.boolean(),
  person:               z.string().optional().nullable(),
  isDelivery:           z.boolean().optional().nullable(),
  fuelDetails:          FuelDetails.optional().nullable(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/expenses', async (req) => {
    const userId = req.user!.id
    const { category, dateFrom, dateTo, accountId, groupingTag, since } = req.query as Record<string, string | undefined>
    return db().expense.findMany({
      where: {
        ...ownedWhere(userId, since),
        ...(category ? { category } : {}),
        ...(accountId ? { accountId } : {}),
        ...(groupingTag ? { groupingTag } : {}),
        ...(dateFrom || dateTo ? { occurredAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
      },
      orderBy: { occurredAt: 'desc' },
    })
  })

  fastify.post('/expenses', async (req, reply) => {
    const userId = req.user!.id
    const body = ExpenseBody.parse(req.body)
    await assertOwned(db(), 'account', body.accountId, userId)
    if (body.creditCardStatementId) await assertOwned(db(), 'creditCardStatement', body.creditCardStatementId, userId)
    const t = now()
    const record = await db().expense.create({
      data: {
        ...body,
        userId,
        id: newId(),
        occurredAt: new Date(body.occurredAt),
        fuelDetails: body.fuelDetails ? JSON.stringify(body.fuelDetails) : null,
        createdAt: t,
        updatedAt: t,
      },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/expenses/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const { occurredAt, fuelDetails, accountId, creditCardStatementId, ...rest } = ExpenseBody.partial().parse(req.body)
    await assertOwned(db(), 'expense', id, userId)
    if (accountId) await assertOwned(db(), 'account', accountId, userId)
    if (creditCardStatementId) await assertOwned(db(), 'creditCardStatement', creditCardStatementId, userId)
    const record = await db().expense.update({
      where: { id },
      data: {
        ...rest,
        ...(occurredAt            ? { occurredAt: new Date(occurredAt) }                                  : {}),
        ...(fuelDetails !== undefined ? { fuelDetails: fuelDetails ? JSON.stringify(fuelDetails) : null } : {}),
        ...(accountId             ? { account:             { connect: { id: accountId } } }              : {}),
        ...(creditCardStatementId ? { creditCardStatement: { connect: { id: creditCardStatementId } } }  : {}),
        updatedAt: now(),
      },
    })
    return reply.send(record)
  })

  fastify.delete('/expenses/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'expense', id, userId)
    await db().expense.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })
}

export default routes
