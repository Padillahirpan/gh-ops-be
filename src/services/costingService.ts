// Service costing — rekap biaya per batch panen + total (F-CST-06) dan
// peringatan harga jual di bawah harga impas (F-CST-09).
import { db } from '../db/client.js'
import { costs, harvests, sales, tandons } from '../db/schema.js'
import type {
  BatchCostDetail,
  BatchCostSummary,
  CostCategory,
  CostEntry,
  CostingOverview,
  CostingTotals,
  CostShareItem,
  CycleBatchInfo,
  TandonId,
  UnassignedCostItem,
} from '../domain/types.js'
import {
  allocateCosts,
  computeBatchMetrics,
  emptyCategoryTotals,
} from '../lib/costCalculations.js'
import { NotFoundError } from '../middleware/errors.js'
import { toDomain as toCostDomain } from './costService.js'
import { listCycleBatches } from './cycleService.js'
import type { CostingQuery } from '../validation/schemas.js'

interface BatchCompanionData {
  /** Panen yang jendela siklusnya = batch ini. */
  harvestsInCycle: Array<{ id: string; totalWeightKg: number }>
  revenue: number
  soldKg: number
  soldValueAll: number
}

function collectBatchData(batch: CycleBatchInfo): BatchCompanionData {
  const harvestRows = db
    .select()
    .from(harvests)
    .all()
    .filter(
      (h) =>
        h.tandonId === batch.tandonId &&
        h.date >= batch.sowingDate &&
        h.date <= batch.cycleEndDate,
    )
  const harvestIds = new Set(harvestRows.map((h) => h.id))

  const saleRows = db
    .select()
    .from(sales)
    .all()
    .filter((s) => harvestIds.has(s.harvestId))

  const revenue = saleRows
    .filter((s) => s.paymentStatus === 'paid' || s.paymentStatus === 'dp')
    .reduce((sum, s) => sum + s.totalValue, 0)
  const soldKg = saleRows.reduce((sum, s) => sum + s.soldVolumeKg, 0)
  const soldValueAll = saleRows.reduce((sum, s) => sum + s.totalValue, 0)

  return {
    harvestsInCycle: harvestRows.map((h) => ({ id: h.id, totalWeightKg: h.totalWeightKg })),
    revenue,
    soldKg,
    soldValueAll,
  }
}

function buildSummary(
  batch: CycleBatchInfo,
  items: CostShareItem[],
  holes: number,
): BatchCostSummary {
  const operationalCost = items
    .filter((i) => i.type === 'operasional')
    .reduce((sum, i) => sum + i.chargedAmount, 0)
  const modalCost = items
    .filter((i) => i.type === 'modal')
    .reduce((sum, i) => sum + i.chargedAmount, 0)
  const totalCost = operationalCost + modalCost

  const { harvestsInCycle, revenue, soldKg, soldValueAll } = collectBatchData(batch)
  const totalHarvestKg = harvestsInCycle.reduce((sum, h) => sum + h.totalWeightKg, 0)

  const metrics = computeBatchMetrics({
    totalCost,
    totalHarvestKg,
    holes,
    revenue,
    soldKg,
    soldValueAll,
  })

  const categoryTotals = emptyCategoryTotals()
  for (const item of items) {
    categoryTotals[item.category as CostCategory] += item.chargedAmount
  }

  return {
    cycleId: batch.id,
    tandonId: batch.tandonId,
    batchCode: batch.batchCode,
    sowingDate: batch.sowingDate,
    cycleEndDate: batch.cycleEndDate,
    status: batch.status,
    implicit: batch.implicit,
    operationalCost,
    modalCost,
    totalCost,
    harvestCount: harvestsInCycle.length,
    totalHarvestKg,
    hasHarvest: harvestsInCycle.length > 0,
    costPerKg: metrics.costPerKg,
    costPerHole: metrics.costPerHole,
    revenue,
    grossProfit: metrics.grossProfit,
    marginPercent: metrics.marginPercent,
    breakEvenPricePerKg: metrics.breakEvenPricePerKg,
    avgSellingPricePerKg: metrics.avgSellingPricePerKg,
    belowBreakEven: metrics.belowBreakEven,
    costItemCount: items.length,
    categoryTotals,
  }
}

