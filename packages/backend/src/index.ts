import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { authenticatePocketBase } from './lib/pocketbase.js'
import { authMiddleware, requireAuth } from './middleware/auth.js'
import { csrfOriginGuard } from './middleware/csrf.js'
import { login, logout, session } from './routes/auth.js'
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
import { triggerEcommerceSync } from './routes/ecommerce.js'
import {
  checkSetupHealth,
  saveEncryptionKey,
  initCollections,
} from './routes/setup.js'

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
 * Setup routes (no auth required)
 */
app.get('/api/setup/check-health', checkSetupHealth)
app.post('/api/setup/save-encryption-key', saveEncryptionKey)
app.post('/api/setup/init-collections', initCollections)

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
app.post('/api/ecommerce/sync', requireAuth, triggerEcommerceSync)

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
