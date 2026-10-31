import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

// Loader .env sederhana (tanpa dependency): nilai yang sudah ada di environment
// tidak ditimpa, dan file yang tidak ada diabaikan.
for (const envFile of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), envFile)
  if (!existsSync(envPath)) continue
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim())
    if (!match) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

export const DB_PATH = process.env.DB_PATH ?? 'data/selada-ops.db'

const dir = path.dirname(DB_PATH)
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

export const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
