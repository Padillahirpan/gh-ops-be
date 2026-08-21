// Skema validasi Zod — batas sistem (input eksternal), pesan berbahasa Indonesia.
import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'
import { sumRejectionBreakdown } from '../domain/constants.js'
import { isValidISODate, todayISO } from '../lib/dateUtils.js'
import type { HarvestRejectionBreakdown } from '../domain/types.js'

// Mengaktifkan method .openapi() untuk metadata OpenAPI (Scalar docs).
extendZodWithOpenApi(z)

export const tandonIdSchema = z.enum(['T1', 'T2', 'T3'], {
  errorMap: () => ({ message: 'Tandon harus salah satu dari T1, T2, T3' }),
})

export const isoDateSchema = z
  .string()
  .refine((v) => isValidISODate(v), 'Tanggal harus format YYYY-MM-DD yang valid')

const rejectionBreakdownSchema = z
  .object({
    tipBurn: z.number().int('Jumlah afkir harus bilangan bulat').min(0),
    rootRot: z.number().int('Jumlah afkir harus bilangan bulat').min(0),
    pests: z.number().int('Jumlah afkir harus bilangan bulat').min(0),
    undersized: z.number().int('Jumlah afkir harus bilangan bulat').min(0),
    other: z.number().int('Jumlah afkir harus bilangan bulat').min(0),
  })
  .refine((b) => sumRejectionBreakdown(b) >= 0, 'Rincian afkir tidak valid')

export const harvestCreateSchema = z
  .object({
    tandonId: tandonIdSchema,
    date: isoDateSchema,
    totalWeightKg: z.number().positive('Berat total harus lebih dari 0'),
    totalPlants: z.number().int('Jumlah tanaman harus bilangan bulat').min(1),
    rejected: z.number().int('Jumlah afkir harus bilangan bulat').min(0),
    reasons: rejectionBreakdownSchema,
    notes: z.string().max(500, 'Catatan maksimal 500 karakter').nullable(),
  })
  .refine((d) => d.rejected <= d.totalPlants, {
    message: 'Jumlah afkir tidak boleh melebihi total tanaman',
    path: ['rejected'],
  })
  .refine((d) => sumRejectionBreakdown(d.reasons) <= d.rejected, {
    message: 'Total rincian alasan afkir tidak boleh melebihi jumlah afkir',
    path: ['reasons'],
  })

export const harvestUpdateSchema = z
  .object({
    tandonId: tandonIdSchema.optional(),
    date: isoDateSchema.optional(),
    totalWeightKg: z.number().positive('Berat total harus lebih dari 0').optional(),
    totalPlants: z.number().int('Jumlah tanaman harus bilangan bulat').min(1).optional(),
    rejected: z.number().int('Jumlah afkir harus bilangan bulat').min(0).optional(),
    reasons: rejectionBreakdownSchema.optional(),
    notes: z.string().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
  })
  .refine((d) => d.rejected === undefined || d.totalPlants === undefined || d.rejected <= d.totalPlants, {
    message: 'Jumlah afkir tidak boleh melebihi total tanaman',
    path: ['rejected'],
  })

export const tandonUpdateSchema = z
  .object({
    sowingDate: isoDateSchema
      .nullable()
      .refine((v) => v === null || v <= todayISO(), 'Tanggal semai tidak boleh di masa depan')
      .optional(),
    status: z.enum(['Empty', 'Growing', 'Sanitizing']).optional(),
  })
  .refine((d) => d.sowingDate !== undefined || d.status !== undefined, {
    message: 'Minimal salah satu field (sowingDate / status) harus diisi',
  })

export const saleCreateSchema = z.object({
  harvestId: z.string().min(1, 'Batch panen wajib dipilih'),
  date: isoDateSchema,
  buyerCategory: z.enum(['supermarket', 'restaurant', 'wholesaler', 'retail'], {
    errorMap: () => ({ message: 'Kategori pembeli tidak valid' }),
  }),
  buyerName: z.string().trim().min(1, 'Nama pembeli wajib diisi').max(120),
  soldVolumeKg: z.number().positive('Volume terjual harus lebih dari 0'),
  pricePerKg: z.number().int('Harga per kg harus bilangan bulat').positive('Harga per kg harus lebih dari 0'),
  paymentStatus: z.enum(['paid', 'dp', 'tempo'], {
    errorMap: () => ({ message: 'Status pembayaran tidak valid' }),
  }),
  unsoldAction: z.enum(['coldStorage', 'clearance', 'spoilage']).nullable(),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').nullable(),
})

export const saleUpdateSchema = z.object({
  harvestId: z.string().min(1).optional(),
  date: isoDateSchema.optional(),
  buyerCategory: z.enum(['supermarket', 'restaurant', 'wholesaler', 'retail']).optional(),
  buyerName: z.string().trim().min(1, 'Nama pembeli wajib diisi').max(120).optional(),
  soldVolumeKg: z.number().positive('Volume terjual harus lebih dari 0').optional(),
  pricePerKg: z.number().int('Harga per kg harus bilangan bulat').positive('Harga per kg harus lebih dari 0').optional(),
  paymentStatus: z.enum(['paid', 'dp', 'tempo']).optional(),
  unsoldAction: z.enum(['coldStorage', 'clearance', 'spoilage']).nullable().optional(),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
})

export const harvestQuerySchema = z.object({
  tandonId: tandonIdSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})

export const saleQuerySchema = harvestQuerySchema.extend({
  buyerCategory: z.enum(['supermarket', 'restaurant', 'wholesaler', 'retail']).optional(),
  paymentStatus: z.enum(['paid', 'dp', 'tempo']).optional(),
})

export const dashboardQuerySchema = z.object({
  range: z.enum(['30', '90', 'all']).default('all'),
  tandonId: z.enum(['all', 'T1', 'T2', 'T3']).default('all'),
})

export type HarvestCreateInput = z.infer<typeof harvestCreateSchema>
export type HarvestUpdateInput = z.infer<typeof harvestUpdateSchema>
export type TandonUpdateInput = z.infer<typeof tandonUpdateSchema>
export type SaleCreateInput = z.infer<typeof saleCreateSchema>
export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>
export type HarvestQuery = z.infer<typeof harvestQuerySchema>
export type SaleQuery = z.infer<typeof saleQuerySchema>
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type RejectionBreakdownInput = HarvestRejectionBreakdown
