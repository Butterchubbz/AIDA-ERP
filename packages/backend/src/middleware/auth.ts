import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ROLE_PERMISSIONS, type User, type AppRole } from '@aida/shared'
import { getSetupOwnerLockStatus } from '../lib/setupOwnerLock.js'

interface AidaJwtPayload {
  sub: string
  email: string
  role: AppRole
  iat: number
  exp: number
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('aida_session')
  res.clearCookie('aida_refresh')
}

function buildUserFromPayload(payload: AidaJwtPayload): User {
  const roleMap = ROLE_PERMISSIONS[payload.role] || ROLE_PERMISSIONS['Viewer']

  return {
    id: payload.sub,
    name: '',
    email: payload.email,
    role: payload.role,
    roles: roleMap,
  }
}

async function attemptSilentRefresh(req: Request, res: Response): Promise<boolean> {
  const refreshToken = req.cookies?.aida_refresh
  if (!refreshToken) {
    return false
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    clearAuthCookies(res)
    res.status(401).json({ error: 'Unauthorized: server misconfiguration (JWT_SECRET missing)' })
    return true
  }

  try {
    const payload = jwt.verify(refreshToken, secret) as {
      sub: string
      email: string
      role: AppRole
      type?: string
    }

    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token type')
    }

    const sessionExpiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn']
    const sessionToken = jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      secret,
      { expiresIn: sessionExpiresIn }
    )

    const isProduction = process.env.NODE_ENV === 'production'
    res.cookie('aida_session', sessionToken, {
      maxAge: 8 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    })

    req.user = buildUserFromPayload({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    })

    return true
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.debug('[Auth] Refresh token verification failed:', message)
    clearAuthCookies(res)
    res.status(401).json({ error: 'Unauthorized' })
    return true
  }
}

/**
 * Verify and decode JWT from aida_session cookie.
 * Attaches user to req.user with roles map derived from role.
 * If the session is expired and a refresh token is valid, reissue the session silently.
 * Invalid or expired refresh tokens clear cookies and return 401 without crashing the server.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip JWT decoding for non-API paths (static assets, SPA navigations)
  if (!req.path.startsWith('/api')) {
    next()
    return
  }

  const token = req.cookies?.aida_session

  if (!token) {
    try {
      if (req.cookies?.aida_refresh) {
        const refreshed = await attemptSilentRefresh(req, res)
        if (refreshed) {
          return
        }
      }
    } catch (err: unknown) {
      console.error('[Auth] Silent refresh failed unexpectedly:', err)
      clearAuthCookies(res)
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    next()
    return
  }

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      clearAuthCookies(res)
      console.error('[Auth] JWT_SECRET not set — cannot verify tokens')
      res.status(401).json({ error: 'Unauthorized: server misconfiguration (JWT_SECRET missing)' })
      return
    }

    const payload = jwt.verify(token, secret) as AidaJwtPayload
    req.user = buildUserFromPayload(payload)

    const lockStatus = await getSetupOwnerLockStatus(req.user.email)
    if (lockStatus.locked) {
      clearAuthCookies(res)
      res.status(423).json({
        error:
          'AIDA is disabled because the setup owner has not logged in for over 90 days. The setup owner must log in to re-enable access.',
      })
      return
    }

    next()
    return
  } catch (err: unknown) {
    const isExpired =
      err instanceof jwt.TokenExpiredError ||
      (err instanceof Error && /jwt expired|token expired/i.test(err.message))

    console.debug('[Auth] Token verification failed:', err instanceof Error ? err.message : String(err))

    if (isExpired) {
      try {
        const refreshed = await attemptSilentRefresh(req, res)
        if (refreshed) {
          return
        }
      } catch (refreshError: unknown) {
        console.error('[Auth] Refresh after expired session failed:', refreshError)
        clearAuthCookies(res)
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
    }

    if (req.cookies?.aida_refresh) {
      try {
        const refreshed = await attemptSilentRefresh(req, res)
        if (refreshed) {
          return
        }
      } catch (refreshError: unknown) {
        console.error('[Auth] Refresh retry failed:', refreshError)
      }
    }

    clearAuthCookies(res)
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
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
