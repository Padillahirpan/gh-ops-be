// Seed demo — padanan createDemoSeedData() di selada-ops/src/data/mockData.ts.
// Idempoten: dilewati jika data sudah ada, kecuali dijalankan dengan --force.
import { count } from 'drizzle-orm'
import { calculateAvgWeightG, calculateSuccessRate, calculateTotalValue } from '../lib/calculations.js'
import { addDaysToISO, subDaysISO } from '../lib/dateUtils.js'
import { TANDON_IDS, TANDON_CONFIG } from '../domain/constants.js'
import type {
  CostCategory,
  CostTarget,
  CostType,
  HarvestRejectionBreakdown,
  TandonId,
  TandonStatus,
} from '../domain/types.js'
import { db, sqlite } from './client.js'
import { costs, cycles, harvests, sales, tandons } from './schema.js'
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

// Batch panen (siklus): 2 siklus selesai per tandon + siklus berjalan.
// Tanggal semai siklus selesai = tanggal panen − 45 (HSS 45); siklus dibuat
// berurutan tanpa tumpang tindih jendela 47 hari.
interface CycleSeed {
  id: string
  tandonId: TandonId
  sowingDaysAgo: number
}

const CYCLE_SEEDS: CycleSeed[] = [
  { id: 'demo-cy-t1-a', tandonId: 'T1', sowingDaysAgo: 137 },
  { id: 'demo-cy-t1-b', tandonId: 'T1', sowingDaysAgo: 88 },
  { id: 'demo-cy-t1-c', tandonId: 'T1', sowingDaysAgo: 40 },
  { id: 'demo-cy-t2-a', tandonId: 'T2', sowingDaysAgo: 123 },
  { id: 'demo-cy-t2-b', tandonId: 'T2', sowingDaysAgo: 74 },
  { id: 'demo-cy-t2-c', tandonId: 'T2', sowingDaysAgo: 25 },
  { id: 'demo-cy-t3-a', tandonId: 'T3', sowingDaysAgo: 109 },
  { id: 'demo-cy-t3-b', tandonId: 'T3', sowingDaysAgo: 60 },
  { id: 'demo-cy-t3-c', tandonId: 'T3', sowingDaysAgo: 10 },
]

interface CostSeed {
  id: string
  daysAgo: number
  type: CostType
  category: CostCategory
  description: string
  target: CostTarget
  amount?: number
  quantity?: number
  unitPrice?: number
  supplier?: string
  notes?: string
  spreadCycles?: number
}

