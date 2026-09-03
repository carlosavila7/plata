import Fastify from 'fastify'
import cors from '@fastify/cors'
import prismaPlugin from './plugins/prisma.js'
import errorHandler from './plugins/errorHandler.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/accounts.js'
import balanceRoutes from './routes/balances.js'
import expenseRoutes from './routes/expenses.js'
import incomeRoutes from './routes/income.js'
import creditCardStatementRoutes from './routes/creditCardStatements.js'
import creditCardRoutes from './routes/creditCards.js'
import investmentRoutes from './routes/investments.js'
import syncRoutes from './routes/sync.js'
import expenseCategoryRoutes from './routes/expenseCategories.js'
import expenseSubcategoryRoutes from './routes/expenseSubcategories.js'
import paymentTypeRoutes from './routes/paymentTypes.js'
import cityRoutes from './routes/cities.js'
import lookupRoutes from './routes/lookups.js'

const fastify = Fastify({ logger: true })

fastify.get('/health', async () => ({ ok: true }))

await fastify.register(cors, {
  origin: [
    'http://localhost:5173',
    process.env.PWA_ORIGIN ?? '',
  ].filter(Boolean),
  credentials: true, // allow the httpOnly refresh cookie to flow cross-origin in dev
})

await fastify.register(prismaPlugin)
await fastify.register(errorHandler)
await fastify.register(authPlugin)

// Global guard: every route requires a valid access token except the public
// allowlist below. Populates `req.user` — the seam for per-record ownership later.
fastify.addHook('onRequest', async (req, reply) => {
  const path = req.url.split('?')[0]
  if (path === '/health' || path.startsWith('/auth/')) return
  await fastify.authenticate(req, reply)
})

await fastify.register(authRoutes)
await fastify.register(accountRoutes)
await fastify.register(balanceRoutes)
await fastify.register(expenseRoutes)
await fastify.register(incomeRoutes)
await fastify.register(creditCardStatementRoutes)
await fastify.register(creditCardRoutes)
await fastify.register(investmentRoutes)
await fastify.register(syncRoutes)
await fastify.register(expenseCategoryRoutes)
await fastify.register(expenseSubcategoryRoutes)
await fastify.register(paymentTypeRoutes)
await fastify.register(cityRoutes)
await fastify.register(lookupRoutes)

const port = Number(process.env.PORT ?? 3000)
await fastify.listen({ port, host: '0.0.0.0' })
