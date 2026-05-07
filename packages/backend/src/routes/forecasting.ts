import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import type { VendorConfig } from '@aida/shared'

/**
 * GET /api/forecasting/vendor-configs
 * Fetch vendor configurations for the current user.
 */
export async function getVendorConfigs(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id

    // Try to fetch vendor configs for this user
    const prefs = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    const vendorConfigs = prefs?.vendorConfigs || {}

    res.status(200).json(vendorConfigs)
  } catch (err: unknown) {
    console.error('[Forecasting] GET vendor configs failed:', err)
    res.status(500).json({ error: 'Failed to fetch vendor configs' })
  }
}

/**
 * POST /api/forecasting/vendor-configs
 * Save vendor configurations.
 */
export async function saveVendorConfigs(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id
    const vendorConfigs = req.body as Record<string, VendorConfig>

    // Fetch existing or create new
    const existing = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    let record
    if (existing) {
      record = await pb.collection('userPreferences').update(existing.id, {
        vendorConfigs,
      })
    } else {
      record = await pb.collection('userPreferences').create({
        userId,
        vendorConfigs,
        velocityOverrides: {},
        skuVendorMap: {},
      })
    }

    res.status(200).json(record.vendorConfigs)
  } catch (err: unknown) {
    console.error('[Forecasting] POST vendor configs failed:', err)
    res.status(400).json({ error: 'Failed to save vendor configs' })
  }
}

/**
 * GET /api/forecasting
 * Calculate and return forecast data.
 * Query params:
 *   - mode: 'manual' | 'automatic' | 'combined'
 *   - window: '30' | '60' | '90'
 */
export async function getForecast(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const mode = (req.query.mode as string) || 'combined'
    const window = parseInt((req.query.window as string) || '30')

    // Fetch user preferences for velocity overrides
    const userId = req.user.id
    const prefs = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    const velocityOverrides = prefs?.velocityOverrides || {}

    // Fetch all necessary data
    // TODO: Use these in actual forecast calculation
    await pb.collection('deviceInventory').getFullList()
    await pb.collection('componentInventory').getFullList()
    await pb.collection('amazonInventory').getFullList().catch(() => [])
    prefs?.vendorConfigs || {}

    // TODO: Implement actual forecast calculation based on mode, window, velocity overrides
    // For now, return stub with the data fetched
    const forecastItems: any[] = []

    res.status(200).json({
      items: forecastItems,
      mode,
      window,
      velocityOverrides,
    })
  } catch (err: unknown) {
    console.error('[Forecasting] GET forecast failed:', err)
    res.status(500).json({ error: 'Failed to calculate forecast' })
  }
}
