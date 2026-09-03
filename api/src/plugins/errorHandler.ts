import fp from 'fastify-plugin'
import { ZodError } from 'zod'

export default fp(async (fastify) => {
  fastify.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Validation Error',
        status: 400,
        detail: 'Request failed validation.',
        errors: error.flatten(),
      })
    }

    const status = error.statusCode ?? 500
    reply.status(status).send({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: error.name,
      status,
      detail: error.message,
    })
  })
})
