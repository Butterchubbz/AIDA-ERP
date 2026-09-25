import pb from './pocketbase.js'

const SYSTEM_USER_ID = 'system'
export const SETUP_OWNER_ACTIVITY_WINDOW_DAYS = 90
export const SETUP_OWNER_WARNING_WINDOW_DAYS = 14
const NINETY_DAYS_MS = SETUP_OWNER_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000

interface SystemPrefsRecord {
  id: string
  userId: string
  setupOwnerEmail?: string
  setupOwnerLastLoginAt?: string
}

export interface SetupOwnerLockStatus {
  locked: boolean
  ownerEmail: string | null
  lastLoginAt: string | null
  daysSinceLastLogin: number | null
  daysRemaining: number | null
  state: 'healthy' | 'warning' | 'locked' | 'unconfigured'
}

function toDays(ms: number): number {
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

async function getSystemPrefs(): Promise<SystemPrefsRecord | null> {
  const record = await pb
    .collection('userPreferences')
    .getFirstListItem<SystemPrefsRecord>(pb.filter('userId = {:userId}', { userId: SYSTEM_USER_ID }), { requestKey: null })
    .catch(() => null)

  return record
}

export async function getSetupOwnerLockStatus(currentEmail?: string): Promise<SetupOwnerLockStatus> {
  const prefs = await getSystemPrefs()
  const ownerEmail = prefs?.setupOwnerEmail?.trim() || null
  const lastLoginAt = prefs?.setupOwnerLastLoginAt?.trim() || null

  if (!ownerEmail || !lastLoginAt) {
    return {
      locked: false,
      ownerEmail,
      lastLoginAt,
      daysSinceLastLogin: null,
      daysRemaining: null,
      state: 'unconfigured',
    }
  }

  const parsed = Date.parse(lastLoginAt)
  if (Number.isNaN(parsed)) {
    return {
      locked: false,
      ownerEmail,
      lastLoginAt,
      daysSinceLastLogin: null,
      daysRemaining: null,
      state: 'unconfigured',
    }
  }

  const now = Date.now()
  const elapsed = now - parsed
  const isOverLimit = elapsed > NINETY_DAYS_MS
  const isSetupOwner = Boolean(currentEmail && currentEmail.toLowerCase() === ownerEmail.toLowerCase())
  const daysSinceLastLogin = toDays(elapsed)
  const daysRemaining = Math.max(0, SETUP_OWNER_ACTIVITY_WINDOW_DAYS - daysSinceLastLogin)
  const state: SetupOwnerLockStatus['state'] = isOverLimit
    ? 'locked'
    : daysRemaining <= SETUP_OWNER_WARNING_WINDOW_DAYS
      ? 'warning'
      : 'healthy'

  return {
    locked: isOverLimit && !isSetupOwner,
    ownerEmail,
    lastLoginAt,
    daysSinceLastLogin,
    daysRemaining,
    state,
  }
}

export async function trackSetupOwnerLogin(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return
  }

  const nowIso = new Date().toISOString()
  const prefs = await getSystemPrefs()

  if (!prefs) {
    await pb.collection('userPreferences').create({
      userId: SYSTEM_USER_ID,
      setupOwnerEmail: normalizedEmail,
      setupOwnerLastLoginAt: nowIso,
    })
    return
  }

  const existingOwner = prefs.setupOwnerEmail?.trim().toLowerCase()
  if (!existingOwner || existingOwner === normalizedEmail) {
    await pb.collection('userPreferences').update(prefs.id, {
      setupOwnerEmail: normalizedEmail,
      setupOwnerLastLoginAt: nowIso,
    })
  }
}
