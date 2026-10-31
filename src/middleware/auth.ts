// Guard autentikasi & otorisasi untuk endpoint bisnis.
// - requireAuth : semua request harus punya session valid (cookie).
// - requireAdmin: request metode TULIS (POST/PATCH/PUT/DELETE) hanya untuk
//   role 'admin' — role 'user' bersifat read-only. Dipasang SETELAH requireAuth.
import type { MiddlewareHandler } from 'hono'
import { auth, type AuthSession } from '../lib/auth.js'
import { AppError } from './errors.js'

export type AuthEnv = { Variables: { auth: AuthSession } }

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', 'Silakan login terlebih dahulu')
  }
  c.set('auth', session)
  await next()
}

export const requireAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  if (WRITE_METHODS.has(c.req.method) && c.get('auth').user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Hanya Admin yang dapat mengubah data')
  }
  await next()
}
