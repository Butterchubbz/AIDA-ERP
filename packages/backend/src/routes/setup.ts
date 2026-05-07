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
  setupComplete: boolean
}

interface SaveKeyRequest {
  key?: string
}

const ENCRYPTION_KEY_NAME = 'VITE_ENCRYPTION_KEY'

function getRepoRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  const routesDir = path.dirname(currentFile)
  return path.resolve(routesDir, '../../../../')
}

function getBackendEnvPath(): string {
  return path.join(getRepoRoot(), 'packages/backend/.env')
}

function getFrontendEnvPath(): string {
  return path.join(getRepoRoot(), 'packages/frontend/.env.local')
}

function isValidEncryptionKey(value: string | undefined): value is string {
  if (!value) {
    return false
  }

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

async function ensureCollection(collectionName: string, fields: Array<Record<string, unknown>>): Promise<CollectionCheck> {
  const exists = await collectionExists(collectionName)
  if (exists) {
    return 'exists'
  }

  await createCollection(collectionName, fields)
  return 'created'
}

async function evaluateSetupState(): Promise<SetupState> {
  const encryptionKeyStatus: SetupCheck = isValidEncryptionKey(process.env.VITE_ENCRYPTION_KEY)
    ? 'ok'
    : process.env.VITE_ENCRYPTION_KEY
      ? 'invalid'
      : 'missing'

  try {
    await ensurePocketBaseAuth()
  } catch {
    return {
      encryptionKey: encryptionKeyStatus,
      userPreferences: 'failed',
      integrations: 'failed',
      setupComplete: false,
    }
  }

  let userPreferencesStatus: CollectionCheck = 'missing'
  let integrationsStatus: CollectionCheck = 'missing'

  try {
    userPreferencesStatus = (await collectionExists('userPreferences')) ? 'exists' : 'missing'
    integrationsStatus = (await collectionExists('integrations')) ? 'exists' : 'missing'
  } catch {
    userPreferencesStatus = 'failed'
    integrationsStatus = 'failed'
  }

  const setupComplete =
    encryptionKeyStatus === 'ok' &&
    userPreferencesStatus === 'exists' &&
    integrationsStatus === 'exists'

  return {
    encryptionKey: encryptionKeyStatus,
    userPreferences: userPreferencesStatus,
    integrations: integrationsStatus,
    setupComplete,
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
    },
  })
}

/**
 * POST /api/setup/save-encryption-key
 * Persists the generated key to backend and frontend local env files.
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
    await upsertEnvVariable(getFrontendEnvPath(), ENCRYPTION_KEY_NAME, key)
    process.env.VITE_ENCRYPTION_KEY = key
    res.status(200).json({ status: 'saved' })
  } catch (err: unknown) {
    console.error('[Setup] Failed to save encryption key:', err)
    res.status(500).json({ error: 'Failed to save encryption key locally' })
  }
}

/**
 * POST /api/setup/init-collections
 * Creates required setup collections when they are missing.
 */
export async function initCollections(_req: Request, res: Response): Promise<void> {
  try {
    await ensurePocketBaseAuth()
  } catch (err: unknown) {
    console.error('[Setup] PocketBase authentication failed:', err)
    res.status(503).json({ error: 'PocketBase is not ready' })
    return
  }

  const userPreferencesFields: Array<Record<string, unknown>> = [
    { name: 'userId', type: 'text', required: true },
    { name: 'velocityOverrides', type: 'json' },
    { name: 'vendorConfigs', type: 'json' },
    { name: 'skuVendorMap', type: 'json' },
    { name: 'encryptedWoocommerceKey', type: 'text' },
  ]

  const integrationsFields: Array<Record<string, unknown>> = [
    { name: 'userId', type: 'text', required: true },
    { name: 'encryptedWoocommerceKey', type: 'text' },
    { name: 'woocommerceStoreUrl', type: 'text' },
    { name: 'syncLastRun', type: 'date' },
    { name: 'syncStatus', type: 'text' },
  ]

  let userPreferences: CollectionCheck = 'failed'
  let integrations: CollectionCheck = 'failed'

  try {
    userPreferences = await ensureCollection('userPreferences', userPreferencesFields)
  } catch (err: unknown) {
    console.error('[Setup] Failed ensuring userPreferences:', err)
    userPreferences = 'failed'
  }

  try {
    integrations = await ensureCollection('integrations', integrationsFields)
  } catch (err: unknown) {
    console.error('[Setup] Failed ensuring integrations:', err)
    integrations = 'failed'
  }

  const complete = userPreferences !== 'failed' && integrations !== 'failed'

  res.status(200).json({
    userPreferences,
    integrations,
    complete,
  })
}