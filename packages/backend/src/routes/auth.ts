import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import PocketBase from 'pocketbase'
import type { LoginRequest, LoginResponse } from '@aida/shared'
import { ROLE_PERMISSIONS } from '../lib/sharedRuntime.js'

/**
 * POST /api/auth/login
 * Authenticate with email/password against PocketBase users collection.
 * On success: set aida_session (15m) and aida_refresh (7d) cookies, return User.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginRequest

  if (!email || !password) {
    res.status(400).json({ error: 'Missing email or password' })
    return
  }

  try {
    // Create throwaway PB instance for user auth (not the admin singleton)
    const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090'
    const pbAuth = new PocketBase(pbUrl)

    // Authenticate as the user
    const authData = await pbAuth.collection('users').authWithPassword(email, password)

    // Extract user details and role
    const userRecord = authData.record
    const userId = userRecord.id
    const userName = userRecord.name || email
    const userRole = userRecord.role || 'Viewer'
    const userEmail = userRecord.email

    // Verify role is valid
    if (!ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS]) {
      res.status(500).json({ error: 'Invalid user role in database' })
      return
    }

    // Generate aida_session JWT (15min)
    const jwtSecret = process.env.JWT_SECRET as string
    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT_SECRET not configured' })
      return
    }

    const sessionOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
    }
    const refreshOptions: SignOptions = {
      expiresIn: (process.env.REFRESH_EXPIRES_IN || '7d') as any,
    }

    const sessionToken = jwt.sign(
      {
        sub: userId,
        email: userEmail,
        role: userRole,
      },
      jwtSecret,
      sessionOptions
    )

    // Generate aida_refresh token (7d) — include role so refresh can re-issue session without a DB lookup
    const refreshToken = jwt.sign(
      {
        sub: userId,
        email: userEmail,
        role: userRole,
        type: 'refresh',
      },
      jwtSecret,
      refreshOptions
    )

    // Set cookies
    const sessionMaxAge = 8 * 60 * 60 * 1000 // 8 hours
    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    const isProduction = process.env.NODE_ENV === 'production'

    res.cookie('aida_session', sessionToken, {
      maxAge: sessionMaxAge,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    })

    res.cookie('aida_refresh', refreshToken, {
      maxAge: refreshMaxAge,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    })

    // Return user with role-derived permissions
    const userRoles = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS]

    const response: LoginResponse = {
      user: {
        id: userId,
        name: userName,
        email: userEmail,
        role: userRole as any,
        roles: userRoles,
      },
    }

    res.status(200).json(response)
  } catch (err: unknown) {
    console.error('[Auth] Login failed:', err)
    res.status(401).json({ error: 'Invalid email or password' })
  }
}

/**
 * POST /api/auth/logout
 * Clear session and refresh cookies.
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('aida_session')
  res.clearCookie('aida_refresh')
  res.status(204).send()
}

/**
 * GET /api/auth/session
 * Return current user or null.
 */
export async function session(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(200).json({ user: null })
    return
  }

  res.status(200).json({ user: req.user })
}

/**
 * POST /api/auth/refresh
 * Use the aida_refresh cookie to silently re-issue a new aida_session cookie.
 * Called automatically by the frontend when any request returns 401.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.aida_refresh as string | undefined

  if (!token) {
    res.status(401).json({ error: 'No refresh token' })
    return
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET not configured' })
    return
  }

  try {
    const payload = jwt.verify(token, secret) as {
      sub: string
      email: string
      role: string
      type: string
    }

    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' })
      return
    }

    const refreshSessionOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
    }

    const sessionToken = jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      secret,
      refreshSessionOptions
    )

    const isProduction = process.env.NODE_ENV === 'production'
    res.cookie('aida_session', sessionToken, {
      maxAge: 15 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    })

    res.status(200).json({ ok: true })
  } catch {
    res.status(401).json({ error: 'Session expired — please log in again' })
  }
}
