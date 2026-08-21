import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import { getDashboard } from '../services/analyticsService.js'
import { dashboardQuerySchema } from '../validation/schemas.js'

export const analyticsRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const dashboardAggregatesSchema = z.object({
  totalHarvestKg: z.number(),
  avgWeightG: z.number(),
  avgWeightBadgeTone: z.enum(['success', 'warning', 'danger']),
  totalRevenue: z.number(),
  successRate: z.number(),
  readyStockKg: z.number(),
  harvestCount: z.number().int(),
  rejectionTotals: z.object({
    tipBurn: z.number().int(),
    rootRot: z.number().int(),
    pests: z.number().int(),
    undersized: z.number().int(),
    other: z.number().int(),
  }),
  buyerTotals: z.record(z.number()),
  weightTrend: z.array(z.record(z.union([z.string(), z.number()]))),
  harvestVsSold: z.array(
    z.object({ tandon: z.string(), Panen: z.number(), Terjual: z.number() }),
  ),
  revenuePerTandon: z.array(z.object({ tandon: z.string(), revenue: z.number() })),
  hasData: z.boolean(),
})

const dashboardSchema = z.object({
  filters: z.object({
    range: z.enum(['30', '90', 'all']),
    tandonId: z.enum(['all', 'T1', 'T2', 'T3']),
  }),
  current: dashboardAggregatesSchema,
  previous: dashboardAggregatesSchema,
})

const getDashboardRoute = createRoute({
  method: 'get',
  path: '/dashboard',
  tags: ['Analytics'],
  summary: 'Agregat dashboard (tren berat, pendapatan, afkir, pembeli)',
  request: { query: dashboardQuerySchema },
  responses: {
    200: {
      description: 'Agregat dashboard sesuai rentang & tandon',
      content: { 'application/json': { schema: dashboardSchema } },
    },
  },
})

analyticsRoutes.openapi(getDashboardRoute, (c) => {
  const query = c.req.valid('query')
  return c.json(getDashboard(query), 200)
})
