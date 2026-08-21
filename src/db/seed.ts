// Seed demo — padanan createDemoSeedData() di selada-ops/src/data/mockData.ts.
// Idempoten: dilewati jika data sudah ada, kecuali dijalankan dengan --force.
import { count } from 'drizzle-orm'
import { calculateAvgWeightG, calculateSuccessRate, calculateTotalValue } from '../lib/calculations.js'
import { subDaysISO } from '../lib/dateUtils.js'
import { TANDON_IDS, TANDON_CONFIG } from '../domain/constants.js'
import type { HarvestRejectionBreakdown, TandonId, TandonStatus } from '../domain/types.js'
import { db, sqlite } from './client.js'
import { harvests, sales, tandons } from './schema.js'
import { runMigrations } from './migrate.js'

const force = process.argv.includes('--force')

function buildTandonRows() {
  const sowing: Array<{ id: TandonId; daysAgo: number; status: TandonStatus }> = [
    { id: 'T1', daysAgo: 40, status: 'Growing' },
    { id: 'T2', daysAgo: 25, status: 'Growing' },
    { id: 'T3', daysAgo: 10, status: 'Growing' },
  ]
  const byId = new Map(sowing.map((s) => [s.id, s]))
  return TANDON_IDS.map((id) => {
    const cfg = TANDON_CONFIG[id]
    const s = byId.get(id)
    return {
      id,
      name: cfg.name,
      greenhouse: cfg.greenhouse,
      batchCode: cfg.batchCode,
      holes: cfg.holes,
      color: cfg.color,
      sowingDate: s ? subDaysISO(s.daysAgo) : null,
      status: (s?.status ?? cfg.initialStatus) satisfies TandonStatus,
    }
  })
}

interface HarvestSeed {
  id: string
  tandonId: TandonId
  daysAgo: number
  totalWeightKg: number
  totalPlants: number
  rejected: number
  reasons: HarvestRejectionBreakdown
  notes: string | null
}

const HARVEST_SEEDS: HarvestSeed[] = [
  {
    id: 'demo-h1', tandonId: 'T1', daysAgo: 92, totalWeightKg: 218.4, totalPlants: 1050, rejected: 48,
    reasons: { tipBurn: 22, rootRot: 8, pests: 6, undersized: 9, other: 3 },
    notes: 'Siklus stabil, EC dijaga 1.6',
  },
  {
    id: 'demo-h2', tandonId: 'T2', daysAgo: 78, totalWeightKg: 186.2, totalPlants: 1020, rejected: 95,
    reasons: { tipBurn: 41, rootRot: 22, pests: 12, undersized: 15, other: 5 },
    notes: 'Tip burn naik, cek kipas & kelembapan',
  },
  {
    id: 'demo-h3', tandonId: 'T3', daysAgo: 64, totalWeightKg: 205.7, totalPlants: 1040, rejected: 36,
    reasons: { tipBurn: 12, rootRot: 7, pests: 9, undersized: 5, other: 3 },
    notes: null,
  },
  {
    id: 'demo-h4', tandonId: 'T1', daysAgo: 50, totalWeightKg: 198.1, totalPlants: 1035, rejected: 62,
    reasons: { tipBurn: 25, rootRot: 14, pests: 10, undersized: 8, other: 5 },
    notes: 'Hampir target, naikkan EC sedikit',
  },
  {
    id: 'demo-h5', tandonId: 'T2', daysAgo: 36, totalWeightKg: 162.5, totalPlants: 1010, rejected: 118,
    reasons: { tipBurn: 52, rootRot: 31, pests: 18, undersized: 12, other: 5 },
    notes: 'Cuaca panas, root rot meningkat',
  },
  {
    id: 'demo-h6', tandonId: 'T3', daysAgo: 22, totalWeightKg: 212.9, totalPlants: 1045, rejected: 29,
    reasons: { tipBurn: 9, rootRot: 6, pests: 7, undersized: 4, other: 3 },
    notes: 'Batch terbaik season ini',
  },
]

interface SaleSeed {
  id: string
  harvestId: string
  daysAgo: number
  buyerCategory: 'supermarket' | 'restaurant' | 'wholesaler' | 'retail'
  buyerName: string
  soldVolumeKg: number
  pricePerKg: number
  paymentStatus: 'paid' | 'dp' | 'tempo'
  unsoldAction: 'coldStorage' | 'clearance' | 'spoilage' | null
  notes: string | null
}

