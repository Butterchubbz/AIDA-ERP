import type { NextFunction, Request, Response } from 'express'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import pb, { authenticatePocketBase, isPbAuthenticated } from '../lib/pocketbase.js'

let isSetupCachedComplete: boolean = false
const SYSTEM_USER_ID = 'system'

const REQUIRED_SETUP_COLLECTIONS = [
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

export function setSetupComplete(): void {
  isSetupCachedComplete = true
}

interface SystemPreferencesRecord {
  id: string
  setupTokenHash?: string
  setupCompletedAt?: string
}

function hashSetupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function getBearerToken(req: Request): string | null {
  const authorization = req.get('authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function tokensMatch(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSetupToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function getSystemPreferences(): Promise<SystemPreferencesRecord | null> {
  return pb
    .collection('userPreferences')
    .getFirstListItem<SystemPreferencesRecord>(pb.filter('userId = {:userId}', { userId: SYSTEM_USER_ID }))
    .catch(() => null)
}

async function confirmSetupComplete(): Promise<boolean> {
  const key = process.env.AIDA_ENCRYPTION_KEY?.trim() ?? ''
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    return false
  }

  try {
    if (!isPbAuthenticated()) {
      await authenticatePocketBase()
    }

    for (const collectionName of REQUIRED_SETUP_COLLECTIONS) {
      try {
        await (pb as any).collection(collectionName).getList(1, 1)
      } catch {
        return false
      }
    }

    const userList = await (pb as any).collection('users').getList(1, 1)
    if (!userList?.items || userList.items.length === 0) {
      return false
    }

    return true
  } catch (error: unknown) {
    console.error('[SetupLock] Failed to evaluate setup completion state:', error)
    return false
  }
}

async function isSetupComplete(): Promise<boolean> {
  if (isSetupCachedComplete) {
    return true
  }

  const setupIsComplete = await confirmSetupComplete()
  if (setupIsComplete) {
    setSetupComplete()
  }
  return setupIsComplete
}

/**
 * Allows first-run setup without credentials. Once setup is complete, a bearer
 * token whose SHA-256 hash matches the system settings record is required.
 */
export async function requireSetupAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!await isSetupComplete()) {
      next()
      return
    }

    const token = getBearerToken(req)
    const settings = await getSystemPreferences()
    if (!token || !settings?.setupTokenHash || !tokensMatch(token, settings.setupTokenHash)) {
      res.status(403).json({ error: 'Setup access token required.' })
      return
    }

    next()
  } catch (error: unknown) {
    console.error('[SetupLock] Setup state lookup failed; failing closed:', error)
    res.status(403).json({ error: 'Setup access unavailable.' })
  }
}

export async function createSetupAccessToken(): Promise<string | null> {
  if (!isPbAuthenticated()) {
    await authenticatePocketBase()
  }

  const existing = await getSystemPreferences()
  if (existing?.setupTokenHash) {
    setSetupComplete()
    return null
  }

  const token = randomBytes(32).toString('base64url')
  const setupTokenHash = hashSetupToken(token)
  const data = {
    userId: SYSTEM_USER_ID,
    setupTokenHash,
    setupCompletedAt: new Date().toISOString(),
  }

  if (existing) {
    await pb.collection('userPreferences').update(existing.id, data)
  } else {
    await pb.collection('userPreferences').create(data)
  }

  setSetupComplete()
  return token
}

export function resetSetupLockForTests(): void {
  isSetupCachedComplete = false
}

export { isSetupCachedComplete }
