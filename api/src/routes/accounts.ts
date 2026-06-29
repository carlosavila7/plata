import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { newId, now, ownedWhere, assertOwned } from '../lib/helpers.js'

const AccountBody = z.object({
  name:        z.string().min(1),
  type:        z.enum(['checking', 'savings', 'voucher', 'wallet']),
  institution: z.string().min(1),
  notes:       z.string().optional(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  const db = () => fastify.prisma

  fastify.get('/accounts', async (req) => {
    const userId = req.user!.id
    const { since } = req.query as { since?: string }
    return db().account.findMany({ where: ownedWhere(userId, since) })
  })

  fastify.post('/accounts', async (req, reply) => {
    const userId = req.user!.id
    const body = AccountBody.parse(req.body)
    const t = now()
    const record = await db().account.create({
      data: { ...body, userId, id: newId(), createdAt: t, updatedAt: t },
    })
    return reply.status(201).send(record)
  })

  fastify.put('/accounts/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    const body = AccountBody.partial().parse(req.body)
    await assertOwned(db(), 'account', id, userId)
    const record = await db().account.update({
      where: { id },
      data: { ...body, updatedAt: now() },
    })
    return reply.send(record)
  })

  fastify.delete('/accounts/:id', async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params as { id: string }
    await assertOwned(db(), 'account', id, userId)
    await db().account.update({ where: { id }, data: { deletedAt: now(), updatedAt: now() } })
    return reply.status(204).send()
  })
}

export default routes
