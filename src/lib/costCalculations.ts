// Kalkulasi murni Modul Biaya & Modal (F-CST-03 s.d. F-CST-09).
// Semua nominal dalam rupiah bulat; pembagian dibulatkan dengan sisa
// didistribusikan ke porsi terdepan agar total tidak hilang satu rupiah pun.
import { TANDON_IDS } from '../domain/constants.js'
import type {
  CostCategory,
  CostEntry,
  CostShareItem,
  CycleBatchInfo,
  TandonId,
  UnassignedCostItem,
} from '../domain/types.js'

/** 950.000 dibagi 3 → [316667, 316667, 316666] (Σ tetap 950.000). */
export function splitAmountEvenly(amount: number, parts: number): number[] {
  if (parts <= 0) return []
  if (parts === 1) return [amount]
  const base = Math.floor(amount / parts)
  const shares = Array.from({ length: parts }, () => base)
  let remainder = amount - base * parts
  let i = 0
  while (remainder > 0) {
    shares[i]! += 1
    remainder -= 1
    i = (i + 1) % parts
  }
  return shares
}

/** Siklus tandon yang jendelanya (HSS 0 s.d. 47) memuat tanggal biaya; ambil semai terakhir. */
export function findCycleForDate(
  batches: CycleBatchInfo[],
  tandonId: TandonId,
  date: string,
): CycleBatchInfo | null {
  const candidates = batches
    .filter((b) => b.tandonId === tandonId && date >= b.sowingDate && date <= b.cycleEndDate)
    .sort((a, b) => b.sowingDate.localeCompare(a.sowingDate))
  return candidates[0] ?? null
}

export interface CostAllocation {
  byCycle: Map<string, CostShareItem[]>
  unassigned: UnassignedCostItem[]
}

function makeItem(
  cost: CostEntry,
  chargedAmount: number,
  opts: { isUmumShare: boolean; shareTandonId: TandonId | null; spreadIndex: number | null },
): CostShareItem {
  return {
    costId: cost.id,
    date: cost.date,
    type: cost.type,
    category: cost.category,
    description: cost.description,
    supplier: cost.supplier,
    sourceTarget: cost.target,
    shareTandonId: opts.shareTandonId,
    isUmumShare: opts.isUmumShare,
    chargedAmount,
    originalAmount: cost.amount,
    spreadIndex: opts.spreadIndex,
    spreadTotal: cost.spreadCycles,
  }
}

/**
 * Alokasikan seluruh entri biaya ke batch panen:
 * - Target tandon (F-CST-03): anchor = siklus yang memuat tanggal biaya,
 *   atau siklus manual bila `cycleId` terisi. Di luar jendela siklus → unassigned.
 * - Target UMUM (F-CST-04): dibagi rata ke 3 tandon, tiap porsi dicari-anchor per tandon.
 * - Modal & Aset (F-CST-05): spreadCycles = N membebankan amount/N ke N siklus
 *   berurutan tandon yang sama mulai dari anchor; siklus yang belum ada akan
 *   otomatis mendapat porsi begitu record siklusnya dibuat.
 */
