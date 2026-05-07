import type { Request, Response, NextFunction } from 'express'

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'

/**
 * CSRF protection: verify that the request origin matches ALLOWED_ORIGIN exactly.
 * Fail-closed: if origin header is missing, reject with 403.
 * Uses URL string equality to prevent subdomain confusion.
 */
export function csrfOriginGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only check non-GET, non-HEAD, non-OPTIONS requests (i.e., state-changing operations)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next()
    return
  }

  const origin = req.get('origin')
  if (!origin) {
    res.status(403).json({ error: 'CSRF: missing origin header' })
    return
  }

  try {
    const originUrl = new URL(origin)
    const allowedUrl = new URL(ALLOWED_ORIGIN)

    // Exact equality check
    if (originUrl.origin !== allowedUrl.origin) {
      res
        .status(403)
        .json({
          error: `CSRF: origin ${origin} not allowed`,
          allowed: ALLOWED_ORIGIN,
        })
      return
    }
  } catch {
    res.status(403).json({ error: 'CSRF: invalid origin header' })
    return
  }

  next()
}
