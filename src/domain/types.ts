// Port 1:1 dari selada-ops/src/types agar kontrak API identik dengan tipe FE.

export type TandonId = 'T1' | 'T2' | 'T3'

export type TandonStatus = 'Empty' | 'Growing' | 'Sanitizing'

export interface Tandon {
  id: TandonId
  name: string
  greenhouse: string
  batchCode: string
  holes: number
  sowingDate: string | null
  status: TandonStatus
  color: string
}

export interface HarvestRejectionBreakdown {
  tipBurn: number
  rootRot: number
  pests: number
  undersized: number
  other: number
}

export interface HarvestEntry {
  id: string
  tandonId: TandonId
  date: string
  totalWeightKg: number
  totalPlants: number
  rejected: number
  reasons: HarvestRejectionBreakdown
  notes: string | null
  avgWeightG: number
  successRate: number
  createdAt: string
}

export type HarvestBadgeTone = 'success' | 'warning' | 'danger'

export interface HarvestBadge {
  tone: HarvestBadgeTone
  label: string
  thresholdText: string
}

export type BuyerCategory = 'supermarket' | 'restaurant' | 'wholesaler' | 'retail'

export type PaymentStatus = 'paid' | 'dp' | 'tempo'

export type UnsoldAction = 'coldStorage' | 'clearance' | 'spoilage' | null

export interface SaleEntry {
  id: string
  harvestId: string
  tandonId: TandonId
  date: string
  buyerCategory: BuyerCategory
  buyerName: string
  soldVolumeKg: number
  pricePerKg: number
  totalValue: number
  paymentStatus: PaymentStatus
  unsoldAction: UnsoldAction
  notes: string | null
  createdAt: string
}

export type CycleEventType =
  | 'sowing'
  | 'moveToGutter'
  | 'firstSpray'
  | 'midSpray'
  | 'lateSpray'
  | 'sprayStopWarning'
  | 'preHarvestCheck'
  | 'harvest'
  | 'sanitizeStart'
  | 'sanitizeEnd'

export type CycleEventTone = 'info' | 'warning' | 'danger' | 'success' | 'neutral'

export type CycleEventStatus = 'past' | 'current' | 'upcoming'

export interface CycleEventSchedule {
  type: CycleEventType
  hss: number
  date: string
  label: string
  icon: string
  tone: CycleEventTone
  status: CycleEventStatus
}

export interface NextCycleEvent {
  event: CycleEventSchedule
  daysRemaining: number
}

export type CyclePhase =
  | 'Belum Mulai'
  | 'Semai'
  | 'Tumbuh'
  | 'Penggemukan'
  | 'Panen'
  | 'Sanitasi'

export interface TandonCycleInfo {
  tandonId: TandonId
  hss: number | null
  phase: CyclePhase
  progressPercent: number
  sprayAllowed: boolean
  events: CycleEventSchedule[]
  nextEvent: NextCycleEvent | null
}

export interface StockBatch {
  harvestId: string
  tandonId: TandonId
  date: string
  totalWeightKg: number
  avgWeightG: number
  soldKg: number
  remainingKg: number
}

// ---- Modul Biaya & Modal ----

export type CostType = 'operasional' | 'modal'

export type CostCategory =
  | 'benihRockwool'
  | 'nutrisi'
  | 'pestisida'
  | 'listrikAir'
  | 'tenagaKerja'
  | 'kemasanTransportasi'
  | 'peralatanMesin'
  | 'perbaikan'
  | 'lainLain'

export type CostTarget = TandonId | 'UMUM'

export interface CostEntry {
  id: string
  date: string
  type: CostType
  category: CostCategory
  description: string
  /** Nominal rupiah (bilangan bulat). Dihitung dari quantity × unitPrice bila keduanya diisi. */
  amount: number
  target: CostTarget
  supplier: string | null
  notes: string | null
  quantity: number | null
  unitPrice: number | null
  /** Modal & Aset: 1 = dibebankan penuh ke siklus anchor, N > 1 = disebar ke N siklus berurutan. */
  spreadCycles: number
  /** Override manual batch panen; null = dikelompokkan otomatis dari tandon + tanggal. */
  cycleId: string | null
  createdAt: string
  updatedAt: string
}

/** Batch panen = satu siklus tanam tandon (HSS 0 s.d. sanitasi selesai / HSS 47). */
export interface CycleBatchInfo {
  id: string
  tandonId: TandonId
  sowingDate: string
  cycleEndDate: string
  batchCode: string
  status: 'Berjalan' | 'Selesai'
  /** true bila batch disintesis dari data panen lama yang tidak punya record siklus. */
  implicit: boolean
  createdAt: string | null
}

export interface CostShareItem {
  costId: string
  date: string
  type: CostType
  category: CostCategory
  description: string
  supplier: string | null
  /** Target asli pada entri biaya (T1/T2/T3/UMUM). */
  sourceTarget: CostTarget
  /** Tandon penerima porsi (untuk pembagian biaya Umum). */
  shareTandonId: TandonId | null
  isUmumShare: boolean
  /** Porsi rupiah yang dibebankan ke batch ini. */
  chargedAmount: number
  originalAmount: number
  spreadIndex: number | null
  spreadTotal: number
}

export interface UnassignedCostItem extends CostShareItem {
  reason: string
}

export interface BatchCostSummary {
  cycleId: string
  tandonId: TandonId
  batchCode: string
  sowingDate: string
  cycleEndDate: string
  status: CycleBatchInfo['status']
  implicit: boolean
  operationalCost: number
  modalCost: number
  totalCost: number
  harvestCount: number
  totalHarvestKg: number
  hasHarvest: boolean
  costPerKg: number
  costPerHole: number
  revenue: number
  grossProfit: number
  marginPercent: number
  breakEvenPricePerKg: number
  avgSellingPricePerKg: number | null
  belowBreakEven: boolean
  costItemCount: number
  categoryTotals: Record<CostCategory, number>
}

export interface BatchCostDetail extends BatchCostSummary {
  items: CostShareItem[]
  harvestIds: string[]
}

export interface CostingTotals {
  batchCount: number
  operationalCost: number
  modalCost: number
  totalCost: number
  totalHarvestKg: number
  costPerKg: number
  costPerHole: number
  revenue: number
  grossProfit: number
  marginPercent: number
  breakEvenPricePerKg: number
  avgSellingPricePerKg: number | null
  belowBreakEvenBatchCount: number
  unassignedCost: number
  unassignedCount: number
}

export interface CostingOverview {
  filters: { tandonId: TandonId | 'all' }
  totals: CostingTotals
  batches: BatchCostSummary[]
  unassignedItems: UnassignedCostItem[]
}

export interface DashboardAggregates {
  totalHarvestKg: number
  avgWeightG: number
  avgWeightBadgeTone: HarvestBadgeTone
  totalRevenue: number
  successRate: number
  readyStockKg: number
  harvestCount: number
  rejectionTotals: HarvestRejectionBreakdown
  buyerTotals: Record<string, number>
  weightTrend: Array<{
    date: string
    label: string
    [tandon: string]: string | number
  }>
  harvestVsSold: Array<{
    tandon: string
    Panen: number
    Terjual: number
  }>
  revenuePerTandon: Array<{
    tandon: string
    revenue: number
  }>
  hasData: boolean
}
