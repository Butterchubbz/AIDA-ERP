import pb from './pocketbase.js'
import { decryptCredential } from './encryption.js'
import type { IntegrationAdapter, SyncResult } from '../integrations/registry.js'

export interface IntegrationRecord {
  id: string
  userId: string
  type: string
  encryptedCredentials: string
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
  syncIntervalHours?: number | null
}

export async function getUserIntegration(userId: string, type: string): Promise<IntegrationRecord | null> {
  return pb
    .collection('integrations')
    .getFirstListItem(`userId = "${userId}" && type = "${type}"`)
    .catch(() => null) as Promise<IntegrationRecord | null>
}

export async function getIntegrationById(id: string): Promise<IntegrationRecord | null> {
  return pb
    .collection('integrations')
    .getOne(id)
    .catch(() => null) as Promise<IntegrationRecord | null>
}

export async function runIntegrationSync(
  record: IntegrationRecord,
  adapter: IntegrationAdapter
): Promise<SyncResult> {
  let credentials: Record<string, string>
  try {
    credentials = JSON.parse(decryptCredential(record.encryptedCredentials))
  } catch (err: unknown) {
    throw new Error('Failed to read stored credentials. Try re-entering them.')
  }

  try {
    const result = await adapter.sync(credentials, pb)
    await pb.collection('integrations').update(record.id, {
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: result.errors.length === 0 ? 'success' : 'partial',
      lastSyncMessage: result.errors.length > 0 ? result.errors.slice(0, 5).join('; ') : null,
    })
    return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'

    await pb
      .collection('integrations')
      .update(record.id, {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'error',
        lastSyncMessage: message,
      })
      .catch(() => {})

    throw new Error(message)
  } finally {
    credentials = {}
  }
}