function loadAllocation() {
  const batches = listCycleBatches()
  const costEntries: CostEntry[] = db.select().from(costs).all().map(toCostDomain)
  const holesByTandon = new Map(
    db
      .select()
      .from(tandons)
      .all()
      .map((t) => [t.id as TandonId, t.holes]),
  )
  const allocation = allocateCosts(costEntries, batches)
  return { batches, allocation, holesByTandon }
}

function itemBelongsToTandonFilter(item: UnassignedCostItem, tandonId: TandonId): boolean {
  if (item.isUmumShare) return item.shareTandonId === tandonId
  return item.sourceTarget === tandonId
}

export function getCostingOverview(query: CostingQuery): CostingOverview {
  const { batches, allocation, holesByTandon } = loadAllocation()

  const scoped =
    query.tandonId === 'all'
      ? batches
      : batches.filter((b) => b.tandonId === query.tandonId)

  const summaries = scoped.map((batch) =>
    buildSummary(
      batch,
      allocation.byCycle.get(batch.id) ?? [],
      holesByTandon.get(batch.tandonId) ?? 1000,
    ),
  )

  const unassignedItems =
    query.tandonId === 'all'
      ? allocation.unassigned
      : allocation.unassigned.filter((i) =>
          itemBelongsToTandonFilter(i, query.tandonId as TandonId),
        )

  const totalCost = summaries.reduce((s, b) => s + b.totalCost, 0)
  const totalHarvestKg = summaries.reduce((s, b) => s + b.totalHarvestKg, 0)
  const revenue = summaries.reduce((s, b) => s + b.revenue, 0)
  const totalHoles = scoped.reduce(
    (s, b) => s + (holesByTandon.get(b.tandonId) ?? 1000),
    0,
  )

  // Harga jual rata-rata total: Σ nilai jual seluruh status / Σ kg terjual.
  const soldAgg = scoped.reduce(
    (acc, batch) => {
      const data = collectBatchData(batch)
      acc.kg += data.soldKg
      acc.value += data.soldValueAll
      return acc
    },
    { kg: 0, value: 0 },
  )

  const totals: CostingTotals = {
    batchCount: summaries.length,
    operationalCost: summaries.reduce((s, b) => s + b.operationalCost, 0),
    modalCost: summaries.reduce((s, b) => s + b.modalCost, 0),
    totalCost,
    totalHarvestKg,
    costPerKg: totalHarvestKg > 0 ? totalCost / totalHarvestKg : 0,
    costPerHole: totalHoles > 0 ? totalCost / totalHoles : 0,
    revenue,
    grossProfit: revenue - totalCost,
    marginPercent: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0,
    breakEvenPricePerKg: totalHarvestKg > 0 ? totalCost / totalHarvestKg : 0,
    avgSellingPricePerKg: soldAgg.kg > 0 ? soldAgg.value / soldAgg.kg : null,
    belowBreakEvenBatchCount: summaries.filter((b) => b.belowBreakEven).length,
    unassignedCost: unassignedItems.reduce((s, i) => s + i.chargedAmount, 0),
    unassignedCount: unassignedItems.length,
  }

  return {
    filters: { tandonId: query.tandonId },
    totals,
    batches: summaries,
    unassignedItems,
  }
}

export function getBatchCosting(cycleId: string): BatchCostDetail {
  const { batches, allocation, holesByTandon } = loadAllocation()
  const target = batches.find((b) => b.id === cycleId)
  if (!target) throw new NotFoundError('Batch panen (siklus)')

  const items = allocation.byCycle.get(cycleId) ?? []
  const summary = buildSummary(
    target,
    items,
    holesByTandon.get(target.tandonId) ?? 1000,
  )
  const { harvestsInCycle } = collectBatchData(target)

  return {
    ...summary,
    items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
    harvestIds: harvestsInCycle.map((h) => h.id),
  }
}
