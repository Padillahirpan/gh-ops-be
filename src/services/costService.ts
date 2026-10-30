// Service biaya — nominal final tersimpan di `amount` (hasil quantity × unitPrice
// bila keduanya diisi), penempatan batch manual divalidasi terhadap siklus.
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db/client.js'
import { costs, type CostRow } from '../db/schema.js'
import type { CostCategory, CostEntry, CostTarget, CostType, TandonId } from '../domain/types.js'
import { findCycleForDate } from '../lib/costCalculations.js'
import { BusinessRuleError, NotFoundError } from '../middleware/errors.js'
import { ensureCyclesFromTandons, getCycleRowOrThrow, listCycleBatches } from './cycleService.js'
import { ensureDefaultTandons } from './tandonService.js'
import type { CostCreateInput, CostQuery, CostUpdateInput } from '../validation/schemas.js'

/** Entry biaya + hasil pengelompokan batch (otomatis/manual) untuk keperluan tampilan. */
export type CostEntryView = CostEntry & { assignedCycleId: string | null }

export function toDomain(row: CostRow): CostEntry {
  return {
    id: row.id,
    date: row.date,
    type: row.type as CostType,
    category: row.category as CostCategory,
    description: row.description,
    amount: row.amount,
    target: row.target as CostTarget,
    supplier: row.supplier,
    notes: row.notes,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    spreadCycles: row.spreadCycles,
    cycleId: row.cycleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function withAssignment(cost: CostEntry): CostEntryView {
  if (cost.target === 'UMUM') return { ...cost, assignedCycleId: null }
  if (cost.cycleId) return { ...cost, assignedCycleId: cost.cycleId }
  const anchor = findCycleForDate(
    listCycleBatches(),
    cost.target as TandonId,
    cost.date,
  )
  return { ...cost, assignedCycleId: anchor?.id ?? null }
}

function getCostRowOrThrow(id: string): CostRow {
  const row = db.select().from(costs).where(eq(costs.id, id)).get()
  if (!row) throw new NotFoundError('Entri biaya')
  return row
}

/** amount = quantity × unitPrice (dibulatkan) bila keduanya tersedia. */
function resolveAmount(
  amount: number | undefined,
  quantity: number | null | undefined,
  unitPrice: number | null | undefined,
  fallback: number,
): number {
  if (quantity != null && unitPrice != null) {
    const derived = Math.round(quantity * unitPrice)
    if (amount !== undefined && Math.abs(amount - derived) > 1) {
      throw new BusinessRuleError('Nominal tidak cocok dengan jumlah × harga satuan')
    }
    return derived
  }
  if (quantity != null || unitPrice != null) {
    throw new BusinessRuleError('Jumlah dan harga satuan harus diisi bersamaan')
  }
  return amount ?? fallback
}

function validateManualCycle(cycleId: string | null | undefined, target: CostTarget): void {
  if (cycleId == null) return
  if (target === 'UMUM') {
    throw new BusinessRuleError(
      'Biaya Umum dibagi rata ke tandon dan tidak dapat dipatok manual ke satu siklus',
    )
  }
  const cycle = getCycleRowOrThrow(cycleId)
  if (cycle.tandonId !== target) {
    throw new BusinessRuleError('Batch panen manual harus milik tandon yang sama dengan target biaya')
  }
}

export function listCosts(query: CostQuery): CostEntryView[] {
  const conditions = []
  if (query.target !== undefined) conditions.push(eq(costs.target, query.target))
  if (query.type !== undefined) conditions.push(eq(costs.type, query.type))
  if (query.category !== undefined) conditions.push(eq(costs.category, query.category))
  if (query.from !== undefined) conditions.push(gte(costs.date, query.from))
  if (query.to !== undefined) conditions.push(lte(costs.date, query.to))

  const base = db.select().from(costs)
  const rows =
    conditions.length > 0
      ? base.where(and(...conditions)).orderBy(desc(costs.date), desc(costs.createdAt)).all()
      : base.orderBy(desc(costs.date), desc(costs.createdAt)).all()
  return rows.map((row) => withAssignment(toDomain(row)))
}

export function getCost(id: string): CostEntryView {
  return withAssignment(toDomain(getCostRowOrThrow(id)))
}

export function createCost(input: CostCreateInput): CostEntryView {
  ensureDefaultTandons()
  ensureCyclesFromTandons()

  const amount = resolveAmount(input.amount, input.quantity, input.unitPrice, 0)
  if (amount <= 0) throw new BusinessRuleError('Nominal harus lebih dari 0')
  if (input.type === 'operasional' && (input.spreadCycles ?? 1) > 1) {
    throw new BusinessRuleError('Penyebaran siklus hanya berlaku untuk biaya Modal & Aset')
  }
  validateManualCycle(input.cycleId, input.target)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.insert(costs)
    .values({
      id,
      date: input.date,
      type: input.type,
      category: input.category,
      description: input.description,
      amount,
      target: input.target,
      supplier: input.supplier ?? null,
      notes: input.notes ?? null,
      quantity: input.quantity ?? null,
      unitPrice: input.unitPrice ?? null,
      spreadCycles: input.type === 'modal' ? (input.spreadCycles ?? 1) : 1,
      cycleId: input.cycleId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return getCost(id)
}

export function updateCost(id: string, input: CostUpdateInput): CostEntryView {
  const row = getCostRowOrThrow(id)

  const type = (input.type ?? row.type) as CostType
  const target = (input.target ?? row.target) as CostTarget
  const quantity = input.quantity !== undefined ? input.quantity : row.quantity
  const unitPrice = input.unitPrice !== undefined ? input.unitPrice : row.unitPrice
  const amount = resolveAmount(
    input.amount,
    quantity,
    unitPrice,
    row.amount,
  )
  if (amount <= 0) throw new BusinessRuleError('Nominal harus lebih dari 0')

  const spreadCycles =
    type === 'modal' ? (input.spreadCycles ?? row.spreadCycles) : 1
  if (type === 'operasional' && (input.spreadCycles ?? 1) > 1) {
    throw new BusinessRuleError('Penyebaran siklus hanya berlaku untuk biaya Modal & Aset')
  }

  const cycleId = input.cycleId !== undefined ? input.cycleId : row.cycleId
  validateManualCycle(cycleId, target)

  db.update(costs)
    .set({
      date: input.date ?? row.date,
      type,
      category: (input.category ?? row.category) as CostCategory,
      description: input.description ?? row.description,
      amount,
      target,
      supplier: input.supplier !== undefined ? input.supplier : row.supplier,
      notes: input.notes !== undefined ? input.notes : row.notes,
      quantity,
      unitPrice,
      spreadCycles,
      cycleId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(costs.id, id))
    .run()

  return getCost(id)
}

export function deleteCost(id: string): void {
  getCostRowOrThrow(id)
  db.delete(costs).where(eq(costs.id, id)).run()
}
