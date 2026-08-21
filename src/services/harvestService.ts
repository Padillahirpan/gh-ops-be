// Service panen — side effect add → tandon Sanitizing (dipadankan addHarvest FE).
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { harvests, sales, tandons, type HarvestRow } from '../db/schema.js'
import { sumRejectionBreakdown } from '../domain/constants.js'
import type { HarvestEntry, StockBatch, TandonId } from '../domain/types.js'
import { calculateAvgWeightG, calculateSuccessRate } from '../lib/calculations.js'
import { BusinessRuleError, NotFoundError } from '../middleware/errors.js'
import { ensureDefaultTandons } from './tandonService.js'
import type { HarvestCreateInput, HarvestQuery, HarvestUpdateInput } from '../validation/schemas.js'

export function toDomain(row: HarvestRow): HarvestEntry {
  return {
    id: row.id,
    tandonId: row.tandonId as TandonId,
    date: row.date,
    totalWeightKg: row.totalWeightKg,
    totalPlants: row.totalPlants,
    rejected: row.rejected,
    reasons: {
      tipBurn: row.tipBurn,
      rootRot: row.rootRot,
      pests: row.pests,
      undersized: row.undersized,
      other: row.other,
    },
    notes: row.notes,
    avgWeightG: row.avgWeightG,
    successRate: row.successRate,
    createdAt: row.createdAt,
  }
}

function getHarvestRowOrThrow(id: string): HarvestRow {
  const row = db.select().from(harvests).where(eq(harvests.id, id)).get()
  if (!row) throw new NotFoundError('Entri panen')
  return row
}

export function listHarvests(query: HarvestQuery): HarvestEntry[] {
  const conditions = []
  if (query.tandonId !== undefined) conditions.push(eq(harvests.tandonId, query.tandonId))
  if (query.from !== undefined) conditions.push(gte(harvests.date, query.from))
  if (query.to !== undefined) conditions.push(lte(harvests.date, query.to))

  const base = db.select().from(harvests)
  const rows =
    conditions.length > 0
      ? base.where(and(...conditions)).orderBy(desc(harvests.date)).all()
      : base.orderBy(desc(harvests.date)).all()
  return rows.map(toDomain)
}

export function getHarvest(id: string): HarvestEntry {
  return toDomain(getHarvestRowOrThrow(id))
}

export function createHarvest(input: HarvestCreateInput): HarvestEntry {
  ensureDefaultTandons()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const avgWeightG = calculateAvgWeightG(input.totalWeightKg, input.totalPlants)
  const successRate = calculateSuccessRate(input.totalPlants, input.rejected)

  db.transaction(() => {
    db.insert(harvests)
      .values({
        id,
        tandonId: input.tandonId,
        date: input.date,
        totalWeightKg: input.totalWeightKg,
        totalPlants: input.totalPlants,
        rejected: input.rejected,
        tipBurn: input.reasons.tipBurn,
        rootRot: input.reasons.rootRot,
        pests: input.reasons.pests,
        undersized: input.reasons.undersized,
        other: input.reasons.other,
        notes: input.notes,
        avgWeightG,
        successRate,
        createdAt,
      })
      .run()
    // Side effect eksplisit: panen tercatat → tandon masuk Sanitizing.
    db.update(tandons).set({ status: 'Sanitizing' }).where(eq(tandons.id, input.tandonId)).run()
  })

  return getHarvest(id)
}

export function updateHarvest(id: string, input: HarvestUpdateInput): HarvestEntry {
  const row = getHarvestRowOrThrow(id)

  const merged = {
    tandonId: (input.tandonId ?? row.tandonId) as TandonId,
    date: input.date ?? row.date,
    totalWeightKg: input.totalWeightKg ?? row.totalWeightKg,
    totalPlants: input.totalPlants ?? row.totalPlants,
    rejected: input.rejected ?? row.rejected,
    reasons: input.reasons ?? {
      tipBurn: row.tipBurn,
      rootRot: row.rootRot,
      pests: row.pests,
      undersized: row.undersized,
      other: row.other,
    },
    notes: input.notes !== undefined ? input.notes : row.notes,
  }

  if (merged.rejected > merged.totalPlants) {
    throw new BusinessRuleError('Jumlah afkir tidak boleh melebihi total tanaman')
  }
  if (sumRejectionBreakdown(merged.reasons) > merged.rejected) {
    throw new BusinessRuleError('Total rincian alasan afkir tidak boleh melebihi jumlah afkir')
  }

  db.update(harvests)
    .set({
      tandonId: merged.tandonId,
      date: merged.date,
      totalWeightKg: merged.totalWeightKg,
      totalPlants: merged.totalPlants,
      rejected: merged.rejected,
      tipBurn: merged.reasons.tipBurn,
      rootRot: merged.reasons.rootRot,
      pests: merged.reasons.pests,
      undersized: merged.reasons.undersized,
      other: merged.reasons.other,
      notes: merged.notes,
      avgWeightG: calculateAvgWeightG(merged.totalWeightKg, merged.totalPlants),
      successRate: calculateSuccessRate(merged.totalPlants, merged.rejected),
    })
    .where(eq(harvests.id, id))
    .run()

  return getHarvest(id)
}

export function deleteHarvest(id: string): void {
  getHarvestRowOrThrow(id)
  // Penjualan terkait ikut terhapus (ON DELETE CASCADE) agar tidak yatim.
  db.delete(harvests).where(eq(harvests.id, id)).run()
}

export function listStockBatches(): StockBatch[] {
  const harvestRows = db.select().from(harvests).orderBy(desc(harvests.date)).all()
  const soldRows = db
    .select({
      harvestId: sales.harvestId,
      soldKg: sql<number>`coalesce(sum(${sales.soldVolumeKg}), 0)`,
    })
    .from(sales)
    .groupBy(sales.harvestId)
    .all()
  const soldByHarvest = new Map(soldRows.map((r) => [r.harvestId, Number(r.soldKg)]))

  return harvestRows.map((row) => {
    const soldKg = soldByHarvest.get(row.id) ?? 0
    return {
      harvestId: row.id,
      tandonId: row.tandonId as TandonId,
      date: row.date,
      totalWeightKg: row.totalWeightKg,
      avgWeightG: row.avgWeightG,
      soldKg,
      remainingKg: Math.max(0, row.totalWeightKg - soldKg),
    }
  })
}
