import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import type { UserPreferences, UpdatePreferencesRequest } from '@aida/shared'

/**
 * GET /api/users/preferences
 * Fetch user preferences for the authenticated user.
 * Returns default empty preferences if user has no record.
 */
export async function getPreferences(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id

    // Try to fetch user preferences record
    const prefs = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    if (prefs) {
      const response: UserPreferences = {
        userId: prefs.userId,
        velocityOverrides: prefs.velocityOverrides || {},
        vendorConfigs: prefs.vendorConfigs || {},
        skuVendorMap: prefs.skuVendorMap || {},
      }
      res.status(200).json(response)
    } else {
      // Return default empty preferences
      const response: UserPreferences = {
        userId,
        velocityOverrides: {},
        vendorConfigs: {},
        skuVendorMap: {},
      }
      res.status(200).json(response)
    }
  } catch (err: unknown) {
    console.error('[Preferences] GET failed:', err)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
}

/**
 * PATCH /api/users/preferences
 * Update user preferences (partial update).
 * Creates the record if it doesn't exist.
 */
export async function updatePreferences(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id
    const patch = req.body as UpdatePreferencesRequest

    // Try to fetch existing record
    const existing = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    let record
    if (existing) {
      // Update existing
      record = await pb.collection('userPreferences').update(existing.id, {
        velocityOverrides: patch.velocityOverrides ?? existing.velocityOverrides,
        vendorConfigs: patch.vendorConfigs ?? existing.vendorConfigs,
        skuVendorMap: patch.skuVendorMap ?? existing.skuVendorMap,
      })
    } else {
      // Create new
      record = await pb.collection('userPreferences').create({
        userId,
        velocityOverrides: patch.velocityOverrides || {},
        vendorConfigs: patch.vendorConfigs || {},
        skuVendorMap: patch.skuVendorMap || {},
      })
    }

    const response: UserPreferences = {
      userId: record.userId,
      velocityOverrides: record.velocityOverrides || {},
      vendorConfigs: record.vendorConfigs || {},
      skuVendorMap: record.skuVendorMap || {},
    }

    res.status(200).json(response)
  } catch (err: unknown) {
    console.error('[Preferences] PATCH failed:', err)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
}