const COST_SEEDS: CostSeed[] = [
  // Operasional per siklus — benih & rockwool (harga satuan naik tiap siklus, F-CST-08)
  { id: 'demo-c01', daysAgo: 137, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus T1', target: 'T1', quantity: 1000, unitPrice: 750, supplier: 'HydroSeed Store' },
  { id: 'demo-c02', daysAgo: 123, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus T2', target: 'T2', quantity: 1000, unitPrice: 750, supplier: 'HydroSeed Store' },
  { id: 'demo-c03', daysAgo: 109, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus T3', target: 'T3', quantity: 1000, unitPrice: 750, supplier: 'HydroSeed Store' },
  { id: 'demo-c08', daysAgo: 88, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus T1 (batch 2)', target: 'T1', quantity: 1000, unitPrice: 780, supplier: 'HydroSeed Store' },
  { id: 'demo-c10', daysAgo: 74, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus T2 (batch 2)', target: 'T2', quantity: 1000, unitPrice: 780, supplier: 'HydroSeed Store' },
  { id: 'demo-c13', daysAgo: 60, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus T3 (batch 2)', target: 'T3', quantity: 1000, unitPrice: 800, supplier: 'HydroSeed Store' },
  { id: 'demo-c30', daysAgo: 6, type: 'operasional', category: 'benihRockwool', description: 'Benih & rockwool siklus berjalan T3', target: 'T3', quantity: 1000, unitPrice: 820, supplier: 'HydroSeed Store' },
  // Nutrisi (harga satuan naik dari waktu ke waktu)
  { id: 'demo-c07', daysAgo: 110, type: 'operasional', category: 'nutrisi', description: 'Nutrisi AB Mix', target: 'T1', quantity: 8, unitPrice: 85000, supplier: 'AgroNutrien' },
  { id: 'demo-c11', daysAgo: 74, type: 'operasional', category: 'nutrisi', description: 'Nutrisi AB Mix', target: 'T2', quantity: 8, unitPrice: 90000, supplier: 'AgroNutrien' },
  { id: 'demo-c19', daysAgo: 50, type: 'operasional', category: 'nutrisi', description: 'Nutrisi AB Mix', target: 'T1', quantity: 8, unitPrice: 95000, supplier: 'AgroNutrien' },
  { id: 'demo-c22', daysAgo: 45, type: 'operasional', category: 'nutrisi', description: 'Nutrisi tambahan (cuaca panas)', target: 'T2', amount: 600000 },
  { id: 'demo-c28', daysAgo: 3, type: 'operasional', category: 'nutrisi', description: 'Nutrisi awal siklus berjalan T1', target: 'T1', quantity: 8, unitPrice: 87500, supplier: 'AgroNutrien' },
  { id: 'demo-c31', daysAgo: 20, type: 'operasional', category: 'nutrisi', description: 'Nutrisi awal siklus berjalan T2', target: 'T2', quantity: 8, unitPrice: 92500, supplier: 'AgroNutrien' },
  // Pestisida
  { id: 'demo-c09', daysAgo: 85, type: 'operasional', category: 'pestisida', description: 'Pestisida hayati 2 botol', target: 'T1', quantity: 2, unitPrice: 120000, supplier: 'Tani Sehat' },
  { id: 'demo-c15', daysAgo: 60, type: 'operasional', category: 'pestisida', description: 'Pestisida hayati', target: 'T3', quantity: 2, unitPrice: 130000, supplier: 'Tani Sehat' },
  // Biaya Umum — dibagi rata ke 3 tandon (F-CST-04)
  { id: 'demo-c05', daysAgo: 105, type: 'operasional', category: 'listrikAir', description: 'Token listrik & air GH', target: 'UMUM', amount: 900000 },
  { id: 'demo-c06', daysAgo: 100, type: 'operasional', category: 'tenagaKerja', description: 'Upah buruh tanam & perawatan', target: 'UMUM', amount: 1500000 },
  { id: 'demo-c17', daysAgo: 55, type: 'operasional', category: 'listrikAir', description: 'Token listrik & air GH', target: 'UMUM', amount: 950000 },
  { id: 'demo-c18', daysAgo: 55, type: 'operasional', category: 'tenagaKerja', description: 'Upah buruh panen', target: 'UMUM', amount: 1200000 },
  { id: 'demo-c27', daysAgo: 5, type: 'operasional', category: 'listrikAir', description: 'Token listrik & air GH', target: 'UMUM', amount: 1000000 },
  // Kemasan & transportasi (saat panen)
  { id: 'demo-c14', daysAgo: 58, type: 'operasional', category: 'kemasanTransportasi', description: 'Box kemasan & ongkir panen', target: 'T3', amount: 350000 },
  { id: 'demo-c20', daysAgo: 48, type: 'operasional', category: 'kemasanTransportasi', description: 'Box kemasan & ongkir panen', target: 'T1', amount: 320000 },
  { id: 'demo-c24', daysAgo: 36, type: 'operasional', category: 'kemasanTransportasi', description: 'Box kemasan & ongkir panen', target: 'T2', amount: 300000 },
  { id: 'demo-c26', daysAgo: 22, type: 'operasional', category: 'kemasanTransportasi', description: 'Box kemasan & ongkir panen', target: 'T3', amount: 300000 },
  // Perbaikan & tak terduga
  { id: 'demo-c12', daysAgo: 70, type: 'operasional', category: 'perbaikan', description: 'Ganti seal pompa talang', target: 'T1', amount: 350000 },
  { id: 'demo-c16', daysAgo: 60, type: 'operasional', category: 'perbaikan', description: 'Perbaikan instalasi listrik GH-2', target: 'T2', amount: 1200000 },
  { id: 'demo-c23', daysAgo: 40, type: 'operasional', category: 'perbaikan', description: 'Ganti talang rusak zona A', target: 'T2', amount: 800000 },
  { id: 'demo-c25', daysAgo: 26, type: 'operasional', category: 'perbaikan', description: 'Servis kipas GH-2 (jatuh di luar siklus)', target: 'T2', amount: 150000, notes: 'Tanggal di antara dua siklus — contoh biaya tak terkelompok' },
  { id: 'demo-c29', daysAgo: 8, type: 'operasional', category: 'lainLain', description: 'Tak terduga: ganti seal pipa', target: 'T3', amount: 150000 },
  // Modal & Aset (F-CST-05)
  { id: 'demo-c04', daysAgo: 130, type: 'modal', category: 'peralatanMesin', description: 'Pompa nutrisi baru', target: 'T1', amount: 4500000, supplier: 'Toko Hidro Jaya', spreadCycles: 3, notes: 'Disebar ke 3 siklus T1' },
  { id: 'demo-c21', daysAgo: 47, type: 'modal', category: 'peralatanMesin', description: 'Timbangan digital', target: 'T3', amount: 1200000, supplier: 'Toko Hidro Jaya' },
]

await runMigrations()

const existing = db.select({ value: count() }).from(harvests).get()
if (existing && existing.value > 0 && !force) {
  console.log('ℹ Data sudah ada — seed dilewati. Gunakan `npm run db:reseed` untuk reset.')
  sqlite.close()
  process.exit(0)
}

db.transaction(() => {
  db.delete(costs).run()
  db.delete(cycles).run()
  db.delete(sales).run()
  db.delete(harvests).run()
  db.delete(tandons).run()

  db.insert(tandons).values(buildTandonRows()).run()

  db.insert(cycles).values(
    CYCLE_SEEDS.map((c) => {
      const sowingDate = subDaysISO(c.sowingDaysAgo)
      return {
        id: c.id,
        tandonId: c.tandonId,
        sowingDate,
        cycleEndDate: addDaysToISO(sowingDate, 47),
        batchCode: `${c.tandonId}-${sowingDate}`,
        createdAt: `${sowingDate}T07:00:00.000Z`,
      }
    }),
  ).run()

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

  db.insert(costs).values(
    COST_SEEDS.map((c) => {
      const date = subDaysISO(c.daysAgo)
      const amount =
        c.amount ?? Math.round((c.quantity ?? 0) * (c.unitPrice ?? 0))
      return {
        id: c.id,
        date,
        type: c.type,
        category: c.category,
        description: c.description,
        amount,
        target: c.target,
        supplier: c.supplier ?? null,
        notes: c.notes ?? null,
        quantity: c.quantity ?? null,
        unitPrice: c.unitPrice ?? null,
        spreadCycles: c.type === 'modal' ? (c.spreadCycles ?? 1) : 1,
        cycleId: null,
        createdAt: `${date}T09:00:00.000Z`,
        updatedAt: `${date}T09:00:00.000Z`,
      }
    }),
  ).run()
})

console.log(
  `✓ Seed selesai: ${TANDON_IDS.length} tandon, ${CYCLE_SEEDS.length} siklus, ` +
    `${HARVEST_SEEDS.length} panen, ${SALE_SEEDS.length} penjualan, ${COST_SEEDS.length} biaya.`,
)
sqlite.close()
process.exit(0)
