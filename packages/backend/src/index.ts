import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { authenticatePocketBase } from './lib/pocketbase.js'
import { authMiddleware, requireAuth } from './middleware/auth.js'
import { csrfOriginGuard } from './middleware/csrf.js'
import { login, logout, session } from './routes/auth.js'
import { getPreferences, updatePreferences } from './routes/preferences.js'

const app = express()
const PORT = process.env.PORT || 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'

/**
 * Middleware stack
 */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  })
)

// Global CSRF guard (fail-closed on state-changing operations)
app.use(csrfOriginGuard)

// Auth middleware (attaches user to req.user if valid JWT)
app.use(authMiddleware)

/**
 * Health check (no auth required)
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

/**
 * Auth routes
 */
app.post('/api/auth/login', login)
app.post('/api/auth/logout', logout)
app.get('/api/auth/session', session)

/**
 * User preferences routes (requires auth)
 */
app.get('/api/users/preferences', requireAuth, getPreferences)
app.patch('/api/users/preferences', requireAuth, updatePreferences)

/**
 * Error handler
 */
app.use((_err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', _err)
  res.status(500).json({ error: 'Internal server error' })
})

/**
 * Start server after PocketBase auth
 */
async function startServer() {
  try {
    // Authenticate with PocketBase before starting server
    await authenticatePocketBase()
    console.log('[PocketBase] Authenticated successfully')

    app.listen(PORT, () => {
      console.log(`[Express] Server running on http://localhost:${PORT}`)
      console.log(`[CORS] Allowed origin: ${ALLOWED_ORIGIN}`)
    })
  } catch (err) {
    console.error('[Startup] Failed to start server:', err)
    process.exit(1)
  }
}

startServer()

export default app
