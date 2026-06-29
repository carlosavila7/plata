import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, baseWhere } from '../lib/helpers.js'

const Body = z.object({ name: z.string().min(1) })

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/expense-categories', async (req) => {
    const { since } = req.query as { since?: string }
    return db().expenseCategory.findMany({ where: baseWhere(since) })
  })

  fastify.post('/expense-categories', async (req, reply) => {
    const body = Body.parse(req.body)
    const t = now()
    const record = await db().expenseCategory.create({ data: { ...body, id: newId(), createdAt: t, updatedAt: t } })
    return reply.status(201).send(record)
  })

  fastify.put('/expense-categories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = Body.partial().parse(req.body)
    const record = await db().expenseCategory.update({ where: { id }, data: { ...body, updatedAt: now() } })
    return reply.send(record)
  })

  fastify.delete('/expense-categories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await db().expenseCategory.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })
}

export default routes
