import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { User, AppRole } from '@aida/shared'
import { ROLE_PERMISSIONS } from '../lib/sharedRuntime.js'

interface AidaJwtPayload {
  sub: string
  email: string
  role: AppRole
  iat: number
  exp: number
}

/**
 * Verify and decode JWT from aida_session cookie.
 * Attaches user to req.user with roles map derived from role.
 * FAIL-FAST: If JWT_SECRET is not available, return 401 immediately.
 * Otherwise, if token is missing or invalid, next() is called for read-only access patterns.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip JWT decoding for non-API paths (static assets, SPA navigations)
  if (!req.path.startsWith('/api')) {
    next()
    return
  }

  const token = req.cookies?.aida_session

  if (!token) {
    next()
    return
  }

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      // LOUD FAILURE: JWT_SECRET is required for token verification
      console.error('[Auth] JWT_SECRET not set — cannot verify tokens')
      res.status(401).json({ error: 'Unauthorized: server misconfiguration (JWT_SECRET missing)' })
      return
    }

    const payload = jwt.verify(token, secret) as AidaJwtPayload

    // Derive roles map from role
    const roleMap = ROLE_PERMISSIONS[payload.role] || ROLE_PERMISSIONS['Viewer']

    // Construct User object
    const user: User = {
      id: payload.sub,
      name: '', // Not stored in JWT — would need a DB lookup to populate
      email: payload.email,
      role: payload.role,
      roles: roleMap,
    }

    req.user = user
  } catch (err: unknown) {
    // Invalid or expired token — treat as unauthenticated
    console.debug('[Auth] Token verification failed:', err instanceof Error ? err.message : String(err))
  }

  next()
}

/**
 * Require authentication: return 401 if req.user is not set.
 * Use as middleware before protected routes.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

/**
 * Middleware to prevent re-invocation of setup routes once setupComplete is true.
 * Setup is considered complete when AIDA_ENCRYPTION_KEY is a valid 64-char hex string —
 * that key is only written by the setup wizard, so its presence is the canonical signal.
 * Returns 409 Conflict if setup is already complete.
 */
export function requireSetupIncomplete(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = process.env.AIDA_ENCRYPTION_KEY?.trim() ?? ''
  const setupComplete = /^[0-9a-fA-F]{64}$/.test(key)

  if (setupComplete) {
    res.status(409).json({
      error: 'Setup is already complete. Cannot re-run setup routes.',
      detail: 'If you need to change encryption keys or admin credentials, contact your system administrator.',
    })
    return
  }

  next()
}