export function allocateCosts(costs: CostEntry[], batches: CycleBatchInfo[]): CostAllocation {
  const byCycle = new Map<string, CostShareItem[]>()
  const unassigned: UnassignedCostItem[] = []

  const charge = (item: CostShareItem, cycleId: string) => {
    const list = byCycle.get(cycleId)
    if (list) list.push(item)
    else byCycle.set(cycleId, [item])
  }

  const distributeFromAnchor = (
    cost: CostEntry,
    amount: number,
    anchor: CycleBatchInfo,
    opts: { isUmumShare: boolean; shareTandonId: TandonId | null },
  ) => {
    if (cost.type === 'modal' && cost.spreadCycles > 1) {
      const ordered = batches
        .filter((b) => b.tandonId === anchor.tandonId)
        .sort((a, b) => a.sowingDate.localeCompare(b.sowingDate))
      const anchorIdx = ordered.findIndex((b) => b.id === anchor.id)
      const shares = splitAmountEvenly(amount, cost.spreadCycles)
      for (let j = 0; j < cost.spreadCycles; j++) {
        const target = ordered[anchorIdx + j]
        if (!target) continue // siklus berikutnya belum dibuat
        charge(
          makeItem(cost, shares[j]!, { ...opts, spreadIndex: j + 1 }),
          target.id,
        )
      }
    } else {
      charge(makeItem(cost, amount, { ...opts, spreadIndex: null }), anchor.id)
    }
  }

  for (const cost of costs) {
    if (cost.target === 'UMUM') {
      const shares = splitAmountEvenly(cost.amount, TANDON_IDS.length)
      TANDON_IDS.forEach((tandonId, i) => {
        const anchor = findCycleForDate(batches, tandonId, cost.date)
        if (!anchor) {
          unassigned.push({
            ...makeItem(cost, shares[i]!, {
              isUmumShare: true,
              shareTandonId: tandonId,
              spreadIndex: null,
            }),
            reason: `Tandon ${tandonId} tidak memiliki siklus aktif pada tanggal biaya`,
          })
          return
        }
        distributeFromAnchor(cost, shares[i]!, anchor, {
          isUmumShare: true,
          shareTandonId: tandonId,
        })
      })
      continue
    }

    const anchor = cost.cycleId
      ? (batches.find((b) => b.id === cost.cycleId) ?? null)
      : findCycleForDate(batches, cost.target as TandonId, cost.date)
    if (!anchor) {
      unassigned.push({
        ...makeItem(cost, cost.amount, {
          isUmumShare: false,
          shareTandonId: null,
          spreadIndex: null,
        }),
        reason:
          'Tanggal biaya berada di luar jendela siklus tandon — pindahkan manual ke batch tertentu bila perlu',
      })
      continue
    }
    distributeFromAnchor(cost, cost.amount, anchor, {
      isUmumShare: false,
      shareTandonId: null,
    })
  }

  return { byCycle, unassigned }
}

export interface BatchMetricInput {
  totalCost: number
  totalHarvestKg: number
  holes: number
  /** Revenue = Σ totalValue penjualan berstatus paid/dp (konsisten analitik). */
  revenue: number
  /** Σ kg terjual seluruh status — untuk harga jual rata-rata. */
  soldKg: number
  /** Σ totalValue seluruh status. */
  soldValueAll: number
}

export interface BatchMetrics {
  costPerKg: number
  costPerHole: number
  grossProfit: number
  marginPercent: number
  breakEvenPricePerKg: number
  avgSellingPricePerKg: number | null
  belowBreakEven: boolean
}

/** Rumus F-CST-06 & peringatan F-CST-09 (harga impas). */
export function computeBatchMetrics(input: BatchMetricInput): BatchMetrics {
  const { totalCost, totalHarvestKg, holes, revenue, soldKg, soldValueAll } = input
  const costPerKg = totalHarvestKg > 0 ? totalCost / totalHarvestKg : 0
  const costPerHole = holes > 0 ? totalCost / holes : 0
  const grossProfit = revenue - totalCost
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const avgSellingPricePerKg = soldKg > 0 ? soldValueAll / soldKg : null
  const breakEvenPricePerKg = costPerKg
  return {
    costPerKg,
    costPerHole,
    grossProfit,
    marginPercent,
    breakEvenPricePerKg,
    avgSellingPricePerKg,
    belowBreakEven:
      avgSellingPricePerKg !== null &&
      breakEvenPricePerKg > 0 &&
      avgSellingPricePerKg < breakEvenPricePerKg,
  }
}

export function emptyCategoryTotals(): Record<CostCategory, number> {
  return {
    benihRockwool: 0,
    nutrisi: 0,
    pestisida: 0,
    listrikAir: 0,
    tenagaKerja: 0,
    kemasanTransportasi: 0,
    peralatanMesin: 0,
    perbaikan: 0,
    lainLain: 0,
  }
}
