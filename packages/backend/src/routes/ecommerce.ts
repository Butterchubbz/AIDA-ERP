import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import { decryptWoocommerceKey } from '../lib/decryption.js'

/**
 * POST /api/ecommerce/sync
 *
 * Triggers a WooCommerce sync for the authenticated user.
 * Flow:
 *   1. Fetch encrypted WooCommerce key from userPreferences
 *   2. Decrypt using VITE_ENCRYPTION_KEY (never stored or logged)
 *   3. Create an ecommerceSyncLog record with decryptedKeyTemp in the data
 *   4. PocketBase hook (ecommerce.pb.js) processes the sync and strips the key before persisting
 *   5. Return sync result from the log record
 *
 * Requires: authenticated user with encryptedWoocommerceKey saved in preferences.
 */
export async function triggerEcommerceSync(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const encryptionKey = process.env.VITE_ENCRYPTION_KEY
  if (!encryptionKey) {
    console.error('[Ecommerce] VITE_ENCRYPTION_KEY not set in environment')
    res.status(500).json({ error: 'Server encryption configuration is missing' })
    return
  }

  const storeUrl = process.env.WC_STORE_URL
  if (!storeUrl) {
    res.status(400).json({ error: 'WC_STORE_URL is not configured on the server' })
    return
  }

  // 1. Fetch user preferences to get the encrypted credential blob
  let encryptedBlob: string | undefined
  try {
    const prefs = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${req.user.id}"`)
      .catch(() => null)

    encryptedBlob = prefs?.encryptedWoocommerceKey
  } catch (err: unknown) {
    console.error('[Ecommerce] Failed to fetch user preferences:', err)
    res.status(500).json({ error: 'Failed to retrieve integration settings' })
    return
  }

  if (!encryptedBlob) {
    res.status(400).json({ error: 'No WooCommerce credentials saved. Configure them in Integration Settings first.' })
    return
  }

  // 2. Decrypt — throws if key is wrong or blob is tampered
  let decryptedKey: string
  try {
    decryptedKey = decryptWoocommerceKey(encryptedBlob, encryptionKey)
  } catch (err: unknown) {
    console.error('[Ecommerce] Decryption failed:', err)
    res.status(500).json({ error: 'Failed to decrypt WooCommerce credentials' })
    return
  }

  // 3. Create ecommerceSyncLog record — PB hook processes the sync synchronously
  //    and strips decryptedKeyTemp before the record is persisted.
  let syncLog: { status: string; recordsImported: number; errorMessage: string }
  try {
    syncLog = (await pb.collection('ecommerceSyncLog').create({
      userId: req.user.id,
      storeUrl,
      decryptedKeyTemp: decryptedKey,  // consumed + cleared by ecommerce.pb.js hook
      status: 'syncing',
      recordsImported: 0,
      errorMessage: '',
    })) as unknown as { status: string; recordsImported: number; errorMessage: string }
  } catch (err: unknown) {
    console.error('[Ecommerce] Failed to create sync log:', err)
    res.status(500).json({ error: 'Failed to initiate WooCommerce sync' })
    return
  } finally {
    // Ensure decryptedKey is garbage-collected ASAP
    // (TypeScript doesn't guarantee GC timing but this signals intent)
    decryptedKey = ''
  }

  // 4. Return result from the hook-processed log record
  if (syncLog.status === 'error') {
    res.status(502).json({
      error: 'WooCommerce sync failed',
      details: syncLog.errorMessage,
      recordsImported: 0,
    })
    return
  }

  res.status(200).json({
    status: 'success',
    recordsImported: syncLog.recordsImported,
  })
}
