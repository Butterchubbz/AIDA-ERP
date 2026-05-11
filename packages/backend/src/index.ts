import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { authenticatePocketBase } from './lib/pocketbase.js'
import { authMiddleware, requireAuth, requireSetupIncomplete } from './middleware/auth.js'
import { csrfOriginGuard } from './middleware/csrf.js'
import { login, logout, session, refresh } from './routes/auth.js'
import { getPreferences, updatePreferences } from './routes/preferences.js'
import {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  getDeviceHistory,
  searchInventory,
  batchUpdateDevices,
  listAccessories,
  createAccessory,
  updateAccessory,
  deleteAccessory,
  batchUpdateAccessories,
  getAccessoryHistory,
  moveSkuToSection,
} from './routes/inventory.js'
import {
  getVendorConfigs,
  saveVendorConfigs,
  getForecast,
} from './routes/forecasting.js'
import {
  listInboundShipments,
  createInboundShipment,
  updateInboundShipment,
  deleteInboundShipment,
  pushInboundShipment,
  listOutboundShipments,
  createOutboundShipment,
  updateOutboundShipment,
  deleteOutboundShipment,
  forecastShipments,
} from './routes/shipments.js'
import {
  listAmazonPOs,
  createAmazonPO,
  updateAmazonPO,
  deleteAmazonPO,
  listAmazonInventory,
  syncAmazonInventory,
} from './routes/amazon.js'
import {
  listRMATickets,
  createRMATicket,
  updateRMATicket,
  deleteRMATicket,
} from './routes/rma.js'
import {
  listOrders,
  createOrder,
  updateOrder,
  deleteOrder,
} from './routes/orders.js'
import {
  listRefurbished,
  createRefurbished,
  updateRefurbished,
  deleteRefurbished,
  listSalesData,
  upsertSalesData,
  listPresets,
  createPreset,
  deletePreset,
  importSalesDataCSV,
} from './routes/data.js'
import {
  listRegistry,
  listUserIntegrations,
  connectIntegration,
  disconnectIntegration,
  triggerSync,
  getIntegrationSchedule,
  updateIntegrationSchedule,
  listUnknownSkus,
  dismissUnknownSku,
} from './routes/integrations.js'
import {
  startIntegrationScheduler,
  stopIntegrationScheduler,
} from './lib/syncScheduler.js'
import { listUsers, updateUser } from './routes/users.js'
import {
  checkSetupHealth,
  saveEncryptionKey,
  initCollections,
  setWorkspaceMode,
  bootstrapMissingCollections,
} from './routes/setup.js'

const app = express()
const PORT = process.env.PORT || 3001
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:8090']
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.resolve(__dirname, '../public')
const indexHtmlPath = path.join(publicDir, 'index.html')

/**
 * Middleware stack
 */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
)

/**
 * Static asset middleware — runs before security guards.
 * Serves JS/CSS/images from the built frontend with correct MIME types.
 * fallthrough: true passes unresolved paths down to the SPA fallback.
 */
app.use(
  express.static(publicDir, {
    fallthrough: true,
  })
)

// Security headers — applied to every response
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }
  next()
})

// Global CSRF guard (fail-closed on state-changing operations, /api only)
app.use(csrfOriginGuard)

// Auth middleware (attaches user to req.user if valid JWT, /api only)
app.use(authMiddleware)

/**
 * Health check (no auth required)
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

/**
 * Setup routes (no auth required)
 */
app.get('/api/setup/check-health', checkSetupHealth)
app.post('/api/setup/save-encryption-key', requireSetupIncomplete, saveEncryptionKey)
app.post('/api/setup/init-collections', requireSetupIncomplete, initCollections)
app.post('/api/setup/set-workspace-mode', requireSetupIncomplete, setWorkspaceMode)

/**
 * Auth routes
 */
app.post('/api/auth/login', login)
app.post('/api/auth/logout', logout)
app.get('/api/auth/session', session)
app.post('/api/auth/refresh', refresh)

/**
 * User management routes (requires auth) — must come before /api/users/:id to avoid param clash
 */
app.get('/api/users/preferences', requireAuth, getPreferences)
app.patch('/api/users/preferences', requireAuth, updatePreferences)
app.get('/api/users', requireAuth, listUsers)
app.patch('/api/users/:id', requireAuth, updateUser)

/**
 * Inventory routes (requires auth)
 */
