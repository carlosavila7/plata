import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned, assertLookupValue, occurredAtRangeWhere } from '../lib/helpers.js'
import { encodeCursor, decodeCursor } from '../lib/cursor.js'

const DEFAULT_LIST_LIMIT = 50
const MAX_LIST_LIMIT = 200

const ExpenseListQuery = z.object({
  category:    z.string().optional(),
  subCategory: z.string().optional(),
  paymentType: z.string().optional(),
  accountId:   z.string().optional(),
  groupingTag: z.string().optional(),
  dateFrom:    z.string().optional(),
  dateTo:      z.string().optional(),
  since:       z.string().optional(),
  cursor:      z.string().optional(),
  limit:       z.coerce.number().int().positive().max(MAX_LIST_LIMIT).optional(),
})

const ExpenseSummaryQuery = z.object({
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
  category: z.string().optional(),
})

const FuelDetails = z.object({
  fullTank:           z.boolean(),
  odometerKm:         z.number().nullable(),
  pricePerLiterCents: z.number().int(),
})

const ExpenseBody = z.object({
  occurredAt:           z.string().datetime({ offset: true }),
  category:             z.string().min(1),
  subCategory:          z.string().min(1),
  costCents:            z.number().int().positive(),
  accountId:            z.string().uuid(),
  paymentType:          z.string().min(1),
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
    const { category, subCategory, paymentType, dateFrom, dateTo, accountId, groupingTag, since, cursor, limit } =
      ExpenseListQuery.parse(req.query)
    const decodedCursor = cursor ? decodeCursor(cursor) : undefined
    const take = limit ?? DEFAULT_LIST_LIMIT

    const records = await db().expense.findMany({
      where: {
        AND: [
          ownedWhere(userId, since),
          category    ? { category }    : {},
          subCategory ? { subCategory } : {},
          paymentType ? { paymentType } : {},
          accountId   ? { accountId }   : {},
          groupingTag ? { groupingTag } : {},
          occurredAtRangeWhere(dateFrom, dateTo),
          decodedCursor
            ? {
                OR: [
                  { occurredAt: { lt: decodedCursor.occurredAt } },
                  { occurredAt: decodedCursor.occurredAt, id: { lt: decodedCursor.id } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    })

    const hasMore = records.length > take
    const items = hasMore ? records.slice(0, take) : records
    const last = items[items.length - 1]
    return {
      items,
      ...(hasMore && last ? { nextCursor: encodeCursor(last.occurredAt, last.id) } : {}),
    }
  })

  // Category totals for a date range; subcategory breakdown when `category` is
  // supplied. Replaces the PWA screen that used to pull every Expense and group
  // them client-side.
  fastify.get('/expenses/summary', async (req) => {
    const userId = req.user!.id
    const { dateFrom, dateTo, category } = ExpenseSummaryQuery.parse(req.query)
    const where = {
      ...ownedWhere(userId),
      ...(category ? { category } : {}),
      ...occurredAtRangeWhere(dateFrom, dateTo),
    }

    if (category) {
      const rows = await db().expense.groupBy({ by: ['subCategory'], where, _sum: { costCents: true } })
      const subcategories = rows.map((r) => ({ subCategory: r.subCategory, totalCents: r._sum.costCents ?? 0 }))
      return {
        dateFrom, dateTo, category, subcategories,
        totalCents: subcategories.reduce((sum, r) => sum + r.totalCents, 0),
      }
    }

    const rows = await db().expense.groupBy({ by: ['category'], where, _sum: { costCents: true } })
    const categories = rows.map((r) => ({ category: r.category, totalCents: r._sum.costCents ?? 0 }))
    return {
      dateFrom, dateTo, categories,
      totalCents: categories.reduce((sum, r) => sum + r.totalCents, 0),
    }
  })

  fastify.post('/expenses', async (req, reply) => {
    const userId = req.user!.id
    const body = ExpenseBody.parse(req.body)
    await assertOwned(db(), 'account', body.accountId, userId)
    if (body.creditCardStatementId) await assertOwned(db(), 'creditCardStatement', body.creditCardStatementId, userId)
    await assertLookupValue(db(), 'expenseCategory', body.category)
    await assertLookupValue(db(), 'paymentType', body.paymentType)
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
    if (rest.category) await assertLookupValue(db(), 'expenseCategory', rest.category)
    if (rest.paymentType) await assertLookupValue(db(), 'paymentType', rest.paymentType)
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
