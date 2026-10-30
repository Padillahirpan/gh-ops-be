import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import {
  createCost,
  deleteCost,
  getCost,
  listCosts,
  updateCost,
} from '../services/costService.js'
import {
  costCategorySchema,
  costCreateSchema,
  costQuerySchema,
  costTargetSchema,
  costTypeSchema,
  costUpdateSchema,
} from '../validation/schemas.js'

export const costRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const jsonResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const idParam = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
})

const costEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  type: costTypeSchema,
  category: costCategorySchema,
  description: z.string(),
  amount: z.number().int(),
  target: costTargetSchema,
  supplier: z.string().nullable(),
  notes: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().int().nullable(),
  spreadCycles: z.number().int(),
  cycleId: z.string().nullable(),
  /** Batch panen hasil pengelompokan (manual/otomatis); null untuk biaya Umum / di luar siklus. */
  assignedCycleId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const listCostsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Costs'],
  summary: 'Riwayat biaya (filter: untuk/tipe/kategori/periode)',
  request: { query: costQuerySchema },
  responses: { 200: jsonResponse(z.array(costEntrySchema), 'Daftar biaya') },
})

const createCostRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Costs'],
  summary: 'Catat biaya baru',
  request: {
    body: {
      content: { 'application/json': { schema: costCreateSchema } },
      description:
        'Nominal wajib; atau isi jumlah + harga satuan agar nominal dihitung otomatis. ' +
        'spreadCycles hanya untuk Modal & Aset; cycleId = pindah manual ke batch tertentu',
    },
  },
  responses: { 201: jsonResponse(costEntrySchema, 'Biaya yang dibuat') },
})

const getCostRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Costs'],
  summary: 'Detail satu biaya',
  request: { params: idParam },
  responses: { 200: jsonResponse(costEntrySchema, 'Detail biaya') },
})

const updateCostRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Costs'],
  summary: 'Perbarui data biaya (termasuk pindah batch via cycleId)',
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: costUpdateSchema } } },
  },
  responses: { 200: jsonResponse(costEntrySchema, 'Biaya setelah diperbarui') },
})

const deleteCostRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Costs'],
  summary: 'Hapus biaya',
  request: { params: idParam },
  responses: { 204: { description: 'Biaya dihapus' } },
})

costRoutes.openapi(listCostsRoute, (c) => {
  const query = c.req.valid('query')
  return c.json(listCosts(query), 200)
})

costRoutes.openapi(createCostRoute, (c) => {
  const input = c.req.valid('json')
  return c.json(createCost(input), 201)
})

costRoutes.openapi(getCostRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(getCost(id), 200)
})

costRoutes.openapi(updateCostRoute, (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  return c.json(updateCost(id, input), 200)
})

costRoutes.openapi(deleteCostRoute, (c) => {
  const { id } = c.req.valid('param')
  deleteCost(id)
  return c.body(null, 204)
})
