import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ROLE_PERMISSIONS } from '@aida/shared'
import type { User, AppRole } from '@aida/shared'

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
 * Does NOT reject on invalid/missing token — next() is called regardless.
 * It is the responsibility of route handlers to check req.user and return 401 if required.
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.aida_session

  if (!token) {
    next()
    return
  }

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('[Auth] JWT_SECRET not set')
      next()
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