const SALE_SEEDS: SaleSeed[] = [
  { id: 'demo-s1', harvestId: 'demo-h1', daysAgo: 90, buyerCategory: 'supermarket', buyerName: 'FreshMarket Kemang', soldVolumeKg: 120, pricePerKg: 45000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s2', harvestId: 'demo-h1', daysAgo: 88, buyerCategory: 'restaurant', buyerName: 'Bistro Selada', soldVolumeKg: 48.5, pricePerKg: 50000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s3', harvestId: 'demo-h1', daysAgo: 85, buyerCategory: 'wholesaler', buyerName: 'Pak Darto', soldVolumeKg: 40, pricePerKg: 32000, paymentStatus: 'dp', unsoldAction: 'coldStorage', notes: 'Sisa masuk chiller' },
  { id: 'demo-s4', harvestId: 'demo-h2', daysAgo: 76, buyerCategory: 'supermarket', buyerName: 'Ranch Market BSD', soldVolumeKg: 95, pricePerKg: 44000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s5', harvestId: 'demo-h2', daysAgo: 73, buyerCategory: 'wholesaler', buyerName: 'Tengkulak Pasar Minggu', soldVolumeKg: 60, pricePerKg: 30000, paymentStatus: 'tempo', unsoldAction: 'clearance', notes: 'Tempo 7 hari' },
  { id: 'demo-s6', harvestId: 'demo-h3', daysAgo: 62, buyerCategory: 'supermarket', buyerName: 'FreshMarket Kemang', soldVolumeKg: 130, pricePerKg: 46000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s7', harvestId: 'demo-h3', daysAgo: 59, buyerCategory: 'restaurant', buyerName: 'Warung Hijau', soldVolumeKg: 35.2, pricePerKg: 52000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s8', harvestId: 'demo-h4', daysAgo: 48, buyerCategory: 'supermarket', buyerName: 'Grand Lucky', soldVolumeKg: 110, pricePerKg: 45000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s9', harvestId: 'demo-h4', daysAgo: 45, buyerCategory: 'retail', buyerName: 'Direct Customer (WhatsApp)', soldVolumeKg: 22.3, pricePerKg: 55000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s10', harvestId: 'demo-h5', daysAgo: 34, buyerCategory: 'wholesaler', buyerName: 'Pak Darto', soldVolumeKg: 80, pricePerKg: 28000, paymentStatus: 'dp', unsoldAction: 'spoilage', notes: 'Sebagian rusak, dibuang 8kg' },
  { id: 'demo-s11', harvestId: 'demo-h5', daysAgo: 31, buyerCategory: 'restaurant', buyerName: 'Cafe Daun', soldVolumeKg: 30, pricePerKg: 38000, paymentStatus: 'tempo', unsoldAction: null, notes: 'Tempo 14 hari' },
  { id: 'demo-s12', harvestId: 'demo-h6', daysAgo: 20, buyerCategory: 'supermarket', buyerName: 'Ranch Market BSD', soldVolumeKg: 140, pricePerKg: 47000, paymentStatus: 'paid', unsoldAction: null, notes: null },
  { id: 'demo-s13', harvestId: 'demo-h6', daysAgo: 17, buyerCategory: 'retail', buyerName: 'Direct Customer (WhatsApp)', soldVolumeKg: 18.6, pricePerKg: 58000, paymentStatus: 'paid', unsoldAction: null, notes: null },
]

await runMigrations()

const existing = db.select({ value: count() }).from(harvests).get()
if (existing && existing.value > 0 && !force) {
  console.log('ℹ Data sudah ada — seed dilewati. Gunakan `npm run db:reseed` untuk reset.')
  sqlite.close()
  process.exit(0)
}

db.transaction(() => {
  db.delete(sales).run()
  db.delete(harvests).run()
  db.delete(tandons).run()

  db.insert(tandons).values(buildTandonRows()).run()

  const harvestIdToTandon = new Map(HARVEST_SEEDS.map((h) => [h.id, h.tandonId]))

  db.insert(harvests).values(
    HARVEST_SEEDS.map((h) => ({
      id: h.id,
      tandonId: h.tandonId,
      date: subDaysISO(h.daysAgo),
      totalWeightKg: h.totalWeightKg,
      totalPlants: h.totalPlants,
      rejected: h.rejected,
      tipBurn: h.reasons.tipBurn,
      rootRot: h.reasons.rootRot,
      pests: h.reasons.pests,
      undersized: h.reasons.undersized,
      other: h.reasons.other,
      notes: h.notes,
      avgWeightG: calculateAvgWeightG(h.totalWeightKg, h.totalPlants),
      successRate: calculateSuccessRate(h.totalPlants, h.rejected),
      createdAt: `${subDaysISO(h.daysAgo)}T08:00:00.000Z`,
    })),
  ).run()

  db.insert(sales).values(
    SALE_SEEDS.map((s) => ({
      id: s.id,
      harvestId: s.harvestId,
      tandonId: harvestIdToTandon.get(s.harvestId) ?? 'T1',
      date: subDaysISO(s.daysAgo),
      buyerCategory: s.buyerCategory,
      buyerName: s.buyerName,
      soldVolumeKg: s.soldVolumeKg,
      pricePerKg: s.pricePerKg,
      totalValue: calculateTotalValue(s.soldVolumeKg, s.pricePerKg),
      paymentStatus: s.paymentStatus,
      unsoldAction: s.unsoldAction,
      notes: s.notes,
      createdAt: `${subDaysISO(s.daysAgo)}T10:00:00.000Z`,
    })),
  ).run()
})

console.log(
  `✓ Seed selesai: ${TANDON_IDS.length} tandon, ${HARVEST_SEEDS.length} panen, ${SALE_SEEDS.length} penjualan.`,
)
sqlite.close()
process.exit(0)
