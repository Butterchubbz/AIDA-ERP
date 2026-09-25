import type { Request, Response } from 'express'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pb, { authenticatePocketBase, isPbAuthenticated } from '../lib/pocketbase.js'
import { createSetupAccessToken } from '../middleware/setupLock.js'
import {
  getSetupOwnerLockStatus,
  SETUP_OWNER_ACTIVITY_WINDOW_DAYS,
  SETUP_OWNER_WARNING_WINDOW_DAYS,
} from '../lib/setupOwnerLock.js'

type SetupCheck = 'ok' | 'missing' | 'invalid' | 'fail'
type CollectionCheck = 'exists' | 'created' | 'missing' | 'failed'

interface SetupState {
  encryptionKey: SetupCheck
  userPreferences: CollectionCheck
  integrations: CollectionCheck
  inventoryDevice: CollectionCheck
  inventoryComponent: CollectionCheck
  inventoryAccessory: CollectionCheck
  stockHistory: CollectionCheck
  wcUnknownSkus: CollectionCheck
  inventoryWorkspaces: CollectionCheck
  inventoryItems: CollectionCheck
  euReturns: CollectionCheck
  shippingHistory: CollectionCheck
  setupComplete: boolean
}

interface SaveKeyRequest {
  key?: string
}

interface SetWorkspaceModeRequest {
  mode?: string
}

interface BootstrapSuperuserRequest {
  email?: string
  password?: string
}

const ENCRYPTION_KEY_NAME = 'AIDA_ENCRYPTION_KEY'

// Defense-in-depth throttle for the superuser bootstrap endpoint: per-IP,
// in-memory only (resets on process restart — acceptable here because the
// real, durable security gate lives in PocketBase itself (pb_hooks), which
// checks for a fresh install on every request regardless of this counter).
const SUPERUSER_BOOTSTRAP_RATE_LIMIT_MAX = 5
const SUPERUSER_BOOTSTRAP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const superuserBootstrapAttempts = new Map<string, { count: number; windowStart: number }>()

// Collections gated by the setup wizard — must all exist for setupComplete to be true.
const REQUIRED_COLLECTIONS = [
  'userPreferences',
  'integrations',
  'inventoryDevice',
  'inventoryComponent',
  'inventoryAccessory',
  'stockHistory',
  'wcUnknownSkus',
  'inventoryWorkspaces',
  'inventoryItems',
  'euReturns',
  'shippingHistory',
] as const

type RequiredCollection = typeof REQUIRED_COLLECTIONS[number]

// Runtime collections created silently at startup — not part of setup wizard gating.
const RUNTIME_COLLECTIONS: Array<{ name: string; fields: Array<Record<string, unknown>> }> = [
  {
    name: 'salesData',
    fields: [
      { name: 'sku', type: 'text', required: true },
      { name: 'saleDate', type: 'text', required: true },
      { name: 'quantity', type: 'number' },
      { name: 'salePrice', type: 'number' },
      { name: 'source', type: 'text' },
      { name: 'userId', type: 'text' },
    ],
  },
  {
    name: 'amazonDevices',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'inventorySku', type: 'text', required: true },
      { name: 'inventoryId', type: 'text' },
      { name: 'updatedAt', type: 'date' },
    ],
  },
  {
    name: 'amazonVariants',
    fields: [
      { name: 'deviceId', type: 'text', required: true },
      { name: 'label', type: 'text', required: true },
      { name: 'sku', type: 'text', required: true },
      { name: 'asin', type: 'text' },
      { name: 'packSize', type: 'number' },
      { name: 'fbaStock', type: 'number' },
      { name: 'lowStockThreshold', type: 'number' },
    ],
  },
  {
    name: 'amazonStockHistory',
    fields: [
      { name: 'variantId', type: 'text', required: true },
      { name: 'timestamp', type: 'date' },
      { name: 'oldValue', type: 'number' },
      { name: 'newValue', type: 'number' },
      { name: 'reason', type: 'text' },
      { name: 'changedBy', type: 'text' },
    ],
  },
]

function getRepoRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  const routesDir = path.dirname(currentFile)
  return path.resolve(routesDir, '../../../../')
}

function getBackendEnvPath(): string {
  // Test-only override so unit tests never touch the real backend .env file.
  if (process.env.AIDA_SETUP_ENV_FILE_OVERRIDE) {
    return process.env.AIDA_SETUP_ENV_FILE_OVERRIDE
  }

  // In Docker, AIDA_LOCAL_ENV_PATH points at a file on a persistent volume
  // (see docker-compose.yml) so wizard-written secrets survive container
  // restarts — index.ts reloads this same file into process.env at boot.
  if (process.env.AIDA_LOCAL_ENV_PATH) {
    return process.env.AIDA_LOCAL_ENV_PATH
  }

  return path.join(getRepoRoot(), 'packages/backend/.env')
}

function isValidEncryptionKey(value: string | undefined): value is string {
  if (!value) return false
  return /^[0-9a-fA-F]{64}$/.test(value)
}

async function ensurePocketBaseAuth(): Promise<void> {
  if (!isPbAuthenticated()) {
    await authenticatePocketBase()
  }
}

async function upsertEnvVariable(filePath: string, name: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })

  let content = ''
  try {
    content = await readFile(filePath, 'utf8')
  } catch {
    content = ''
  }

  const lines = content.length > 0 ? content.split(/\r?\n/) : []
  let found = false

  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${name}=`)) {
      found = true
      return `${name}=${value}`
    }

    return line
  })

  if (!found) {
    updatedLines.push(`${name}=${value}`)
  }

  const normalized = updatedLines.filter((line, index) => {
    if (line.length > 0) {
      return true
    }

    return index < updatedLines.length - 1
  })

  await writeFile(filePath, `${normalized.join('\n')}\n`, 'utf8')
}

async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    await pb.send(`/api/collections/${encodeURIComponent(collectionName)}`, { method: 'GET' })
    return true
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      return false
    }
    throw err
  }
}

async function createCollection(collectionName: string, fields: Array<Record<string, unknown>>): Promise<void> {
  const basePayload = {
    type: 'base',
    name: collectionName,
    fields,
  }

  try {
    await pb.send('/api/collections', {
      method: 'POST',
      body: basePayload,
    })
  } catch {
    await pb.send('/api/collections', {
      method: 'POST',
      body: {
        type: 'base',
        name: collectionName,
        schema: fields,
      },
    })
  }
}

async function patchMissingFields(collectionName: string, desiredFields: Array<Record<string, unknown>>): Promise<void> {
  let collectionData: { id: string; fields?: Array<{ name: string }>; schema?: Array<{ name: string }> }
  try {
    collectionData = await pb.send(`/api/collections/${encodeURIComponent(collectionName)}`, { method: 'GET' })
  } catch {
    return
  }

  const existingNames = new Set(
    ((collectionData.fields ?? collectionData.schema) || []).map((f) => f.name)
  )
  const newFields = desiredFields.filter((f) => typeof f.name === 'string' && !existingNames.has(f.name as string))

  if (newFields.length === 0) {
    return
  }

  const allFields = [
    ...(collectionData.fields ?? collectionData.schema ?? []),
    ...newFields,
  ]

  // Try modern `fields` key first, fall back to `schema`
  try {
    await pb.send(`/api/collections/${encodeURIComponent(collectionData.id)}`, {
      method: 'PATCH',
      body: { fields: allFields },
    })
  } catch {
    await pb.send(`/api/collections/${encodeURIComponent(collectionData.id)}`, {
      method: 'PATCH',
      body: { schema: allFields },
    })
  }
}

async function ensureCollection(collectionName: string, fields: Array<Record<string, unknown>>): Promise<CollectionCheck> {
  const exists = await collectionExists(collectionName)
  if (exists) {
    await patchMissingFields(collectionName, fields)
    return 'exists'
  }

  await createCollection(collectionName, fields)
  return 'created'
}

// Field schemas for all required collections

const userPreferencesFields: Array<Record<string, unknown>> = [
  { name: 'userId', type: 'text', required: true },
  { name: 'velocityOverrides', type: 'json' },
  { name: 'vendorConfigs', type: 'json' },
  { name: 'skuVendorMap', type: 'json' },
  { name: 'encryptedWoocommerceKey', type: 'text' },
  { name: 'workspaceMode', type: 'text' },
  { name: 'setupOwnerEmail', type: 'text' },
  { name: 'setupOwnerLastLoginAt', type: 'date' },
  { name: 'setupTokenHash', type: 'text' },
  { name: 'setupCompletedAt', type: 'date' },
]

const integrationsFields: Array<Record<string, unknown>> = [
  { name: 'userId', type: 'text', required: true },
  { name: 'type', type: 'text', required: true },
  { name: 'encryptedCredentials', type: 'text' },
  { name: 'lastSyncAt', type: 'date' },
  { name: 'lastSyncStatus', type: 'text' },
  { name: 'lastSyncMessage', type: 'text' },
  { name: 'syncIntervalHours', type: 'number' },
]

const inventoryDeviceFields: Array<Record<string, unknown>> = [
  { name: 'name', type: 'text', required: true },
  { name: 'sku', type: 'text', required: true },
  { name: 'barcode', type: 'text' },
  { name: 'webStock', type: 'number' },
  { name: 'warehouseStock', type: 'number' },
  { name: 'productionStock', type: 'number' },
  { name: 'reserveStock', type: 'number' },
  { name: 'onlineStock', type: 'number' },
  { name: 'countedStock', type: 'number' },
  { name: 'location', type: 'text' },
  { name: 'quantity', type: 'number' },
]

const inventoryComponentFields: Array<Record<string, unknown>> = [
  { name: 'name', type: 'text', required: true },
  { name: 'sku', type: 'text', required: true },
  { name: 'barcode', type: 'text' },
  { name: 'onlineStock', type: 'number' },
  { name: 'countedStock', type: 'number' },
  { name: 'category', type: 'text' },
  { name: 'subcategory', type: 'text' },
]

const inventoryAccessoryFields: Array<Record<string, unknown>> = [...inventoryDeviceFields]

const stockHistoryFields: Array<Record<string, unknown>> = [
  { name: 'inventoryItemId', type: 'text', required: true },
  { name: 'timestamp', type: 'date' },
  { name: 'field', type: 'text' },
  { name: 'oldValue', type: 'number' },
  { name: 'newValue', type: 'number' },
  { name: 'change', type: 'number' },
  { name: 'changedByEmail', type: 'text' },
  { name: 'operation', type: 'text' },
]

const wcUnknownSkusFields: Array<Record<string, unknown>> = [
  { name: 'sku', type: 'text', required: true },
  { name: 'productName', type: 'text' },
  { name: 'wcStock', type: 'number' },
  { name: 'seenAt', type: 'date' },
  { name: 'dismissed', type: 'bool' },
]

const inventoryWorkspacesFields: Array<Record<string, unknown>> = [
  { name: 'name', type: 'text', required: true },
  { name: 'type', type: 'select', required: true, options: ['device', 'component', 'accessory', 'refurb_device', 'refurb_component'] },
  { name: 'description', type: 'text' },
]

const inventoryItemsFields: Array<Record<string, unknown>> = [
  { name: 'workspaceId', type: 'relation', required: true, options: { collectionId: 'inventoryWorkspaces', cascadeDelete: false } },
  { name: 'sku', type: 'text', required: true },
  { name: 'name', type: 'text', required: true },
  { name: 'barcode', type: 'text' },
  { name: 'location', type: 'text' },
  { name: 'warehouseStock', type: 'number', required: true, default: 0 },
  { name: 'webStock', type: 'number', required: true, default: 0 },
  { name: 'onlineStock', type: 'number', required: true, default: 0 },
  { name: 'countedStock', type: 'number' },
]

const euReturnsFields: Array<Record<string, unknown>> = [
  { name: 'rmaNumber', type: 'text', required: true },
  { name: 'workspaceId', type: 'relation', options: { collectionId: 'inventoryWorkspaces', cascadeDelete: false } },
  { name: 'sku', type: 'text', required: true },
  { name: 'serialNumber', type: 'text' },
  { name: 'customerName', type: 'text' },
  { name: 'returnReason', type: 'text' },
  { name: 'condition', type: 'select', required: true, options: ['unopened', 'opened_functional', 'refurbishable', 'scrap'] },
  { name: 'status', type: 'select', required: true, options: ['pending_receipt', 'received', 'under_test', 'refurbished', 'scrapped'] },
  { name: 'processedBy', type: 'text' },
  { name: 'receivedAt', type: 'date' },
  { name: 'historyLogs', type: 'json', default: '[]' },
]

const shippingHistoryFields: Array<Record<string, unknown>> = [
  { name: 'trackingNumber', type: 'text', required: true },
  { name: 'carrier', type: 'select', required: true, options: ['DHL', 'DPD', 'UPS', 'FedEx', 'Other'] },
  { name: 'destination', type: 'text', required: true },
  { name: 'shipDate', type: 'date', required: true },
  { name: 'status', type: 'select', required: true, options: ['label_created', 'in_transit', 'delivered', 'exception'] },
  { name: 'itemsShipped', type: 'json', required: true },
  { name: 'packageWeight', type: 'number' },
  { name: 'postageCost', type: 'number' },
]

const COLLECTION_FIELDS: Record<RequiredCollection, Array<Record<string, unknown>>> = {
  userPreferences: userPreferencesFields,
  integrations: integrationsFields,
  inventoryDevice: inventoryDeviceFields,
  inventoryComponent: inventoryComponentFields,
  inventoryAccessory: inventoryAccessoryFields,
  stockHistory: stockHistoryFields,
  wcUnknownSkus: wcUnknownSkusFields,
  inventoryWorkspaces: inventoryWorkspacesFields,
  inventoryItems: inventoryItemsFields,
  euReturns: euReturnsFields,
  shippingHistory: shippingHistoryFields,
}

async function evaluateSetupState(): Promise<SetupState> {
  const encryptionKeyStatus: SetupCheck = isValidEncryptionKey(process.env.AIDA_ENCRYPTION_KEY)
    ? 'ok'
    : process.env.VITE_ENCRYPTION_KEY
      ? 'invalid'
      : 'missing'

  try {
    await ensurePocketBaseAuth()
  } catch {
    const failed: Record<string, CollectionCheck> = {}
    for (const name of REQUIRED_COLLECTIONS) {
      failed[name] = 'failed'
    }
    return {
      encryptionKey: encryptionKeyStatus,
      userPreferences: 'failed',
      integrations: 'failed',
      inventoryDevice: 'failed',
      inventoryComponent: 'failed',
      inventoryAccessory: 'failed',
      stockHistory: 'failed',
      wcUnknownSkus: 'failed',
      inventoryWorkspaces: 'failed',
      inventoryItems: 'failed',
      euReturns: 'failed',
      shippingHistory: 'failed',
      setupComplete: false,
    } satisfies SetupState
  }

  const collectionStatuses: Partial<Record<RequiredCollection, CollectionCheck>> = {}

  for (const name of REQUIRED_COLLECTIONS) {
    try {
      collectionStatuses[name] = (await collectionExists(name)) ? 'exists' : 'missing'
    } catch {
      collectionStatuses[name] = 'failed'
    }
  }

  const allCollectionsExist = REQUIRED_COLLECTIONS.every(
    (name) => collectionStatuses[name] === 'exists'
  )

  const setupComplete = encryptionKeyStatus === 'ok' && allCollectionsExist

  return {
    encryptionKey: encryptionKeyStatus,
    userPreferences: collectionStatuses.userPreferences ?? 'failed',
    integrations: collectionStatuses.integrations ?? 'failed',
    inventoryDevice: collectionStatuses.inventoryDevice ?? 'failed',
    inventoryComponent: collectionStatuses.inventoryComponent ?? 'failed',
    inventoryAccessory: collectionStatuses.inventoryAccessory ?? 'failed',
    stockHistory: collectionStatuses.stockHistory ?? 'failed',
    wcUnknownSkus: collectionStatuses.wcUnknownSkus ?? 'failed',
    inventoryWorkspaces: collectionStatuses.inventoryWorkspaces ?? 'failed',
    inventoryItems: collectionStatuses.inventoryItems ?? 'failed',
    euReturns: collectionStatuses.euReturns ?? 'failed',
    shippingHistory: collectionStatuses.shippingHistory ?? 'failed',
    setupComplete,
  }
}

/**
 * Ensures the salesData collection exists. Called at server startup so that
 * existing installations that pre-date this collection get it automatically
 * without needing to re-run the setup wizard.
 */
export async function bootstrapMissingCollections(): Promise<void> {
  await ensurePocketBaseAuth()

  for (const name of REQUIRED_COLLECTIONS) {
    await ensureCollection(name, COLLECTION_FIELDS[name])
  }

  for (const { name, fields } of RUNTIME_COLLECTIONS) {
    await ensureCollection(name, fields)
  }

  console.log('[Bootstrap] Required collections verified/created.')
}

/**
 * GET /api/setup/check-health
 * Returns backend + PocketBase status and whether first-run setup is complete.
 */
export async function checkSetupHealth(_req: Request, res: Response): Promise<void> {
  let pocketbaseStatus: 'ok' | 'fail' = 'ok'

  try {
    await ensurePocketBaseAuth()
    await pb.send('/api/health', { method: 'GET' })
  } catch {
    pocketbaseStatus = 'fail'
  }

  const setup = await evaluateSetupState()

  res.status(200).json({
    backend: 'ok',
    pocketbase: pocketbaseStatus,
    setupComplete: setup.setupComplete,
    checks: {
      encryptionKey: setup.encryptionKey,
      userPreferences: setup.userPreferences,
      integrations: setup.integrations,
      inventoryDevice: setup.inventoryDevice,
      inventoryComponent: setup.inventoryComponent,
      inventoryAccessory: setup.inventoryAccessory,
      stockHistory: setup.stockHistory,
      wcUnknownSkus: setup.wcUnknownSkus,
    },
  })
}

/**
 * POST /api/setup/save-encryption-key
 * Persists the generated key to backend local env file.
 */
export async function saveEncryptionKey(req: Request, res: Response): Promise<void> {
  const body = req.body as SaveKeyRequest
  const key = body.key?.trim()

  if (!isValidEncryptionKey(key)) {
    res.status(400).json({ error: 'Encryption key must be a 64-character hex string' })
    return
  }

  try {
    await upsertEnvVariable(getBackendEnvPath(), ENCRYPTION_KEY_NAME, key)
    process.env.AIDA_ENCRYPTION_KEY = key
    res.status(200).json({ status: 'saved' })
  } catch (err: unknown) {
    console.error('[Setup] Failed to save encryption key:', err)
    res.status(500).json({ error: 'Failed to save encryption key locally' })
  }
}

function isEnvCredentialModeActive(): boolean {
  return Boolean(process.env.PB_ADMIN_EMAIL && process.env.PB_ADMIN_PASSWORD)
}

function checkSuperuserBootstrapRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = superuserBootstrapAttempts.get(ip)

  if (!entry || now - entry.windowStart > SUPERUSER_BOOTSTRAP_RATE_LIMIT_WINDOW_MS) {
    superuserBootstrapAttempts.set(ip, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= SUPERUSER_BOOTSTRAP_RATE_LIMIT_MAX) {
    return false
  }

  entry.count += 1
  return true
}

export function resetSuperuserBootstrapRateLimitForTests(): void {
  superuserBootstrapAttempts.clear()
}

/**
 * GET /api/setup/superuser-bootstrap-status
 * Tells the wizard whether the "create PocketBase superuser" step should be
 * shown. Disabled outright when PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD are set
 * (env-credential mode); otherwise mirrors PocketBase's own fresh-install
 * check so the UI never offers a step the server would reject.
 */
export async function getSuperuserBootstrapStatus(_req: Request, res: Response): Promise<void> {
  if (isEnvCredentialModeActive()) {
    res.status(200).json({ available: false, reason: 'env-credentials' })
    return
  }

  try {
    const status = await pb.send<{ available: boolean }>('/api/aida/bootstrap-superuser', { method: 'GET' })
    res.status(200).json({ available: Boolean(status?.available) })
  } catch (err: unknown) {
    console.error('[Setup] Failed to read superuser bootstrap status:', err)
    res.status(200).json({ available: false, reason: 'unreachable' })
  }
}

/**
 * POST /api/setup/superuser-bootstrap
 * Creates the initial PocketBase superuser from the setup wizard when the
 * container was started without PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD. The
 * authoritative gate (fresh install: no superusers, no application users)
 * is enforced inside PocketBase itself (see pocketbase/pb_hooks); this
 * handler additionally disables itself in env-credential mode and applies
 * a per-IP rate limit as defense-in-depth.
 */
export async function createSuperuserViaWizard(req: Request, res: Response): Promise<void> {
  if (isEnvCredentialModeActive()) {
    res.status(403).json({
      error: 'Superuser bootstrap is disabled because PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD are already configured.',
    })
    return
  }

  const ip = req.ip || 'unknown'
  if (!checkSuperuserBootstrapRateLimit(ip)) {
    res.status(429).json({ error: 'Too many attempts. Please try again later.' })
    return
  }

  const body = req.body as BootstrapSuperuserRequest
  const email = body.email?.trim()
  const password = body.password

  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' })
    return
  }
  if (!password || password.length < 10) {
    res.status(400).json({ error: 'Password must be at least 10 characters long.' })
    return
  }

  try {
    await pb.send('/api/aida/bootstrap-superuser', {
      method: 'POST',
      body: { email, password },
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 403 || status === 410) {
      res.status(403).json({ error: 'Superuser bootstrap is no longer available.' })
      return
    }
    if (status === 400) {
      res.status(400).json({ error: 'PocketBase rejected the provided email/password.' })
      return
    }
    console.error('[Setup] Superuser bootstrap request to PocketBase failed:', err)
    res.status(502).json({ error: 'Failed to create the superuser in PocketBase.' })
    return
  }

  try {
    await upsertEnvVariable(getBackendEnvPath(), 'PB_ADMIN_EMAIL', email)
    await upsertEnvVariable(getBackendEnvPath(), 'PB_ADMIN_PASSWORD', password)
    process.env.PB_ADMIN_EMAIL = email
    process.env.PB_ADMIN_PASSWORD = password

    await authenticatePocketBase()
    await bootstrapMissingCollections()

    res.status(200).json({ status: 'created' })
  } catch (err: unknown) {
    console.error('[Setup] Superuser was created but finishing setup failed:', err)
    res.status(500).json({
      error: 'Superuser was created, but finishing setup failed. Check server logs and retry the wizard.',
    })
  }
}

export async function completeSetup(_req: Request, res: Response): Promise<void> {
  try {
    const setupToken = await createSetupAccessToken()
    if (setupToken) {
      await upsertEnvVariable(getBackendEnvPath(), 'AIDA_SETUP_TOKEN', setupToken)
      process.env.AIDA_SETUP_TOKEN = setupToken
    }
    res.status(200).json({
      status: 'complete',
      setupComplete: true,
      ...(setupToken ? { setupToken } : {}),
    })
  } catch (err: unknown) {
    console.error('[Setup] Failed to finalize setup lock:', err)
    res.status(500).json({ error: 'Failed to finalize setup' })
  }
}

/**
 * POST /api/setup/init-collections
 * Creates all required PocketBase collections when missing.
 */
export async function initCollections(_req: Request, res: Response): Promise<void> {
  try {
    await ensurePocketBaseAuth()
  } catch (err: unknown) {
    console.error('[Setup] PocketBase authentication failed:', err)
    res.status(503).json({ error: 'PocketBase is not ready' })
    return
  }

  const results: Partial<Record<RequiredCollection, CollectionCheck>> = {}

  for (const name of REQUIRED_COLLECTIONS) {
    try {
      results[name] = await ensureCollection(name, COLLECTION_FIELDS[name])
    } catch (err: unknown) {
      console.error(`[Setup] Failed ensuring ${name}:`, err)
      results[name] = 'failed'
    }
  }

  const complete = REQUIRED_COLLECTIONS.every(
    (name) => results[name] === 'exists' || results[name] === 'created'
  )

  res.status(200).json({
    ...results,
    complete,
  })
}

/**
 * POST /api/setup/set-workspace-mode
 * Saves Solo or Team mode to a system-level userPreferences record.
 * Called during setup wizard before user login exists.
 */
export async function setWorkspaceMode(req: Request, res: Response): Promise<void> {
  const body = req.body as SetWorkspaceModeRequest
  const mode = body.mode

  if (mode !== 'solo' && mode !== 'team') {
    res.status(400).json({ error: 'mode must be "solo" or "team"' })
    return
  }

  try {
    await ensurePocketBaseAuth()

    const existing = await pb
      .collection('userPreferences')
      .getFirstListItem('userId = "system"', { requestKey: null })
      .catch(() => null)

    if (existing) {
      await pb.collection('userPreferences').update(existing.id, { workspaceMode: mode })
    } else {
      await pb.collection('userPreferences').create({ userId: 'system', workspaceMode: mode })
    }

    res.status(200).json({ mode })
  } catch (err: unknown) {
    console.error('[Setup] setWorkspaceMode failed:', err)
    res.status(500).json({ error: 'Failed to save workspace mode' })
  }
}

export async function completeSetupWizard(_req: Request, res: Response): Promise<void> {
  try {
    const setupToken = await createSetupAccessToken()
    if (setupToken) {
      await upsertEnvVariable(getBackendEnvPath(), 'AIDA_SETUP_TOKEN', setupToken)
      process.env.AIDA_SETUP_TOKEN = setupToken
    }
    res.status(200).json({
      status: 'complete',
      setupComplete: true,
      ...(setupToken ? { setupToken } : {}),
    })
  } catch (err: unknown) {
    console.error('[Setup] Final completion step failed:', err)
    res.status(500).json({ error: 'Failed to finalize setup wizard' })
  }
}

/**
 * GET /api/setup/owner-lock-status
 * Returns setup-owner inactivity window status used by admin warning UI.
 */
export async function getOwnerLockStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const status = await getSetupOwnerLockStatus(req.user.email)
    res.status(200).json({
      ...status,
      activityWindowDays: SETUP_OWNER_ACTIVITY_WINDOW_DAYS,
      warningWindowDays: SETUP_OWNER_WARNING_WINDOW_DAYS,
    })
  } catch (err: unknown) {
    console.error('[Setup] Failed to get owner lock status:', err)
    res.status(500).json({ error: 'Failed to get owner lock status' })
  }
}
