import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { processBatch } from '../sync/batch.js'
import { getDelta } from '../sync/delta.js'

const QueueItem = z.object({
  id:        z.string(),
  entity:    z.enum(['accounts', 'balances', 'expenses', 'income', 'creditCards', 'creditCardStatements', 'investmentPositions', 'investmentEvents']),
  entityId:  z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  payload:   z.record(z.unknown()),
  queuedAt:  z.string(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/sync', async (req, reply) => {
    const userId = req.user!.id
    const items = z.array(QueueItem).parse(req.body)
    const results = await processBatch(fastify.prisma, userId, items)
    return reply.send({ results })
  })

  fastify.get('/sync/delta', async (req, reply) => {
    const { since } = req.query as { since?: string }
    if (!since) {
      return reply.status(400).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: '?since= parameter is required (ISO 8601 timestamp)',
      })
    }
    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      return reply.status(400).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Bad Request',
        status: 400,
        detail: '?since= must be a valid ISO 8601 timestamp',
      })
    }
    const delta = await getDelta(fastify.prisma, req.user!.id, sinceDate)
    return reply.send(delta)
  })
}

export default routes
