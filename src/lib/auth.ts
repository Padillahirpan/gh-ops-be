// Instance Better Auth — session cookie HttpOnly + plugin admin (role admin/user).
// Endpoint auth dilayani di /api/auth/* (lihat src/index.ts), data di SQLite
// via drizzleAdapter. Pendaftaran mandiri (sign-up) dinonaktifkan: user dibuat
// Admin lewat endpoint admin plugin (Settings → Manajemen User) atau script
// `npm run admin:create` untuk Admin pertama.
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { db } from '../db/client.js'
import { account, rateLimit, session, user, verification } from '../db/schema.js'

const DEV_FALLBACK_SECRET = 'selada-ops-dev-secret-jangan-dipakai-produksi'

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn(
    '[auth] BETTER_AUTH_SECRET tidak diset — memakai secret dev. ' +
      'Set di file .env untuk produksi (contoh: `openssl rand -base64 32`).',
  )
}

const port = process.env.PORT ?? '3001'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification, rateLimit },
  }),
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
  secret: process.env.BETTER_AUTH_SECRET ?? DEV_FALLBACK_SECRET,
  // Origin FE yang boleh memanggil endpoint auth (CSRF check) — selaras CORS.
  trustedOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Tanpa pendaftaran publik — akun dibuat oleh Admin.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24, // perpanjang rolling tiap 1 hari
    cookieCache: {
      enabled: true, // kurangi query session per request (cache signed 5 menit)
      maxAge: 5 * 60,
    },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 20, // login + request auth dibatasi 20x/menit/IP
  },
  plugins: [admin()],
})

export type AuthSession = typeof auth.$Infer.Session
