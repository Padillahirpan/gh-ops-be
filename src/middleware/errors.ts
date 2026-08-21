// Error terpusat: AppError → response JSON { error: { code, message, details? } }.
import type { Context } from 'hono'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(404, 'NOT_FOUND', `${what} tidak ditemukan`)
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'BUSINESS_RULE', message, details)
  }
}

export class ValidationAppError extends AppError {
  constructor(issues: Array<{ path: string; message: string }>) {
    super(422, 'VALIDATION_ERROR', 'Data tidak valid', issues)
  }
}

export function toValidationIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }))
}

// defaultHook untuk @hono/zod-openapi: kegagalan validasi request tetap menjadi
// ValidationAppError (422) agar format error konsisten dengan parseOrThrow.
export function openApiValidationHook(result: { success: boolean; error?: unknown }, _c: Context): void {
  if (result.success) return
  const error = result.error
  throw new ValidationAppError(
    error instanceof ZodError
      ? toValidationIssues(error)
      : [{ path: '(request)', message: 'Data tidak valid' }],
  )
}

export function errorHandler(err: unknown, c: Context): Response {
  // Body JSON rusak (HTTPException dari zValidator) → tetap dijawab sebagai error validasi.
  if (err instanceof Error && err.message === 'Malformed JSON in request body') {
    const ve = new ValidationAppError([{ path: '(body)', message: 'Body harus JSON valid' }])
    return c.json({ error: { code: ve.code, message: ve.message, details: ve.details } }, ve.status as 422)
  }

  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: { code: err.code, message: err.message },
    }
    if (err.details !== undefined) {
      ;(body.error as Record<string, unknown>).details = err.details
    }
    return c.json(body, err.status as 400)
  }

  console.error('[unhandled]', err)
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan tak terduga di server' } },
    500,
  )
}

export function notFoundHandler(c: Context): Response {
  return c.json(
    { error: { code: 'NOT_FOUND', message: `Rute ${c.req.method} ${c.req.path} tidak ditemukan` } },
    404,
  )
}
