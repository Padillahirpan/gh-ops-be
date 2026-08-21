import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import {
  createSale,
  deleteSale,
  getSale,
  listSales,
  updateSale,
} from '../services/saleService.js'
import { saleCreateSchema, saleQuerySchema, saleUpdateSchema } from '../validation/schemas.js'

export const saleRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const jsonResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const idParam = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
})

const saleEntrySchema = z.object({
  id: z.string(),
  harvestId: z.string(),
  tandonId: z.enum(['T1', 'T2', 'T3']),
  date: z.string(),
  buyerCategory: z.enum(['supermarket', 'restaurant', 'wholesaler', 'retail']),
  buyerName: z.string(),
  soldVolumeKg: z.number(),
  pricePerKg: z.number().int(),
  totalValue: z.number(),
  paymentStatus: z.enum(['paid', 'dp', 'tempo']),
  unsoldAction: z.enum(['coldStorage', 'clearance', 'spoilage']).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

const listSalesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Sales'],
  summary: 'Daftar penjualan (dengan filter)',
  request: { query: saleQuerySchema },
  responses: { 200: jsonResponse(z.array(saleEntrySchema), 'Daftar penjualan') },
})

const createSaleRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Sales'],
  summary: 'Catat penjualan baru',
  request: {
    body: {
      content: { 'application/json': { schema: saleCreateSchema } },
      description: 'Volume terjual tidak boleh melebihi stok batch panen terkait',
    },
  },
  responses: { 201: jsonResponse(saleEntrySchema, 'Penjualan yang dibuat') },
})

const getSaleRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Sales'],
  summary: 'Detail satu penjualan',
  request: { params: idParam },
  responses: { 200: jsonResponse(saleEntrySchema, 'Detail penjualan') },
})

const updateSaleRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Sales'],
  summary: 'Perbarui data penjualan',
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: saleUpdateSchema } } },
  },
  responses: { 200: jsonResponse(saleEntrySchema, 'Penjualan setelah diperbarui') },
})

const deleteSaleRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Sales'],
  summary: 'Hapus penjualan',
  request: { params: idParam },
  responses: { 204: { description: 'Penjualan dihapus' } },
})

saleRoutes.openapi(listSalesRoute, (c) => {
  const query = c.req.valid('query')
  return c.json(listSales(query), 200)
})

saleRoutes.openapi(createSaleRoute, (c) => {
  const input = c.req.valid('json')
  return c.json(createSale(input), 201)
})

saleRoutes.openapi(getSaleRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(getSale(id), 200)
})

saleRoutes.openapi(updateSaleRoute, (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  return c.json(updateSale(id, input), 200)
})

saleRoutes.openapi(deleteSaleRoute, (c) => {
  const { id } = c.req.valid('param')
  deleteSale(id)
  return c.body(null, 204)
})
