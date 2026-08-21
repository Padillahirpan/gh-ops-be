// Port dari selada-ops/src/constants — warna tandon memakai hex (API konsumen
// non-CSS), selaras resolveTandonColor() di FE dashboardData.ts.
import type {
  CycleEventTone,
  CycleEventType,
  CyclePhase,
  HarvestBadge,
  Tandon,
  TandonId,
  TandonStatus,
} from './types.js'

export const TANDON_IDS: TandonId[] = ['T1', 'T2', 'T3']

export interface TandonConfigEntry {
  id: TandonId
  name: string
  greenhouse: string
  batchCode: string
  holes: number
  color: string
  initialStatus: TandonStatus
}

export const TANDON_CONFIG: Record<TandonId, TandonConfigEntry> = {
  T1: {
    id: 'T1',
    name: 'Tandon 1',
    greenhouse: 'GH 1',
    batchCode: 'Batch A',
    holes: 1000,
    color: '#4C8DC4',
    initialStatus: 'Empty',
  },
  T2: {
    id: 'T2',
    name: 'Tandon 2',
    greenhouse: 'GH 2 Zona A',
    batchCode: 'Batch B',
    holes: 1000,
    color: '#4FA772',
    initialStatus: 'Empty',
  },
  T3: {
    id: 'T3',
    name: 'Tandon 3',
    greenhouse: 'GH 2 Zona B',
    batchCode: 'Batch C',
    holes: 1000,
    color: '#9B7FD1',
    initialStatus: 'Empty',
  },
}

export function createDefaultTandon(id: TandonId): Tandon {
  const cfg = TANDON_CONFIG[id]
  return {
    id,
    name: cfg.name,
    greenhouse: cfg.greenhouse,
    batchCode: cfg.batchCode,
    holes: cfg.holes,
    sowingDate: null,
    status: cfg.initialStatus,
    color: cfg.color,
  }
}

export const CYCLE_TOTAL_DAYS = 47

export const CYCLE_EVENTS: Array<{
  type: CycleEventType
  hss: number
  label: string
  icon: string
  tone: CycleEventTone
}> = [
  { type: 'sowing', hss: 0, label: 'Semai (HSS 0)', icon: '🌱', tone: 'info' },
  { type: 'moveToGutter', hss: 14, label: 'Pindah Talang (HSS 14)', icon: '📦', tone: 'info' },
  { type: 'firstSpray', hss: 16, label: 'Semprot 1 (HSS 16)', icon: '🧴', tone: 'info' },
  { type: 'midSpray', hss: 21, label: 'Semprot 2 (HSS 21)', icon: '🧴', tone: 'info' },
  { type: 'lateSpray', hss: 26, label: 'Semprot 3 (HSS 26)', icon: '🧴', tone: 'info' },
  { type: 'sprayStopWarning', hss: 31, label: '⚠️ STOP Semprot (HSS 31)', icon: '🛑', tone: 'danger' },
  { type: 'preHarvestCheck', hss: 32, label: 'Cek Pra-Panen (HSS 32)', icon: '🔍', tone: 'warning' },
  { type: 'harvest', hss: 45, label: 'Panen (HSS 45)', icon: '🥬', tone: 'success' },
  { type: 'sanitizeStart', hss: 46, label: 'Mulai Sanitasi (HSS 46)', icon: '🧼', tone: 'neutral' },
  { type: 'sanitizeEnd', hss: 47, label: 'Selesai Sanitasi (HSS 47)', icon: '✅', tone: 'success' },
]

export const CHEMICAL_SPRAY_STOP_HSS = 32

export const CYCLE_PHASE_RANGES: Array<{
  phase: CyclePhase
  startHss: number
  endHss: number
}> = [
  { phase: 'Semai', startHss: 0, endHss: 13 },
  { phase: 'Tumbuh', startHss: 14, endHss: 26 },
  { phase: 'Penggemukan', startHss: 27, endHss: 44 },
  { phase: 'Panen', startHss: 45, endHss: 45 },
  { phase: 'Sanitasi', startHss: 46, endHss: 47 },
]

export const TARGET_AVG_WEIGHT_G = 200

export const HARVEST_BADGE_THRESHOLDS: Array<{
  minG: number | null
  maxG: number | null
  badge: HarvestBadge
}> = [
  {
    minG: 200,
    maxG: null,
    badge: { tone: 'success', label: 'Target Tercapai', thresholdText: '≥ 200g' },
  },
  {
    minG: 170,
    maxG: 199,
    badge: { tone: 'warning', label: 'Perlu Perhatian', thresholdText: '170–199g' },
  },
  {
    minG: null,
    maxG: 169,
    badge: { tone: 'danger', label: 'Dibawah Target', thresholdText: '< 170g' },
  },
]

export function sumRejectionBreakdown(b: {
  tipBurn: number
  rootRot: number
  pests: number
  undersized: number
  other: number
}): number {
  return b.tipBurn + b.rootRot + b.pests + b.undersized + b.other
}
