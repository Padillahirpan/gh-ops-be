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
