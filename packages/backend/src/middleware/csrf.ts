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

export function csrfOriginGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.path.startsWith('/api')) {
    next()
    return
  }

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next()
    return
  }

  const origin = req.get('origin')

  // No Origin header — same-origin navigation (e.g. direct form POST), safe to pass.
  if (!origin) {
    next()
    return
  }

  // Same-origin detection: request origin matches the server's own host.
  try {
    const originHost = new URL(origin).host
    if (originHost === req.headers.host) {
      next()
      return
    }
  } catch {
    res.status(403).json({ error: 'CSRF: invalid origin header' })
    return
  }

  try {
    const originUrl = new URL(origin)
    const allowed = ALLOWED_ORIGINS.some((allowedOrigin) => {
      const allowedUrl = new URL(allowedOrigin)
      return originUrl.origin === allowedUrl.origin
    })

    if (!allowed) {
      res
        .status(403)
        .json({
          error: `CSRF: origin ${origin} not allowed`,
          allowed: ALLOWED_ORIGINS,
        })
      return
    }
  } catch {
    res.status(403).json({ error: 'CSRF: invalid origin header' })
    return
  }

  next()
}
