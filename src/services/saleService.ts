// Service penjualan — tandonId diturunkan dari batch panen (sumber kebenaran),
// totalValue dihitung server-side, volume dibatasi sisa stok batch.
import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { harvests, sales, type HarvestRow, type SaleRow } from '../db/schema.js'
import type { BuyerCategory, PaymentStatus, SaleEntry, TandonId, UnsoldAction } from '../domain/types.js'
import { calculateTotalValue } from '../lib/calculations.js'
import { BusinessRuleError, NotFoundError } from '../middleware/errors.js'
import type { SaleCreateInput, SaleQuery, SaleUpdateInput } from '../validation/schemas.js'

export function toDomain(row: SaleRow): SaleEntry {
  return {
    id: row.id,
    harvestId: row.harvestId,
    tandonId: row.tandonId as TandonId,
    date: row.date,
    buyerCategory: row.buyerCategory,
    buyerName: row.buyerName,
    soldVolumeKg: row.soldVolumeKg,
    pricePerKg: row.pricePerKg,
    totalValue: row.totalValue,
    paymentStatus: row.paymentStatus,
    unsoldAction: row.unsoldAction,
    notes: row.notes,
    createdAt: row.createdAt,
  }
}

function getHarvestRowOrThrow(id: string): HarvestRow {
  const row = db.select().from(harvests).where(eq(harvests.id, id)).get()
  if (!row) throw new NotFoundError('Batch panen')
  return row
}

function getSaleRowOrThrow(id: string): SaleRow {
  const row = db.select().from(sales).where(eq(sales.id, id)).get()
  if (!row) throw new NotFoundError('Entri penjualan')
  return row
}

function soldKgForHarvest(harvestId: string, excludeSaleId?: string): number {
  const conditions = [eq(sales.harvestId, harvestId)]
  if (excludeSaleId !== undefined) conditions.push(ne(sales.id, excludeSaleId))
  const row = db
    .select({ soldKg: sql<number>`coalesce(sum(${sales.soldVolumeKg}), 0)` })
    .from(sales)
    .where(and(...conditions))
    .get()
  return row ? Number(row.soldKg) : 0
}

function assertStockAvailable(
  harvest: HarvestRow,
  requestedVolumeKg: number,
  excludeSaleId?: string,
): void {
  const soldToOthers = soldKgForHarvest(harvest.id, excludeSaleId)
  const remaining = harvest.totalWeightKg - soldToOthers
  if (requestedVolumeKg > remaining + 1e-9) {
    throw new BusinessRuleError(
      `Volume terjual melebihi sisa stok batch (sisa ${Math.max(0, remaining).toFixed(1)} kg)`,
    )
  }
}

export function listSales(query: SaleQuery): SaleEntry[] {
  const conditions = []
  if (query.tandonId !== undefined) conditions.push(eq(sales.tandonId, query.tandonId))
  if (query.from !== undefined) conditions.push(gte(sales.date, query.from))
  if (query.to !== undefined) conditions.push(lte(sales.date, query.to))
  if (query.buyerCategory !== undefined) conditions.push(eq(sales.buyerCategory, query.buyerCategory))
  if (query.paymentStatus !== undefined) conditions.push(eq(sales.paymentStatus, query.paymentStatus))

  const base = db.select().from(sales)
  const rows =
    conditions.length > 0
      ? base.where(and(...conditions)).orderBy(desc(sales.date)).all()
      : base.orderBy(desc(sales.date)).all()
  return rows.map(toDomain)
}

export function getSale(id: string): SaleEntry {
  return toDomain(getSaleRowOrThrow(id))
}

export function createSale(input: SaleCreateInput): SaleEntry {
  const harvest = getHarvestRowOrThrow(input.harvestId)
  assertStockAvailable(harvest, input.soldVolumeKg)

  const id = crypto.randomUUID()
  db.insert(sales)
    .values({
      id,
      harvestId: harvest.id,
      tandonId: harvest.tandonId,
      date: input.date,
      buyerCategory: input.buyerCategory,
      buyerName: input.buyerName,
      soldVolumeKg: input.soldVolumeKg,
      pricePerKg: input.pricePerKg,
      totalValue: calculateTotalValue(input.soldVolumeKg, input.pricePerKg),
      paymentStatus: input.paymentStatus,
      unsoldAction: input.unsoldAction,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    })
    .run()

  return getSale(id)
}

export function updateSale(id: string, input: SaleUpdateInput): SaleEntry {
  const row = getSaleRowOrThrow(id)

  const harvestId = input.harvestId ?? row.harvestId
  const harvest = getHarvestRowOrThrow(harvestId)

  const soldVolumeKg = input.soldVolumeKg ?? row.soldVolumeKg
  // Cek stok terhadap batch tujuan, mengabaikan volume entry yang sedang diedit.
  assertStockAvailable(harvest, soldVolumeKg, id)

  const merged = {
    date: input.date ?? row.date,
    buyerCategory: (input.buyerCategory ?? row.buyerCategory) as BuyerCategory,
    buyerName: input.buyerName ?? row.buyerName,
    pricePerKg: input.pricePerKg ?? row.pricePerKg,
    paymentStatus: (input.paymentStatus ?? row.paymentStatus) as PaymentStatus,
    unsoldAction:
      input.unsoldAction !== undefined ? (input.unsoldAction as UnsoldAction) : row.unsoldAction,
    notes: input.notes !== undefined ? input.notes : row.notes,
  }

  db.update(sales)
    .set({
      harvestId: harvest.id,
      tandonId: harvest.tandonId,
      date: merged.date,
      buyerCategory: merged.buyerCategory,
      buyerName: merged.buyerName,
      soldVolumeKg,
      pricePerKg: merged.pricePerKg,
      totalValue: calculateTotalValue(soldVolumeKg, merged.pricePerKg),
      paymentStatus: merged.paymentStatus,
      unsoldAction: merged.unsoldAction,
      notes: merged.notes,
    })
    .where(eq(sales.id, id))
    .run()

  return getSale(id)
}

export function deleteSale(id: string): void {
  getSaleRowOrThrow(id)
  db.delete(sales).where(eq(sales.id, id)).run()
}