app.get('/api/inventory/devices', requireAuth, listDevices)
app.post('/api/inventory/devices', requireAuth, createDevice)
app.patch('/api/inventory/devices/:id', requireAuth, updateDevice)
app.delete('/api/inventory/devices/:id', requireAuth, deleteDevice)
app.patch('/api/inventory/devices/batch', requireAuth, batchUpdateDevices)
app.get('/api/inventory/devices/:itemId/history', requireAuth, getDeviceHistory)
app.get('/api/inventory/components', requireAuth, listComponents)
app.post('/api/inventory/components', requireAuth, createComponent)
app.patch('/api/inventory/components/:id', requireAuth, updateComponent)
app.delete('/api/inventory/components/:id', requireAuth, deleteComponent)
app.get('/api/inventory/accessories', requireAuth, listAccessories)
app.post('/api/inventory/accessories', requireAuth, createAccessory)
app.patch('/api/inventory/accessories/:id', requireAuth, updateAccessory)
app.delete('/api/inventory/accessories/:id', requireAuth, deleteAccessory)
app.patch('/api/inventory/accessories/batch', requireAuth, batchUpdateAccessories)
app.get('/api/inventory/accessories/:itemId/history', requireAuth, getAccessoryHistory)
app.post('/api/inventory/sku/move', requireAuth, moveSkuToSection)
app.get('/api/inventory/search', requireAuth, searchInventory)

/**
 * Forecasting routes (requires auth)
 */
app.get('/api/forecasting/vendor-configs', requireAuth, getVendorConfigs)
app.post('/api/forecasting/vendor-configs', requireAuth, saveVendorConfigs)
app.get('/api/forecasting', requireAuth, getForecast)

/**
 * Shipments routes (requires auth)
 */
app.get('/api/shipments/inbound', requireAuth, listInboundShipments)
app.post('/api/shipments/inbound', requireAuth, createInboundShipment)
app.patch('/api/shipments/inbound/:id', requireAuth, updateInboundShipment)
app.delete('/api/shipments/inbound/:id', requireAuth, deleteInboundShipment)
app.post('/api/shipments/inbound/:id/push', requireAuth, pushInboundShipment)
app.get('/api/shipments/outbound', requireAuth, listOutboundShipments)
app.post('/api/shipments/outbound', requireAuth, createOutboundShipment)
app.patch('/api/shipments/outbound/:id', requireAuth, updateOutboundShipment)
app.delete('/api/shipments/outbound/:id', requireAuth, deleteOutboundShipment)
app.post('/api/shipments/forecast', requireAuth, forecastShipments)

/**
 * Amazon routes (requires auth)
 */
app.get('/api/amazon/pos', requireAuth, listAmazonPOs)
app.post('/api/amazon/pos', requireAuth, createAmazonPO)
app.patch('/api/amazon/pos/:id', requireAuth, updateAmazonPO)
app.delete('/api/amazon/pos/:id', requireAuth, deleteAmazonPO)
app.get('/api/amazon/inventory', requireAuth, listAmazonInventory)
app.post('/api/amazon/sync', requireAuth, syncAmazonInventory)

/**
 * RMA routes (requires auth)
 */
app.get('/api/rma/tickets', requireAuth, listRMATickets)
app.post('/api/rma/tickets', requireAuth, createRMATicket)
app.patch('/api/rma/tickets/:id', requireAuth, updateRMATicket)
app.delete('/api/rma/tickets/:id', requireAuth, deleteRMATicket)

/**
 * Orders routes (requires auth)
 */
app.get('/api/orders', requireAuth, listOrders)
app.post('/api/orders', requireAuth, createOrder)
app.patch('/api/orders/:id', requireAuth, updateOrder)
app.delete('/api/orders/:id', requireAuth, deleteOrder)

/**
 * Data routes (refurbished, sales data, presets) (requires auth)
 */
app.get('/api/refurbished', requireAuth, listRefurbished)
app.post('/api/refurbished', requireAuth, createRefurbished)
app.patch('/api/refurbished/:id', requireAuth, updateRefurbished)
app.delete('/api/refurbished/:id', requireAuth, deleteRefurbished)
app.get('/api/sales-data', requireAuth, listSalesData)
app.post('/api/sales-data/upsert', requireAuth, upsertSalesData)
app.get('/api/presets/:collectionId', requireAuth, listPresets)
app.post('/api/presets/:collectionId', requireAuth, createPreset)
app.delete('/api/presets/:recordId', requireAuth, deletePreset)
app.post('/api/data/import', requireAuth, importSalesDataCSV)

