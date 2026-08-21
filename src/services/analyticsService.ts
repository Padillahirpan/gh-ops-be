// Service analitik — port computeDashboardAggregates + filterByRange dari FE,
// ditambah agregat periode sebelumnya untuk delta KPI.
import { desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { harvests, sales } from '../db/schema.js'
import { TANDON_IDS } from '../domain/constants.js'
import type {
  DashboardAggregates,
  HarvestEntry,
  SaleEntry,
  TandonId,
} from '../domain/types.js'
import { subDaysISO, todayISO } from '../lib/dateUtils.js'
import { toDomain as toHarvestDomain } from './harvestService.js'
import { toDomain as toSaleDomain } from './saleService.js'
import type { DashboardQuery } from '../validation/schemas.js'

interface WindowBounds {
  from: string
  to: string
}

function windowFor(range: DashboardQuery['range']): { current: WindowBounds; previous: WindowBounds } {
  const to = todayISO()
  if (range === 'all') {
    return { current: { from: '0000-01-01', to }, previous: { from: '0000-01-01', to: '0000-01-01' } }
  }
  const n = Number(range)
  return {
    current: { from: subDaysISO(n), to },
    previous: { from: subDaysISO(2 * n), to: subDaysISO(n + 1) },
  }
}

function inWindow(date: string, bounds: WindowBounds): boolean {
  return date >= bounds.from && date <= bounds.to
}

function computeAggregates(
  allHarvests: HarvestEntry[],
  allSales: SaleEntry[],
  bounds: WindowBounds,
  tandonId: TandonId | 'all',
): DashboardAggregates {
  const filteredHarvests = allHarvests.filter(
    (h) => inWindow(h.date, bounds) && (tandonId === 'all' || h.tandonId === tandonId),
  )
  const filteredSales = allSales.filter(
    (s) => inWindow(s.date, bounds) && (tandonId === 'all' || s.tandonId === tandonId),
  )

  const harvestIds = new Set(filteredHarvests.map((h) => h.id))
  const validSales = filteredSales.filter((s) => harvestIds.has(s.harvestId))

  const totalHarvestKg = filteredHarvests.reduce((sum, h) => sum + h.totalWeightKg, 0)
  const totalPlants = filteredHarvests.reduce((sum, h) => sum + h.totalPlants, 0)
  const totalRejected = filteredHarvests.reduce((sum, h) => sum + h.rejected, 0)
  const totalWeightedSum = filteredHarvests.reduce(
    (sum, h) => sum + h.avgWeightG * h.totalPlants,
    0,
  )
  const avgWeightG = totalPlants > 0 ? totalWeightedSum / totalPlants : 0
  const successRate = totalPlants > 0 ? ((totalPlants - totalRejected) / totalPlants) * 100 : 0

  const totalRevenue = validSales
    .filter((s) => s.paymentStatus === 'paid' || s.paymentStatus === 'dp')
    .reduce((sum, s) => sum + s.totalValue, 0)

  const totalSoldKg = validSales.reduce((sum, s) => sum + s.soldVolumeKg, 0)
  const readyStockKg = Math.max(0, totalHarvestKg - totalSoldKg)

  const rejectionTotals = filteredHarvests.reduce(
    (acc, h) => ({
      tipBurn: acc.tipBurn + h.reasons.tipBurn,
      rootRot: acc.rootRot + h.reasons.rootRot,
      pests: acc.pests + h.reasons.pests,
      undersized: acc.undersized + h.reasons.undersized,
      other: acc.other + h.reasons.other,
    }),
    { tipBurn: 0, rootRot: 0, pests: 0, undersized: 0, other: 0 },
  )

  const buyerTotals = validSales.reduce<Record<string, number>>((acc, s) => {
    acc[s.buyerCategory] = (acc[s.buyerCategory] ?? 0) + s.totalValue
    return acc
  }, {})

  const weightTrend = [...filteredHarvests]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => ({
      date: h.date,
      label: h.date.slice(5),
      [h.tandonId]: Math.round(h.avgWeightG),
    }))

  const harvestVsSold = TANDON_IDS.map((id) => {
    const tHarvests = filteredHarvests.filter((h) => h.tandonId === id)
    const tIds = new Set(tHarvests.map((h) => h.id))
    const tSold = validSales
      .filter((s) => tIds.has(s.harvestId))
      .reduce((sum, s) => sum + s.soldVolumeKg, 0)
    const tHarvestKg = tHarvests.reduce((sum, h) => sum + h.totalWeightKg, 0)
    return {
      tandon: id,
      Panen: Math.round(tHarvestKg * 10) / 10,
      Terjual: Math.round(tSold * 10) / 10,
    }
  })

  const revenuePerTandon = TANDON_IDS.map((id) => {
    const tIds = new Set(
      filteredHarvests.filter((h) => h.tandonId === id).map((h) => h.id),
    )
    const revenue = validSales
      .filter((s) => tIds.has(s.harvestId))
      .reduce((sum, s) => sum + s.totalValue, 0)
    return { tandon: id, revenue }
  })

  return {
    totalHarvestKg,
    avgWeightG,
    avgWeightBadgeTone:
      avgWeightG >= 200 ? 'success' : avgWeightG >= 170 ? 'warning' : 'danger',
    totalRevenue,
    successRate,
    readyStockKg,
    harvestCount: filteredHarvests.length,
    rejectionTotals,
    buyerTotals,
    weightTrend,
    harvestVsSold,
    revenuePerTandon,
    hasData: filteredHarvests.length > 0 || filteredSales.length > 0,
  }
}

export interface DashboardResponse {
  filters: { range: DashboardQuery['range']; tandonId: TandonId | 'all' }
  current: DashboardAggregates
  previous: DashboardAggregates
}

export function getDashboard(query: DashboardQuery): DashboardResponse {
  const allHarvests = db.select().from(harvests).orderBy(desc(harvests.date)).all().map(toHarvestDomain)
  const allSales = db.select().from(sales).orderBy(desc(sales.date)).all().map(toSaleDomain)

  const { current, previous } = windowFor(query.range)
  return {
    filters: { range: query.range, tandonId: query.tandonId },
    current: computeAggregates(allHarvests, allSales, current, query.tandonId),
    previous: computeAggregates(allHarvests, allSales, previous, query.tandonId),
  }
}
