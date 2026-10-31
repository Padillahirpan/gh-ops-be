import { Scalar } from '@scalar/hono-api-reference'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { requireAdmin, requireAuth, type AuthEnv } from '../middleware/auth.js'
import { openApiValidationHook } from '../middleware/errors.js'
import { analyticsRoutes } from './analyticsRoutes.js'
import { costRoutes } from './costRoutes.js'
import { costingRoutes } from './costingRoutes.js'
import { cycleRoutes } from './cycleRoutes.js'
import { harvestRoutes } from './harvestRoutes.js'
import { saleRoutes } from './saleRoutes.js'
import { tandonRoutes } from './tandonRoutes.js'

export const api = new OpenAPIHono<AuthEnv>({ defaultHook: openApiValidationHook })

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Cek status layanan',
  responses: {
    200: {
      description: 'Layanan hidup',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            service: z.string(),
            uptimeSeconds: z.number().int(),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
})

api.openapi(healthRoute, (c) =>
  c.json(
    {
      status: 'ok',
      service: 'selada-ops-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    200,
  ),
)

// Dokumentasi OpenAPI (JSON) + Scalar API Reference.
// `servers` wajib: rute dipasang di /api sehingga try-it-out Scalar perlu prefix /api.
api.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Selada Ops API',
    version: '0.1.0',
    description:
      'API operasional greenhouse selada: tandon, panen, penjualan, dan analitik.',
  },
  servers: [{ url: '/api', description: 'Local API' }],
})

api.get('/scalar', Scalar({ url: '/api/doc', pageTitle: 'Selada Ops API' }))

// Guard: semua endpoint bisnis butuh login; metode tulis hanya Admin.
// /health, /doc, /scalar terdaftar di atas sehingga tetap publik.
api.use('*', requireAuth)
api.use('*', requireAdmin)

api.route('/tandons', tandonRoutes)
api.route('/harvests', harvestRoutes)
api.route('/sales', saleRoutes)
api.route('/analytics', analyticsRoutes)
api.route('/costs', costRoutes)
api.route('/cycles', cycleRoutes)
api.route('/costing', costingRoutes)
