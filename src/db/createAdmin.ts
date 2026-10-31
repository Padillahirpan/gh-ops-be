// Bootstrap Admin pertama — jalankan `npm run admin:create`.
// Idempoten: jika user dengan email tersebut sudah ada, role dipastikan
// 'admin' dan password ditimpa sesuai env (berguna untuk reset).
// Env: ADMIN_EMAIL (default admin@selada.local), ADMIN_NAME, ADMIN_PASSWORD
// (default selada-admin-123 — WAJIB diganti).
import { eq } from 'drizzle-orm'
import { generateRandomString, hashPassword } from 'better-auth/crypto'
import { db, sqlite } from './client.js'
import { account, user } from './schema.js'
import { runMigrations } from './migrate.js'

const email = (process.env.ADMIN_EMAIL ?? 'admin@selada.local').toLowerCase()
const name = process.env.ADMIN_NAME ?? 'Admin'
const password = process.env.ADMIN_PASSWORD ?? 'selada-admin-123'

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠ ADMIN_PASSWORD tidak diset — password default dipakai. Ganti segera setelah login!')
}

await runMigrations()

// Hash di luar transaksi (async, jangan tahan lock SQLite).
const passwordHash = await hashPassword(password)

const existing = db.select().from(user).where(eq(user.email, email)).get()

db.transaction(() => {
  if (existing) {
    db.update(user).set({ role: 'admin', updatedAt: new Date() }).where(eq(user.id, existing.id)).run()
    const cred = db.select().from(account).where(eq(account.userId, existing.id)).get()
    if (cred) {
      db.update(account)
        .set({ password: passwordHash, accountId: existing.id })
        .where(eq(account.id, cred.id))
        .run()
    } else {
      db.insert(account)
        .values({
          id: generateRandomString(16),
          // accountId credential HARUS = user id (konvensi Better Auth), bukan email.
          accountId: existing.id,
          providerId: 'credential',
          userId: existing.id,
          password: passwordHash,
          createdAt: new Date(),
        })
        .run()
    }
    console.log(`✓ User ${email} sudah ada — role dipastikan 'admin', password diperbarui.`)
    return
  }

  const userId = generateRandomString(16)
  db.insert(user)
    .values({
      id: userId,
      name,
      email,
      emailVerified: true,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run()
  db.insert(account)
    .values({
      id: generateRandomString(16),
      // accountId credential HARUS = user id (konvensi Better Auth), bukan email.
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
      createdAt: new Date(),
    })
    .run()
  console.log(`✓ Admin dibuat: ${email} (role: admin)`)
})

sqlite.close()
process.exit(0)
