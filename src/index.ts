import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { DB_PATH } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { auth } from './lib/auth.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { api } from './routes/index.js'

const app = new Hono()

app.use(logger())

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use('/api/*', cors({ origin: allowedOrigins }))

// Handler Better Auth — semua POST/GET /api/auth/* (login, logout, session,
// admin user management). Terdaftar sebelum app.route('/api') dan tidak
// melalui guard requireAuth (endpoint ini yang memvalidasi kredensial).
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

app.route('/api', api)
app.onError(errorHandler)
app.notFound(notFoundHandler)

const port = Number(process.env.PORT ?? 3001)

await runMigrations()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[selada-ops-api] http://localhost:${info.port}/api/health`)
  console.log(`[selada-ops-api] docs: http://localhost:${info.port}/api/scalar`)
  console.log(`[selada-ops-api] database: ${DB_PATH}`)
})
