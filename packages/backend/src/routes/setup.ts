import type { Request, Response } from 'express'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pb, { authenticatePocketBase, isPbAuthenticated } from '../lib/pocketbase.js'

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
  salesData: CollectionCheck
  setupComplete: boolean
}

interface SaveKeyRequest {
  key?: string
}

interface SetWorkspaceModeRequest {
  mode?: string
}

const ENCRYPTION_KEY_NAME = 'AIDA_ENCRYPTION_KEY'

const REQUIRED_COLLECTIONS = [
  'userPreferences',
  'integrations',
  'inventoryDevice',
  'inventoryComponent',
  'inventoryAccessory',
  'stockHistory',
  'wcUnknownSkus',
  'salesData',
] as const

type RequiredCollection = typeof REQUIRED_COLLECTIONS[number]

function getRepoRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  const routesDir = path.dirname(currentFile)
  return path.resolve(routesDir, '../../../../')
}

function getBackendEnvPath(): string {
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

const salesDataFields: Array<Record<string, unknown>> = [
  { name: 'sku', type: 'text', required: true },
  { name: 'saleDate', type: 'text', required: true },
  { name: 'quantity', type: 'number' },
  { name: 'salePrice', type: 'number' },
  { name: 'source', type: 'text' },
  { name: 'userId', type: 'text' },
]

const COLLECTION_FIELDS: Record<RequiredCollection, Array<Record<string, unknown>>> = {
  userPreferences: userPreferencesFields,
  integrations: integrationsFields,
  inventoryDevice: inventoryDeviceFields,
  inventoryComponent: inventoryComponentFields,
  inventoryAccessory: inventoryAccessoryFields,
  stockHistory: stockHistoryFields,
  wcUnknownSkus: wcUnknownSkusFields,
  salesData: salesDataFields,
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
      ...(failed as Pick<SetupState, 'userPreferences' | 'integrations' | 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory' | 'stockHistory' | 'wcUnknownSkus' | 'salesData'>),
      setupComplete: false,
    }
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
    salesData: collectionStatuses.salesData ?? 'failed',
    setupComplete,
  }
}

/**
 * Ensures the salesData collection exists. Called at server startup so that
 * existing installations that pre-date this collection get it automatically
 * without needing to re-run the setup wizard.
 */
export async function bootstrapMissingCollections(): Promise<void> {
  try {
    await ensurePocketBaseAuth()
    for (const name of REQUIRED_COLLECTIONS) {
      try {
        await ensureCollection(name, COLLECTION_FIELDS[name])
      } catch (err: unknown) {
        console.warn(`[Bootstrap] Could not ensure collection "${name}":`, err)
      }
    }
    console.log('[Bootstrap] Required collections verified/created.')
  } catch (err: unknown) {
    console.warn('[Bootstrap] PocketBase not ready during collection bootstrap — skipping:', err)
  }
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
      salesData: setup.salesData,
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
