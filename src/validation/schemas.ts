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

// ---- Modul Biaya & Modal ----

export const costTypeSchema = z.enum(['operasional', 'modal'], {
  errorMap: () => ({ message: 'Tipe biaya harus operasional atau modal' }),
})

export const costCategorySchema = z.enum(
  [
    'benihRockwool',
    'nutrisi',
    'pestisida',
    'listrikAir',
    'tenagaKerja',
    'kemasanTransportasi',
    'peralatanMesin',
    'perbaikan',
    'lainLain',
  ],
  { errorMap: () => ({ message: 'Kategori biaya tidak valid' }) },
)

export const costTargetSchema = z.enum(['T1', 'T2', 'T3', 'UMUM'], {
  errorMap: () => ({ message: 'Untuk harus salah satu dari T1, T2, T3, atau UMUM' }),
})

const quantityField = z
  .number({ invalid_type_error: 'Jumlah harus berupa angka' })
  .positive('Jumlah harus lebih dari 0')
  .nullable()
  .optional()

const unitPriceField = z
  .number({ invalid_type_error: 'Harga satuan harus berupa angka' })
  .int('Harga satuan harus bilangan bulat Rupiah')
  .positive('Harga satuan harus lebih dari 0')
  .nullable()
  .optional()

const spreadCyclesField = z
  .number({ invalid_type_error: 'Penyebaran siklus harus berupa angka' })
  .int('Penyebaran siklus harus bilangan bulat')
  .min(1, 'Penyebaran siklus minimal 1 (penuh ke siklus saat ini)')
  .max(24, 'Penyebaran siklus maksimal 24')
  .optional()

const costBaseFields = {
  date: isoDateSchema.optional(),
  type: costTypeSchema.optional(),
  category: costCategorySchema.optional(),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(300, 'Deskripsi maksimal 300 karakter').optional(),
  amount: z
    .number({ invalid_type_error: 'Nominal harus berupa angka' })
    .int('Nominal harus bilangan bulat Rupiah')
    .positive('Nominal harus lebih dari 0')
    .optional(),
  target: costTargetSchema.optional(),
  supplier: z.string().trim().max(120, 'Nama supplier maksimal 120 karakter').nullable().optional(),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
  quantity: quantityField,
  unitPrice: unitPriceField,
  spreadCycles: spreadCyclesField,
  cycleId: z.string().min(1).nullable().optional(),
}

// Refinemen lintas field ditulis inline pada tiap .refine() agar parameter `d`
// ter-type kontekstual dari skema (kompatibel dengan exactOptionalPropertyTypes).
export const costCreateSchema = z
  .object({
    ...costBaseFields,
    date: isoDateSchema,
    type: costTypeSchema,
    category: costCategorySchema,
    description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(300, 'Deskripsi maksimal 300 karakter'),
    target: costTargetSchema,
  })
  .refine((d) => d.amount !== undefined || (d.quantity != null && d.unitPrice != null), {
    message: 'Nominal wajib diisi (atau isi jumlah + harga satuan agar nominal dihitung otomatis)',
    path: ['amount'],
  })
  .refine((d) => (d.quantity == null) === (d.unitPrice == null), {
    message: 'Jumlah dan harga satuan harus diisi (atau dikosongkan) bersamaan',
    path: ['quantity'],
  })
  .refine(
    (d) =>
      !(
        d.amount !== undefined &&
        d.quantity != null &&
        d.unitPrice != null &&
        Math.abs(d.amount - d.quantity * d.unitPrice) > 1
      ),
    {
      message: 'Nominal tidak cocok dengan jumlah × harga satuan',
      path: ['amount'],
    },
  )
  .refine((d) => !(d.type === 'operasional' && d.spreadCycles !== undefined && d.spreadCycles > 1), {
    message: 'Penyebaran siklus hanya berlaku untuk biaya Modal & Aset',
    path: ['spreadCycles'],
  })
  .refine((d) => !(d.target === 'UMUM' && d.cycleId != null), {
    message: 'Biaya Umum dibagi rata ke tandon dan tidak dapat dipatok manual ke satu siklus',
    path: ['cycleId'],
  })

export const costUpdateSchema = z
  .object(costBaseFields)
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi',
  })

export const costQuerySchema = z.object({
  target: costTargetSchema.optional(),
  type: costTypeSchema.optional(),
  category: costCategorySchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})

export const cycleQuerySchema = z.object({
  tandonId: tandonIdSchema.optional(),
})

export const costingQuerySchema = z.object({
  tandonId: z.enum(['all', 'T1', 'T2', 'T3']).default('all'),
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
export type CostCreateInput = z.infer<typeof costCreateSchema>
export type CostUpdateInput = z.infer<typeof costUpdateSchema>
export type CostQuery = z.infer<typeof costQuerySchema>
export type CycleQuery = z.infer<typeof cycleQuerySchema>
export type CostingQuery = z.infer<typeof costingQuerySchema>
