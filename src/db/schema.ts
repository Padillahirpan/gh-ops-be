// Skema Drizzle (SQLite). Tanggal disimpan sebagai teks ISO (YYYY-MM-DD /
// ISO datetime) agar identik dengan tipe domain FE — tanpa konversi zona waktu.
import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const tandons = sqliteTable('tandons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  greenhouse: text('greenhouse').notNull(),
  batchCode: text('batch_code').notNull(),
  holes: integer('holes').notNull().default(1000),
  sowingDate: text('sowing_date'),
  status: text('status', { enum: ['Empty', 'Growing', 'Sanitizing'] })
    .notNull()
    .default('Empty'),
  color: text('color').notNull(),
})

export const harvests = sqliteTable(
  'harvests',
  {
    id: text('id').primaryKey(),
    tandonId: text('tandon_id')
      .notNull()
      .references(() => tandons.id, { onDelete: 'restrict' }),
    date: text('date').notNull(),
    totalWeightKg: real('total_weight_kg').notNull(),
    totalPlants: integer('total_plants').notNull(),
    rejected: integer('rejected').notNull(),
    tipBurn: integer('tip_burn').notNull().default(0),
    rootRot: integer('root_rot').notNull().default(0),
    pests: integer('pests').notNull().default(0),
    undersized: integer('undersized').notNull().default(0),
    other: integer('other').notNull().default(0),
    notes: text('notes'),
    avgWeightG: real('avg_weight_g').notNull().default(0),
    successRate: real('success_rate').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index('idx_harvests_tandon').on(t.tandonId),
    index('idx_harvests_date').on(t.date),
  ],
)

export const sales = sqliteTable(
  'sales',
  {
    id: text('id').primaryKey(),
    harvestId: text('harvest_id')
      .notNull()
      .references(() => harvests.id, { onDelete: 'cascade' }),
    tandonId: text('tandon_id').notNull(),
    date: text('date').notNull(),
    buyerCategory: text('buyer_category', {
      enum: ['supermarket', 'restaurant', 'wholesaler', 'retail'],
    }).notNull(),
    buyerName: text('buyer_name').notNull(),
    soldVolumeKg: real('sold_volume_kg').notNull(),
    pricePerKg: integer('price_per_kg').notNull(),
    totalValue: integer('total_value').notNull(),
    paymentStatus: text('payment_status', { enum: ['paid', 'dp', 'tempo'] }).notNull(),
    unsoldAction: text('unsold_action', {
      enum: ['coldStorage', 'clearance', 'spoilage'],
    }),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index('idx_sales_harvest').on(t.harvestId),
    index('idx_sales_tandon').on(t.tandonId),
    index('idx_sales_date').on(t.date),
  ],
)

export type TandonRow = typeof tandons.$inferSelect
export type HarvestRow = typeof harvests.$inferSelect
export type SaleRow = typeof sales.$inferSelect
