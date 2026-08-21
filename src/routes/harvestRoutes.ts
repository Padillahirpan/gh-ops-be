import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import {
  createHarvest,
  deleteHarvest,
  getHarvest,
  listHarvests,
  listStockBatches,
  updateHarvest,
} from '../services/harvestService.js'
import { harvestCreateSchema, harvestQuerySchema, harvestUpdateSchema } from '../validation/schemas.js'

export const harvestRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const jsonResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const idParam = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
})

const rejectionBreakdownSchema = z.object({
  tipBurn: z.number().int(),
  rootRot: z.number().int(),
  pests: z.number().int(),
  undersized: z.number().int(),
  other: z.number().int(),
})

const harvestEntrySchema = z.object({
  id: z.string(),
  tandonId: z.enum(['T1', 'T2', 'T3']),
  date: z.string(),
  totalWeightKg: z.number(),
  totalPlants: z.number().int(),
  rejected: z.number().int(),
  reasons: rejectionBreakdownSchema,
  notes: z.string().nullable(),
  avgWeightG: z.number(),
  successRate: z.number(),
  createdAt: z.string(),
})

const stockBatchSchema = z.object({
  harvestId: z.string(),
  tandonId: z.enum(['T1', 'T2', 'T3']),
  date: z.string(),
  totalWeightKg: z.number(),
  avgWeightG: z.number(),
  soldKg: z.number(),
  remainingKg: z.number(),
})

// '/stock' didaftarkan sebelum '/{id}' agar tidak tertelan parameter.
const listStockBatchesRoute = createRoute({
  method: 'get',
  path: '/stock',
  tags: ['Harvests'],
  summary: 'Stok batch panen yang belum habis terjual',
  responses: { 200: jsonResponse(z.array(stockBatchSchema), 'Daftar batch stok') },
})

const listHarvestsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Harvests'],
  summary: 'Daftar panen (dengan filter)',
  request: { query: harvestQuerySchema },
  responses: { 200: jsonResponse(z.array(harvestEntrySchema), 'Daftar panen') },
})

const createHarvestRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Harvests'],
  summary: 'Catat panen baru',
  request: {
    body: {
      content: { 'application/json': { schema: harvestCreateSchema } },
      description: 'Data panen; rincian afkir tidak boleh melebihi jumlah afkir',
    },
  },
  responses: { 201: jsonResponse(harvestEntrySchema, 'Panen yang dibuat') },
})

const getHarvestRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Harvests'],
  summary: 'Detail satu panen',
  request: { params: idParam },
  responses: { 200: jsonResponse(harvestEntrySchema, 'Detail panen') },
})

const updateHarvestRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Harvests'],
  summary: 'Perbarui data panen',
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: harvestUpdateSchema } } },
  },
  responses: { 200: jsonResponse(harvestEntrySchema, 'Panen setelah diperbarui') },
})

const deleteHarvestRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Harvests'],
  summary: 'Hapus panen',
  request: { params: idParam },
  responses: { 204: { description: 'Panen dihapus' } },
})

harvestRoutes.openapi(listStockBatchesRoute, (c) => c.json(listStockBatches(), 200))

harvestRoutes.openapi(listHarvestsRoute, (c) => {
  const query = c.req.valid('query')
  return c.json(listHarvests(query), 200)
})

harvestRoutes.openapi(createHarvestRoute, (c) => {
  const input = c.req.valid('json')
  return c.json(createHarvest(input), 201)
})

harvestRoutes.openapi(getHarvestRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(getHarvest(id), 200)
})

harvestRoutes.openapi(updateHarvestRoute, (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  return c.json(updateHarvest(id, input), 200)
})

harvestRoutes.openapi(deleteHarvestRoute, (c) => {
  const { id } = c.req.valid('param')
  deleteHarvest(id)
  return c.body(null, 204)
})
