// Port 1:1 dari selada-ops/src/lib/harvestCalculations.ts + salesCalculations.ts.
import { HARVEST_BADGE_THRESHOLDS, TARGET_AVG_WEIGHT_G } from '../domain/constants.js'
import type { HarvestBadge, HarvestEntry, SaleEntry } from '../domain/types.js'

// ---- Harvest ----

export function calculateAvgWeightG(totalWeightKg: number, totalPlants: number): number {
  if (totalPlants <= 0 || totalWeightKg <= 0) return 0
  return (totalWeightKg * 1000) / totalPlants
}

export function calculateSuccessRate(totalPlants: number, rejected: number): number {
  if (totalPlants <= 0) return 0
  const valid = Math.max(0, totalPlants - rejected)
  return (valid / totalPlants) * 100
}

export function getWeightBadge(avgWeightG: number): HarvestBadge {
  for (const rule of HARVEST_BADGE_THRESHOLDS) {
    const { minG, maxG, badge } = rule
    const meetsMin = minG === null || avgWeightG >= minG
    const meetsMax = maxG === null || avgWeightG <= maxG
    if (meetsMin && meetsMax) return badge
  }
  return HARVEST_BADGE_THRESHOLDS[HARVEST_BADGE_THRESHOLDS.length - 1]!.badge
}

export function getDeltaVsTarget(avgWeightG: number): number {
  if (avgWeightG <= 0) return 0
  return avgWeightG - TARGET_AVG_WEIGHT_G
}

export function calculateTotalValidPlants(totalPlants: number, rejected: number): number {
  return Math.max(0, totalPlants - rejected)
}

// ---- Sales ----

export function calculateTotalValue(soldVolumeKg: number, pricePerKg: number): number {
  if (soldVolumeKg <= 0 || pricePerKg <= 0) return 0
  return Math.round(soldVolumeKg * pricePerKg)
}

export function calculateRevenuePerHole(
  totalRevenueBatch: number,
  totalHoles: number = 1000,
): number {
  if (totalHoles <= 0) return 0
  return Math.round(totalRevenueBatch / totalHoles)
}

export function calculateHarvestToCashRatio(totalSoldKg: number, totalHarvestKg: number): number {
  if (totalHarvestKg <= 0) return 0
  return Math.min(100, (totalSoldKg / totalHarvestKg) * 100)
}

export function calculateRemainingStockKg(
  harvest: HarvestEntry | undefined,
  sales: SaleEntry[],
): number {
  if (!harvest) return 0
  const sold = sales
    .filter((s) => s.harvestId === harvest.id)
    .reduce((sum, s) => sum + s.soldVolumeKg, 0)
  return Math.max(0, harvest.totalWeightKg - sold)
}

export function sumSalesRevenueByStatus(
  sales: SaleEntry[],
  statuses?: Array<SaleEntry['paymentStatus']>,
): number {
  return sales
    .filter((s) => !statuses || statuses.includes(s.paymentStatus))
    .reduce((sum, s) => {
      if (s.paymentStatus === 'paid') return sum + s.totalValue
      if (s.paymentStatus === 'dp') return sum + Math.round(s.totalValue * 0.5)
      return sum
    }, 0)
}
