import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

// Timestamps arrive as client-generated ISO strings — these rows are pushed with
// their own id/createdAt/updatedAt/deletedAt rather than server-minted ones, unlike
// every other POST route in this file's siblings.
const LookupFields = {
  id:        z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable().optional(),
}

const ExpenseCategoryIn    = z.object({ ...LookupFields, name: z.string().min(1) })
const ExpenseSubcategoryIn = z.object({ ...LookupFields, name: z.string().min(1), categoryId: z.string().min(1) })
const PaymentTypeIn        = z.object({ ...LookupFields, name: z.string().min(1), isVoucher: z.boolean() })
const CityIn               = z.object({ ...LookupFields, name: z.string().min(1) })

const PushBody = z.object({
  expenseCategories:    z.array(ExpenseCategoryIn).default([]),
  expenseSubcategories: z.array(ExpenseSubcategoryIn).default([]),
  paymentTypes:         z.array(PaymentTypeIn).default([]),
  cities:               z.array(CityIn).default([]),
})

type LookupRow = { id: string; createdAt: Date; updatedAt: Date; deletedAt?: Date | null }

interface LookupRepo {
  findUnique(args: { where: { id: string } }): Promise<{ updatedAt: Date } | null>
  create(args: { data: Record<string, unknown> }): Promise<unknown>
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>
}

/**
 * Upsert-by-id, idempotent and last-write-wins by `updatedAt` — the same conflict
 * rule used everywhere else in this app. Rows carry their client id across so a
 * seeded row shared between client and server updates in place instead of
 * duplicating, and a locally soft-deleted row lands as deleted rather than being
 * skipped (which would otherwise leave a stale, un-deleted copy on the server).
 */
async function pushRows<T extends LookupRow>(repo: LookupRepo, rows: T[]) {
  let created = 0, updated = 0, unchanged = 0

  for (const row of rows) {
    const { id, createdAt, updatedAt, deletedAt, ...fields } = row
    const existing = await repo.findUnique({ where: { id } })

    if (!existing) {
      await repo.create({ data: { ...fields, id, createdAt, updatedAt, deletedAt: deletedAt ?? null } })
      created++
      continue
    }

    if (updatedAt <= existing.updatedAt) {
      unchanged++
      continue
    }

    await repo.update({ where: { id }, data: { ...fields, updatedAt, deletedAt: deletedAt ?? null } })
    updated++
  }

  return { created, updated, unchanged }
}

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  // One-off migration action for the PWA's Settings: pushes locally-stored
  // categories, subcategories, payment types and cities that have never reached
  // the server (Settings writes them to IndexedDB only). Categories are pushed
  // before subcategories so a brand-new category's row exists before any
  // subcategory referencing it by categoryId.
  fastify.post('/lookups/push', async (req) => {
    const body = PushBody.parse(req.body)

    const expenseCategories    = await pushRows(db().expenseCategory, body.expenseCategories)
    const expenseSubcategories = await pushRows(db().expenseSubcategory, body.expenseSubcategories)
    const paymentTypes         = await pushRows(db().paymentType, body.paymentTypes)
    const cities                = await pushRows(db().city, body.cities)

    return { expenseCategories, expenseSubcategories, paymentTypes, cities }
  })
}

export default routes