/**
 * Integration routes (requires auth, except registry which is public)
 */
app.get('/api/integrations/registry', listRegistry)
app.get('/api/integrations', requireAuth, listUserIntegrations)
app.post('/api/integrations/:type/connect', requireAuth, connectIntegration)
app.delete('/api/integrations/:type', requireAuth, disconnectIntegration)
app.post('/api/integrations/:type/sync', requireAuth, triggerSync)
app.get('/api/integrations/:type/schedule', requireAuth, getIntegrationSchedule)
app.patch('/api/integrations/:type/schedule', requireAuth, updateIntegrationSchedule)
app.get('/api/integrations/woocommerce/unknown-skus', requireAuth, listUnknownSkus)
app.post('/api/integrations/woocommerce/unknown-skus/:id/dismiss', requireAuth, dismissUnknownSku)

/**
 * SPA fallback for non-API navigations.
 * Never return index.html for missing asset requests.
 */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next()
    return
  }

  if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
    res.status(404).type('text/plain').send('Not Found')
    return
  }

  if (!fs.existsSync(indexHtmlPath)) {
    next()
    return
  }

  res.sendFile(indexHtmlPath)
})

/**
 * Error handler
 */
app.use((_err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', _err)
  res.status(500).json({ error: 'Internal server error' })
})

/**
 * Validate all required environment variables and secrets at startup.
 * Fail-fast: exit(1) if any validation fails.
 */
function validateStartupSecrets(): void {
  // AIDA_ENCRYPTION_KEY is intentionally excluded — it is generated by the setup wizard
  // on first run and written to .env. Requiring it here would prevent a fresh install
  // from ever reaching the setup wizard.
  const required: Record<string, { min: number; desc: string }> = {
    JWT_SECRET: { min: 32, desc: 'JWT signing key' },
    PB_ADMIN_EMAIL: { min: 5, desc: 'PocketBase superuser email' },
    PB_ADMIN_PASSWORD: { min: 8, desc: 'PocketBase superuser password' },
  }

  const errors: string[] = []

  for (const [key, spec] of Object.entries(required)) {
    const value = process.env[key]?.trim()
    if (!value) {
      errors.push(`Missing required secret: ${key}`)
      continue
    }
    if (value.length < spec.min) {
      errors.push(`${key} is too short (min ${spec.min} chars, got ${value.length})`)
    }
  }

  if (errors.length > 0) {
    console.error('[Startup] Secret validation failed:')
    errors.forEach(err => console.error(`  - ${err}`))
    console.error('[Startup] Refusing to start. Check your .env file.')
    process.exit(1) // ← LOUD FAILURE
  }

  console.log('[Startup] All required secrets are valid.')
}

/**
 * Start server after PocketBase auth
 */
async function startServer() {
  try {
    // Validate secrets first — fail before touching anything external
    validateStartupSecrets()

    // Authenticate with PocketBase before starting server
    await authenticatePocketBase()
    console.log('[PocketBase] Authenticated successfully')

    // Ensure all required collections exist (no-op if already present, self-heals missing ones)
    await bootstrapMissingCollections()

    await startIntegrationScheduler()
    console.log('[Scheduler] Integration auto-sync scheduler initialized')

    const server = app.listen(PORT, () => {
      console.log(`[Express] Server running on http://localhost:${PORT}`)
      console.log(`[CORS] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
    })

    const shutdown = () => {
      stopIntegrationScheduler()
      server.close(() => {
        process.exit(0)
      })
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (err) {
    console.error('[Startup] Failed to start server:', err)
    process.exit(1)
  }
}

/**
 * Handle unhandled promise rejections.
 * Log the error and exit cleanly so container orchestration can restart.
 */
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  console.error('[Process] Unhandled Rejection in promise:', promise)
  console.error('[Process] Reason:', reason instanceof Error ? reason.stack : reason)
  console.error('[Process] Exiting with code 1 to allow recovery.')
  process.exit(1)
})

/**
 * Handle uncaught exceptions.
 * Log the error and exit cleanly so container orchestration can restart.
 */
process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught Exception:')
  console.error(error.stack || error.message)
  console.error('[Process] Exiting with code 1 to allow recovery.')
  process.exit(1)
})

startServer()

export default app
