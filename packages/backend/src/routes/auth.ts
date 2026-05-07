import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import PocketBase from 'pocketbase'
import { ROLE_PERMISSIONS } from '@aida/shared'
import type { LoginRequest, LoginResponse } from '@aida/shared'

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
      expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
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

    // Generate aida_refresh token (7d)
    const refreshToken = jwt.sign(
      {
        sub: userId,
        email: userEmail,
        type: 'refresh',
      },
      jwtSecret,
      refreshOptions
    )

    // Set cookies
    const sessionMaxAge = 15 * 60 * 1000 // 15 minutes
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
