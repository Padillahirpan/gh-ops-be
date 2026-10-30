import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import { getCycleBatch, listCycleBatches } from '../services/cycleService.js'
import { cycleQuerySchema } from '../validation/schemas.js'

export const cycleRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const jsonResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const cycleBatchSchema = z.object({
  id: z.string(),
  tandonId: z.enum(['T1', 'T2', 'T3']),
  sowingDate: z.string(),
  cycleEndDate: z.string(),
  batchCode: z.string(),
  status: z.enum(['Berjalan', 'Selesai']),
  implicit: z.boolean(),
  createdAt: z.string().nullable(),
})

const listCyclesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Cycles'],
  summary: 'Daftar batch panen (siklus per tandon, terbaru dulu)',
  request: { query: cycleQuerySchema },
  responses: { 200: jsonResponse(z.array(cycleBatchSchema), 'Daftar batch panen') },
})

const getCycleRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Cycles'],
  summary: 'Detail satu batch panen',
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: { 200: jsonResponse(cycleBatchSchema, 'Detail batch panen') },
})

cycleRoutes.openapi(listCyclesRoute, (c) => {
  const query = c.req.valid('query')
  return c.json(listCycleBatches(query), 200)
})

cycleRoutes.openapi(getCycleRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(getCycleBatch(id), 200)
})
