// Skema Drizzle (SQLite). Tanggal disimpan sebagai teks ISO (YYYY-MM-DD /
// ISO datetime) agar identik dengan tipe domain FE — tanpa konversi zona waktu.
import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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

// Batch panen (siklus tanam) — dibuat otomatis saat tanggal semai tandon diisi;
// jendela biaya = [sowing_date, cycle_end_date] (HSS 0 s.d. sanitasi selesai HSS 47).
export const cycles = sqliteTable(
  'cycles',
  {
    id: text('id').primaryKey(),
    tandonId: text('tandon_id')
      .notNull()
      .references(() => tandons.id, { onDelete: 'restrict' }),
    sowingDate: text('sowing_date').notNull(),
    cycleEndDate: text('cycle_end_date').notNull(),
    batchCode: text('batch_code').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index('idx_cycles_tandon').on(t.tandonId),
    uniqueIndex('uq_cycles_tandon_sowing').on(t.tandonId, t.sowingDate),
  ],
)

export const COST_TYPES = ['operasional', 'modal'] as const
export const COST_CATEGORIES_DB = [
  'benihRockwool',
  'nutrisi',
  'pestisida',
  'listrikAir',
  'tenagaKerja',
  'kemasanTransportasi',
  'peralatanMesin',
  'perbaikan',
  'lainLain',
] as const
export const COST_TARGETS = ['T1', 'T2', 'T3', 'UMUM'] as const

export const costs = sqliteTable(
  'costs',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    type: text('type', { enum: COST_TYPES }).notNull(),
    category: text('category', { enum: COST_CATEGORIES_DB }).notNull(),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    target: text('target', { enum: COST_TARGETS }).notNull(),
    supplier: text('supplier'),
    notes: text('notes'),
    quantity: real('quantity'),
    unitPrice: integer('unit_price'),
    spreadCycles: integer('spread_cycles').notNull().default(1),
    // Null = dikelompokkan otomatis ke siklus berdasarkan tandon + tanggal;
    // terisi = penempatan manual ke batch panen tertentu (F-CST-03).
    cycleId: text('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index('idx_costs_date').on(t.date),
    index('idx_costs_target').on(t.target),
    index('idx_costs_category').on(t.category),
    index('idx_costs_cycle').on(t.cycleId),
  ],
)

export type TandonRow = typeof tandons.$inferSelect
export type HarvestRow = typeof harvests.$inferSelect
export type SaleRow = typeof sales.$inferSelect
export type CycleRow = typeof cycles.$inferSelect
export type CostRow = typeof costs.$inferSelect

// ---------------------------------------------------------------------------
// Tabel Better Auth (user/session/account/verification) — struktur field
// mengikuti skema bawaan Better Auth untuk SQLite + plugin admin
// (role/banned/banReason/banExpires di user, impersonatedBy di session).
// Kolom tanggal memakai integer epoch (ms) agar konversi Date otomatis oleh
// drizzleAdapter; JANGAN diubah ke teks ISO seperti tabel bisnis.
// ---------------------------------------------------------------------------
export const USER_ROLES = ['admin', 'user'] as const

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  role: text('role', { enum: USER_ROLES }).notNull().default('user'),
  banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp' }),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (t) => [index('idx_session_user').on(t.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index('idx_account_user').on(t.userId)],
)

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})

export type UserRow = typeof user.$inferSelect
export type SessionRow = typeof session.$inferSelect

// Penyimpanan rate limit (storage: 'database'). lastRequest = epoch ms polos
// (tanpa mode timestamp) karena Better Auth menulis angka langsung.
export const rateLimit = sqliteTable('rateLimit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
})
