import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import { getBatchCosting, getCostingOverview } from '../services/costingService.js'
import {
  costCategorySchema,
  costingQuerySchema,
  costTargetSchema,
  costTypeSchema,
} from '../validation/schemas.js'

export const costingRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const jsonResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const costShareItemSchema = z.object({
  costId: z.string(),
  date: z.string(),
  type: costTypeSchema,
  category: costCategorySchema,
  description: z.string(),
  supplier: z.string().nullable(),
  sourceTarget: costTargetSchema,
  shareTandonId: z.enum(['T1', 'T2', 'T3']).nullable(),
  isUmumShare: z.boolean(),
  chargedAmount: z.number().int(),
  originalAmount: z.number().int(),
  spreadIndex: z.number().int().nullable(),
  spreadTotal: z.number().int(),
})

const unassignedItemSchema = costShareItemSchema.extend({ reason: z.string() })

const batchCostSummarySchema = z.object({
  cycleId: z.string(),
  tandonId: z.enum(['T1', 'T2', 'T3']),
  batchCode: z.string(),
  sowingDate: z.string(),
  cycleEndDate: z.string(),
  status: z.enum(['Berjalan', 'Selesai']),
  implicit: z.boolean(),
  operationalCost: z.number().int(),
  modalCost: z.number().int(),
  totalCost: z.number().int(),
  harvestCount: z.number().int(),
  totalHarvestKg: z.number(),
  hasHarvest: z.boolean(),
  costPerKg: z.number(),
  costPerHole: z.number(),
  revenue: z.number().int(),
  grossProfit: z.number().int(),
  marginPercent: z.number(),
  breakEvenPricePerKg: z.number(),
  avgSellingPricePerKg: z.number().nullable(),
  belowBreakEven: z.boolean(),
  costItemCount: z.number().int(),
  categoryTotals: z.record(z.string(), z.number().int()),
})

const costingTotalsSchema = z.object({
  batchCount: z.number().int(),
  operationalCost: z.number().int(),
  modalCost: z.number().int(),
  totalCost: z.number().int(),
  totalHarvestKg: z.number(),
  costPerKg: z.number(),
  costPerHole: z.number(),
  revenue: z.number().int(),
  grossProfit: z.number().int(),
  marginPercent: z.number(),
  breakEvenPricePerKg: z.number(),
  avgSellingPricePerKg: z.number().nullable(),
  belowBreakEvenBatchCount: z.number().int(),
  unassignedCost: z.number().int(),
  unassignedCount: z.number().int(),
})

const overviewRoute = createRoute({
  method: 'get',
  path: '/overview',
  tags: ['Costing'],
  summary: 'Rekap biaya per batch + total (biaya/kg, laba kotor, margin, harga impas)',
  request: { query: costingQuerySchema },
  responses: {
    200: jsonResponse(
      z.object({
        filters: z.object({ tandonId: z.enum(['all', 'T1', 'T2', 'T3']) }),
        totals: costingTotalsSchema,
        batches: z.array(batchCostSummarySchema),
        unassignedItems: z.array(unassignedItemSchema),
      }),
      'Ringkasan costing',
    ),
  },
})

const batchCostingRoute = createRoute({
  method: 'get',
  path: '/batches/{cycleId}',
  tags: ['Costing'],
  summary: 'Rincian biaya satu batch panen (item + per kategori)',
  request: {
    params: z.object({
      cycleId: z.string().openapi({ param: { name: 'cycleId', in: 'path' } }),
    }),
  },
  responses: {
    200: jsonResponse(
      batchCostSummarySchema.extend({
        items: z.array(costShareItemSchema),
        harvestIds: z.array(z.string()),
      }),
      'Rincian biaya batch',
    ),
  },
})

costingRoutes.openapi(overviewRoute, (c) => {
  const query = c.req.valid('query')
  return c.json(getCostingOverview(query), 200)
})

costingRoutes.openapi(batchCostingRoute, (c) => {
  const { cycleId } = c.req.valid('param')
  return c.json(getBatchCosting(cycleId), 200)
})
