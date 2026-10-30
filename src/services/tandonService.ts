// Service tandon — termasuk side effect status yang dipadankan dari useTandonStore.
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { tandons, type TandonRow } from '../db/schema.js'
import { TANDON_CONFIG, TANDON_IDS, createDefaultTandon } from '../domain/constants.js'
import type { Tandon, TandonCycleInfo, TandonId, TandonStatus } from '../domain/types.js'
import {
  generateCycleEvents,
  getCyclePhase,
  getCycleProgressPercent,
  getDaysUntilNextEvent,
  getHssFromSowingDate,
  isChemicalSprayAllowed,
} from '../lib/cycleCalculator.js'
import { NotFoundError } from '../middleware/errors.js'
import { ensureCycle } from './cycleService.js'
import type { TandonUpdateInput } from '../validation/schemas.js'

function toDomain(row: TandonRow): Tandon {
  return {
    id: row.id as TandonId,
    name: row.name,
    greenhouse: row.greenhouse,
    batchCode: row.batchCode,
    holes: row.holes,
    sowingDate: row.sowingDate,
    status: row.status,
    color: row.color,
  }
}

export function ensureDefaultTandons(): void {
  const existing = db.select({ id: tandons.id }).from(tandons).all()
  if (existing.length === 0) {
    db.insert(tandons)
      .values(TANDON_IDS.map((id) => createDefaultTandon(id)))
      .run()
  }
}

export function listTandons(): Tandon[] {
  ensureDefaultTandons()
  return db.select().from(tandons).all().map(toDomain)
}

export function getTandonRowOrThrow(id: TandonId): TandonRow {
  const row = db.select().from(tandons).where(eq(tandons.id, id)).get()
  if (!row) throw new NotFoundError(`Tandon ${id}`)
  return row
}

export function getTandon(id: TandonId): Tandon {
  return toDomain(getTandonRowOrThrow(id))
}

export function updateTandon(id: TandonId, input: TandonUpdateInput): Tandon {
  const current = getTandonRowOrThrow(id)

  let sowingDate = current.sowingDate
  let status: TandonStatus = current.status

  // Padanan setSowingDate FE: null → Empty, terisi → Growing,
  // kecuali sedang Sanitizing dan tanggal tetap diisi (pertahankan Sanitizing).
  if (input.sowingDate !== undefined) {
    sowingDate = input.sowingDate
    const derived: TandonStatus = input.sowingDate === null ? 'Empty' : 'Growing'
    status =
      current.status === 'Sanitizing' && input.sowingDate !== null ? current.status : derived
  }
  if (input.status !== undefined) {
    status = input.status
  }

  db.update(tandons).set({ sowingDate, status }).where(eq(tandons.id, id)).run()

  // Side effect Modul Biaya: tanggal semai terisi → record batch panen (siklus)
  // dibuat otomatis agar biaya HSS 0–47 terkelompok ke batch yang benar (F-CST-03).
  if (sowingDate !== null) ensureCycle(id, sowingDate)

  return getTandon(id)
}

export function resetTandon(id: TandonId): Tandon {
  getTandonRowOrThrow(id)
  const initial = TANDON_CONFIG[id].initialStatus
  db.update(tandons).set({ sowingDate: null, status: initial }).where(eq(tandons.id, id)).run()
  return getTandon(id)
}

export function getTandonCycle(id: TandonId): TandonCycleInfo {
  const row = getTandonRowOrThrow(id)
  const hss = getHssFromSowingDate(row.sowingDate)
  return {
    tandonId: id,
    hss,
    phase: getCyclePhase(hss),
    progressPercent: getCycleProgressPercent(hss),
    sprayAllowed: isChemicalSprayAllowed(hss),
    events: generateCycleEvents(row.sowingDate),
    nextEvent: getDaysUntilNextEvent(row.sowingDate),
  }
}
