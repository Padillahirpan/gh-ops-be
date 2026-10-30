// Service batch panen (siklus). Record siklus dibuat otomatis saat tanggal
// semai tandon diisi; panen lama tanpa record disintesis jadi batch implisit.
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { cycles, harvests, tandons, type CycleRow } from '../db/schema.js'
import { CYCLE_TOTAL_DAYS } from '../domain/constants.js'
import type { CycleBatchInfo, TandonId } from '../domain/types.js'
import { addDaysToISO, todayISO } from '../lib/dateUtils.js'
import { NotFoundError } from '../middleware/errors.js'
import type { CycleQuery } from '../validation/schemas.js'

export function toDomain(row: CycleRow): CycleBatchInfo {
  return {
    id: row.id,
    tandonId: row.tandonId as TandonId,
    sowingDate: row.sowingDate,
    cycleEndDate: row.cycleEndDate,
    batchCode: row.batchCode,
    status: todayISO() <= row.cycleEndDate ? 'Berjalan' : 'Selesai',
    implicit: false,
    createdAt: row.createdAt,
  }
}

/** Idempoten: buat record siklus untuk (tandon, tanggal semai) bila belum ada. */
export function ensureCycle(tandonId: TandonId, sowingDate: string): CycleBatchInfo {
  const existing = db
    .select()
    .from(cycles)
    .where(and(eq(cycles.tandonId, tandonId), eq(cycles.sowingDate, sowingDate)))
    .get()
  if (existing) return toDomain(existing)

  const row = {
    id: crypto.randomUUID(),
    tandonId,
    sowingDate,
    cycleEndDate: addDaysToISO(sowingDate, CYCLE_TOTAL_DAYS),
    batchCode: `${tandonId}-${sowingDate}`,
    createdAt: new Date().toISOString(),
  }
  db.insert(cycles).values(row).run()
  return toDomain(row)
}

/** Pastikan setiap tandon yang sedang menanam punya record siklus. */
export function ensureCyclesFromTandons(): void {
  const rows = db.select().from(tandons).all()
  for (const row of rows) {
    if (row.sowingDate) ensureCycle(row.id as TandonId, row.sowingDate)
  }
}

/**
 * Semua batch panen: record siklus + batch implisit untuk panen lama yang
 * jendela siklusnya tidak tercakup record mana pun (panen diasumsikan HSS 45).
 */
export function listCycleBatches(query?: CycleQuery): CycleBatchInfo[] {
  ensureCyclesFromTandons()

  const persisted = db.select().from(cycles).all().map(toDomain)

  const implicit: CycleBatchInfo[] = []
  const harvestRows = db.select().from(harvests).all()
  for (const h of harvestRows) {
    const tandonId = h.tandonId as TandonId
    const matched = persisted.some(
      (b) => b.tandonId === tandonId && h.date >= b.sowingDate && h.date <= b.cycleEndDate,
    )
    if (matched) continue
    const sowingDate = addDaysToISO(h.date, -45)
    implicit.push({
      id: `auto-${h.id}`,
      tandonId,
      sowingDate,
      cycleEndDate: addDaysToISO(sowingDate, CYCLE_TOTAL_DAYS),
      batchCode: `${tandonId}-${sowingDate} (otomatis)`,
      status: 'Selesai',
      implicit: true,
      createdAt: null,
    })
  }

  const all = [...persisted, ...implicit]
  if (query?.tandonId !== undefined) {
    return all
      .filter((b) => b.tandonId === query.tandonId)
      .sort((a, b) => b.sowingDate.localeCompare(a.sowingDate))
  }
  return all.sort(
    (a, b) => b.sowingDate.localeCompare(a.sowingDate) || a.tandonId.localeCompare(b.tandonId),
  )
}

export function getCycleBatch(id: string): CycleBatchInfo {
  const batch = listCycleBatches().find((b) => b.id === id)
  if (!batch) throw new NotFoundError('Batch panen (siklus)')
  return batch
}

/** Record siklus tersimpan berdasarkan id — untuk validasi penempatan manual biaya. */
export function getCycleRowOrThrow(id: string): CycleRow {
  const row = db.select().from(cycles).where(eq(cycles.id, id)).get()
  if (!row) throw new NotFoundError('Batch panen (siklus)')
  return row
}
