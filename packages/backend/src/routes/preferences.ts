import { z } from 'zod'
import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import type { UserPreferences } from '@aida/shared'

const printerSettingsSchema = z.object({
  defaultLabelSize: z.string().trim().min(1).max(80),
  unit: z.enum(['mm', 'inch']),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  showSku: z.boolean(),
  showName: z.boolean(),
  showLocation: z.boolean(),
  showWorkspace: z.boolean(),
})

const scannerSettingsSchema = z.object({
  preferredCameraId: z.string().trim().max(255).optional(),
  autoStart: z.boolean(),
  beepOnSuccess: z.boolean(),
})

const updatePreferencesSchema = z.object({
  velocityOverrides: z.record(z.enum(['sales', 'inventory'])).optional(),
  vendorConfigs: z.record(z.any()).optional(),
  skuVendorMap: z.record(z.array(z.string())).optional(),
  printerSettings: printerSettingsSchema.optional(),
  scannerSettings: scannerSettingsSchema.optional(),
  encryptedWoocommerceKey: z.string().max(2048).optional(),
})

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
      .getFirstListItem(pb.filter('userId = {:userId}', { userId }))
      .catch(() => null)

    if (prefs) {
      const response: UserPreferences = {
        userId: prefs.userId,
        velocityOverrides: prefs.velocityOverrides || {},
        vendorConfigs: prefs.vendorConfigs || {},
        skuVendorMap: prefs.skuVendorMap || {},
        ...(prefs.printerSettings ? { printerSettings: prefs.printerSettings } : {}),
        ...(prefs.scannerSettings ? { scannerSettings: prefs.scannerSettings } : {}),
        ...(prefs.encryptedWoocommerceKey
          ? { encryptedWoocommerceKey: prefs.encryptedWoocommerceKey }
          : {}),
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
    const parsed = updatePreferencesSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid preference payload',
        detail: parsed.error.issues.map(issue => ({
          path: issue.path.join('.') || 'root',
          message: issue.message,
        })),
      })
      return
    }

    const patch = parsed.data

    // Try to fetch existing record
    const existing = await pb
      .collection('userPreferences')
      .getFirstListItem(pb.filter('userId = {:userId}', { userId }))
      .catch(() => null)

    let record
    if (existing) {
      // Update existing
      record = await pb.collection('userPreferences').update(existing.id, {
        velocityOverrides: patch.velocityOverrides ?? existing.velocityOverrides,
        vendorConfigs: patch.vendorConfigs ?? existing.vendorConfigs,
        skuVendorMap: patch.skuVendorMap ?? existing.skuVendorMap,
        ...(patch.printerSettings !== undefined ? { printerSettings: patch.printerSettings } : {}),
        ...(patch.scannerSettings !== undefined ? { scannerSettings: patch.scannerSettings } : {}),
        ...(patch.encryptedWoocommerceKey !== undefined
          ? { encryptedWoocommerceKey: patch.encryptedWoocommerceKey }
          : {}),
      })
    } else {
      // Create new
      record = await pb.collection('userPreferences').create({
        userId,
        velocityOverrides: patch.velocityOverrides || {},
        vendorConfigs: patch.vendorConfigs || {},
        skuVendorMap: patch.skuVendorMap || {},
        ...(patch.printerSettings !== undefined ? { printerSettings: patch.printerSettings } : {}),
        ...(patch.scannerSettings !== undefined ? { scannerSettings: patch.scannerSettings } : {}),
        ...(patch.encryptedWoocommerceKey !== undefined
          ? { encryptedWoocommerceKey: patch.encryptedWoocommerceKey }
          : {}),
      })
    }

    const response: UserPreferences = {
      userId: record.userId,
      velocityOverrides: record.velocityOverrides || {},
      vendorConfigs: record.vendorConfigs || {},
      skuVendorMap: record.skuVendorMap || {},
      ...(record.printerSettings ? { printerSettings: record.printerSettings } : {}),
      ...(record.scannerSettings ? { scannerSettings: record.scannerSettings } : {}),
      ...(record.encryptedWoocommerceKey
        ? { encryptedWoocommerceKey: record.encryptedWoocommerceKey }
        : {}),
    }

    res.status(200).json(response)
  } catch (err: unknown) {
    console.error('[Preferences] PATCH failed:', err)
    res.status(500).json({ error: 'Failed to update preferences', detail: 'Unexpected server error while saving preferences.' })
  }
}
