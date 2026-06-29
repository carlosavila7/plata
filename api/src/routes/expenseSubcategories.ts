import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, baseWhere } from '../lib/helpers.js'

const Body = z.object({
  name:       z.string().min(1),
  categoryId: z.string().min(1),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/expense-subcategories', async (req) => {
    const { since, categoryId } = req.query as { since?: string; categoryId?: string }
    return db().expenseSubcategory.findMany({
      where: { ...baseWhere(since), ...(categoryId ? { categoryId } : {}) },
    })
  })

  fastify.post('/expense-subcategories', async (req, reply) => {
    const body = Body.parse(req.body)
    const t = now()
    const record = await db().expenseSubcategory.create({ data: { ...body, id: newId(), createdAt: t, updatedAt: t } })
    return reply.status(201).send(record)
  })

  fastify.put('/expense-subcategories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = Body.partial().parse(req.body)
    const record = await db().expenseSubcategory.update({ where: { id }, data: { ...body, updatedAt: now() } })
    return reply.send(record)
  })

  fastify.delete('/expense-subcategories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await db().expenseSubcategory.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })
}

export default routes
