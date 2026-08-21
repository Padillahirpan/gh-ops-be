import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { openApiValidationHook } from '../middleware/errors.js'
import {
  getTandon,
  getTandonCycle,
  listTandons,
  resetTandon,
  updateTandon,
} from '../services/tandonService.js'
import { tandonIdSchema, tandonUpdateSchema } from '../validation/schemas.js'

export const tandonRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })

const jsonResponse = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})

const tandonIdParam = z.object({ id: tandonIdSchema.openapi({ param: { name: 'id', in: 'path', example: 'T1' } }) })

const tandonSchema = z
  .object({
    id: z.enum(['T1', 'T2', 'T3']),
    name: z.string(),
    greenhouse: z.string(),
    batchCode: z.string(),
    holes: z.number().int(),
    sowingDate: z.string().nullable(),
    status: z.enum(['Empty', 'Growing', 'Sanitizing']),
    color: z.string(),
  })
  .openapi({ example: {
    id: 'T1',
    name: 'Tandon 1',
    greenhouse: 'GH-1',
    batchCode: 'B-2026-08-01-T1',
    holes: 1200,
    sowingDate: '2026-08-01',
    status: 'Growing',
    color: '#22c55e',
  } })

const cycleEventSchema = z.object({
  type: z.enum([
    'sowing',
    'moveToGutter',
    'firstSpray',
    'midSpray',
    'lateSpray',
    'sprayStopWarning',
    'preHarvestCheck',
    'harvest',
    'sanitizeStart',
    'sanitizeEnd',
  ]),
  hss: z.number().int(),
  date: z.string(),
  label: z.string(),
  icon: z.string(),
  tone: z.enum(['info', 'warning', 'danger', 'success', 'neutral']),
  status: z.enum(['past', 'current', 'upcoming']),
})

const cycleSchema = z.object({
  tandonId: z.enum(['T1', 'T2', 'T3']),
  hss: z.number().int().nullable(),
  phase: z.enum(['Belum Mulai', 'Semai', 'Tumbuh', 'Penggemukan', 'Panen', 'Sanitasi']),
  progressPercent: z.number(),
  sprayAllowed: z.boolean(),
  events: z.array(cycleEventSchema),
  nextEvent: z
    .object({ event: cycleEventSchema, daysRemaining: z.number().int() })
    .nullable(),
})

const listTandonsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Tandons'],
  summary: 'Daftar semua tandon',
  responses: { 200: jsonResponse(z.array(tandonSchema), 'Daftar tandon') },
})

const getTandonRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Tandons'],
  summary: 'Detail satu tandon',
  request: { params: tandonIdParam },
  responses: { 200: jsonResponse(tandonSchema, 'Detail tandon') },
})

const updateTandonRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Tandons'],
  summary: 'Perbarui tanggal semai / status tandon',
  request: {
    params: tandonIdParam,
    body: {
      content: { 'application/json': { schema: tandonUpdateSchema } },
      description: 'Minimal salah satu field harus diisi',
    },
  },
  responses: { 200: jsonResponse(tandonSchema, 'Tandon setelah diperbarui') },
})

const resetTandonRoute = createRoute({
  method: 'post',
  path: '/{id}/reset',
  tags: ['Tandons'],
  summary: 'Reset siklus tandon (kembali ke status Empty)',
  request: { params: tandonIdParam },
  responses: { 200: jsonResponse(tandonSchema, 'Tandon setelah direset') },
})

const getTandonCycleRoute = createRoute({
  method: 'get',
  path: '/{id}/cycle',
  tags: ['Tandons'],
  summary: 'Jadwal & progres siklus tanam tandon',
  request: { params: tandonIdParam },
  responses: { 200: jsonResponse(cycleSchema, 'Informasi siklus tandon') },
})

tandonRoutes.openapi(listTandonsRoute, (c) => c.json(listTandons(), 200))

tandonRoutes.openapi(getTandonRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(getTandon(id), 200)
})

tandonRoutes.openapi(updateTandonRoute, (c) => {
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')
  return c.json(updateTandon(id, input), 200)
})

tandonRoutes.openapi(resetTandonRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(resetTandon(id), 200)
})

tandonRoutes.openapi(getTandonCycleRoute, (c) => {
  const { id } = c.req.valid('param')
  return c.json(getTandonCycle(id), 200)
})
