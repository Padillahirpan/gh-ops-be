import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from './client.js'

// src/db/migrate.ts dan dist/db/migrate.js berada pada kedalaman sama,
// jadi ../../drizzle selalu menunjuk folder migrasi di root proyek.
export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
)

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  await runMigrations()
  console.log(`✓ Migrasi diterapkan dari ${MIGRATIONS_FOLDER}`)
  process.exit(0)
}
