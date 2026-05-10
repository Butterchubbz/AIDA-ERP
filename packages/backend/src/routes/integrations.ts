import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import { encryptCredential } from '../lib/encryption.js'
import { getAdapter, listAdapters } from '../integrations/registry.js'
import {
  getUserIntegration,
  runIntegrationSync,
  type IntegrationRecord,
} from '../lib/integrationService.js'
import {
  rescheduleIntegration,
  unscheduleIntegration,
} from '../lib/syncScheduler.js'

const ALLOWED_SYNC_INTERVALS = new Set([1, 6, 24])

/**
 * GET /api/integrations/registry
 * List all available integration types with their credential field definitions.
 * Used by the frontend to render generic integration cards without hardcoding each type.
 */
export async function listRegistry(_req: Request, res: Response): Promise<void> {
  res.status(200).json(listAdapters())
}

/**
 * GET /api/integrations
 * List the current user's connected integrations — status and sync metadata only.
 * Credentials are NEVER included in the response.
 */
export async function listUserIntegrations(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const records = (await pb
      .collection('integrations')
      .getFullList({ filter: `userId = "${req.user.id}"` })) as IntegrationRecord[]

    res.status(200).json(
      records.map((r) => ({
        type: r.type,
        connected: true,
        lastSyncAt: r.lastSyncAt,
        lastSyncStatus: r.lastSyncStatus,
        lastSyncMessage: r.lastSyncMessage,
        syncIntervalHours: typeof r.syncIntervalHours === 'number' ? r.syncIntervalHours : null,
      }))
    )
  } catch (err: unknown) {
    console.error('[Integrations] GET list failed:', err)
    res.status(500).json({ error: 'Failed to fetch integrations' })
  }
}

/**
 * POST /api/integrations/:type/connect
 * Save credentials for an integration. Credentials are encrypted server-side
 * before storage — they are never stored or logged in plaintext.
 */
export async function connectIntegration(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { type } = req.params
  const adapter = getAdapter(type)
  if (!adapter) {
    res.status(404).json({ error: `Unknown integration type: "${type}"` })
    return
  }

  const credentials = req.body as Record<string, string>
  const missing = adapter.credentialFields
    .filter((f) => f.required !== false)
    .map((f) => f.key)
    .filter((k) => !credentials[k]?.trim())

  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  try {
    const encryptedCredentials = encryptCredential(JSON.stringify(credentials))
    const existing = await getUserIntegration(req.user.id, type)

    if (existing) {
      await pb.collection('integrations').update(existing.id, { encryptedCredentials })
    } else {
      await pb.collection('integrations').create({
        userId: req.user.id,
        type,
        encryptedCredentials,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncMessage: null,
        syncIntervalHours: null,
      })
    }

    if (existing) {
      await rescheduleIntegration(existing.id)
    }

    res.status(200).json({ connected: true, type })
  } catch (err: unknown) {
    console.error(`[Integrations] POST connect/${type} failed:`, err)
    res.status(500).json({ error: 'Failed to save integration credentials' })
  }
}

/**
 * DELETE /api/integrations/:type
 * Remove a connected integration and permanently delete the stored credentials.
 */
export async function disconnectIntegration(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { type } = req.params

  try {
    const existing = await getUserIntegration(req.user.id, type)
    if (!existing) {
      res.status(404).json({ error: `No ${type} integration found` })
      return
    }

    unscheduleIntegration(existing.id)
    await pb.collection('integrations').delete(existing.id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error(`[Integrations] DELETE /${type} failed:`, err)
    res.status(500).json({ error: 'Failed to disconnect integration' })
  }
}

/**
 * POST /api/integrations/:type/sync
 * Trigger a sync for the given integration type.
 * Credentials are decrypted in memory only for the duration of the sync,
 * then the reference is cleared to aid garbage collection.
 */
export async function triggerSync(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { type } = req.params
  const adapter = getAdapter(type)
  if (!adapter) {
    res.status(404).json({ error: `Unknown integration type: "${type}"` })
    return
  }

  const record = await getUserIntegration(req.user.id, type)
  if (!record) {
    res.status(400).json({
      error: `${adapter.name} is not connected. Add your credentials first.`,
    })
    return
  }

  try {
    const result = await runIntegrationSync(record, adapter)
    res.status(200).json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    console.error(`[Integrations] Sync failed for ${type}:`, err)

    res.status(502).json({ error: message })
  }
}

/**
 * GET /api/integrations/:type/schedule
 * Returns the currently configured auto-sync interval.
 */
export async function getIntegrationSchedule(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { type } = req.params

  try {
    const existing = await getUserIntegration(req.user.id, type)
    if (!existing) {
      res.status(404).json({ error: `No ${type} integration found` })
      return
    }

    res.status(200).json({
      type,
      syncIntervalHours: typeof existing.syncIntervalHours === 'number' ? existing.syncIntervalHours : null,
    })
  } catch (err: unknown) {
    console.error(`[Integrations] GET schedule/${type} failed:`, err)
    res.status(500).json({ error: 'Failed to fetch integration schedule' })
  }
}

/**
 * PATCH /api/integrations/:type/schedule
 * Update auto-sync interval. Allowed values: null, 1, 6, 24.
 */
export async function updateIntegrationSchedule(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { type } = req.params
  const syncIntervalHours = (req.body as { syncIntervalHours?: number | null }).syncIntervalHours
  const normalized = syncIntervalHours === null || syncIntervalHours === undefined ? null : Number(syncIntervalHours)

  if (normalized !== null && !ALLOWED_SYNC_INTERVALS.has(normalized)) {
    res.status(400).json({ error: 'syncIntervalHours must be one of: null, 1, 6, 24' })
    return
  }

  try {
    const existing = await getUserIntegration(req.user.id, type)
    if (!existing) {
      res.status(404).json({ error: `No ${type} integration found` })
      return
    }

    await pb.collection('integrations').update(existing.id, { syncIntervalHours: normalized })
    await rescheduleIntegration(existing.id)

    res.status(200).json({
      type,
      syncIntervalHours: normalized,
    })
  } catch (err: unknown) {
    console.error(`[Integrations] PATCH schedule/${type} failed:`, err)
    res.status(500).json({ error: 'Failed to update integration schedule' })
  }
}

/**
 * GET /api/integrations/woocommerce/unknown-skus
 * Fetch all unknown SKUs from WooCommerce that have not been dismissed.
 */
export async function listUnknownSkus(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const items = await pb.collection('wcUnknownSkus').getFullList({ filter: 'dismissed = false', sort: '-seenAt' })
    res.status(200).json(items)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(200).json([])
      return
    }
    console.error('[WC] GET unknown-skus failed:', err)
    res.status(500).json({ error: 'Failed to fetch unknown SKUs' })
  }
}

/**
 * POST /api/integrations/woocommerce/unknown-skus/:id/dismiss
 * Mark an unknown SKU as dismissed.
 */
export async function dismissUnknownSku(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('wcUnknownSkus').update(id, { dismissed: true })
    res.status(200).json({ ok: true })
  } catch (err: unknown) {
    console.error('[WC] dismiss unknown-sku failed:', err)
    res.status(400).json({ error: 'Failed to dismiss' })
  }
}
