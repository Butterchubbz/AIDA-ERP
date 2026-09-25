import type { Request, Response, NextFunction } from 'express'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:8090',
]

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function parseUrlCandidate(value: string | undefined): URL | null {
  if (!value) {
    return null
  }

  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isAllowedOrigin(requestUrl: URL): boolean {
  return ALLOWED_ORIGINS.some((allowedOrigin) => {
    const allowedUrl = parseUrlCandidate(allowedOrigin)
    if (!allowedUrl) {
      return false
    }

    return (
      requestUrl.protocol === allowedUrl.protocol &&
      requestUrl.hostname === allowedUrl.hostname &&
      requestUrl.port === allowedUrl.port
    )
  })
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api')) {
    next()
    return
  }

  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    next()
    return
  }

  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
  const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer : undefined
  const candidate = originHeader ?? refererHeader

  if (!candidate) {
    console.warn('[CSRF] Blocked mutating request with missing Origin/Referer headers.')
    res.status(403).json({ error: 'CSRF Protection: Missing Origin Headers' })
    return
  }

  const requestUrl = parseUrlCandidate(candidate)
  if (!requestUrl) {
    console.warn(`[CSRF] Blocked mutating request with invalid Origin/Referer header: ${candidate}`)
    res.status(403).json({ error: 'CSRF Protection: Invalid Origin Headers' })
    return
  }

  if (!isAllowedOrigin(requestUrl)) {
    console.warn(
      `[CSRF] Blocked mutating request from origin ${candidate}. Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`
    )
    res.status(403).json({ error: 'CSRF Protection: Origin Not Allowed' })
    return
  }

  next()
}
