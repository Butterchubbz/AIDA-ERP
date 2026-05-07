import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

/**
 * GET /api/refurbished
 * List refurbished devices.
 */
export async function listRefurbished(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const items = await pb.collection('refurbishedDevices').getFullList()
    res.status(200).json(items)
  } catch (err: unknown) {
    console.error('[Refurbished] GET failed:', err)
    res.status(500).json({ error: 'Failed to fetch refurbished devices' })
  }
}

/**
 * POST /api/refurbished
 * Create a refurbished device entry.
 */
export async function createRefurbished(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const item = await pb.collection('refurbishedDevices').create(data)
    res.status(201).json(item)
  } catch (err: unknown) {
    console.error('[Refurbished] POST failed:', err)
    res.status(400).json({ error: 'Failed to create refurbished device' })
  }
}

/**
 * PATCH /api/refurbished/:id
 * Update a refurbished device entry.
 */
export async function updateRefurbished(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const item = await pb.collection('refurbishedDevices').update(id, data)
    res.status(200).json(item)
  } catch (err: unknown) {
    console.error('[Refurbished] PATCH failed:', err)
    res.status(400).json({ error: 'Failed to update refurbished device' })
  }
}

/**
 * DELETE /api/refurbished/:id
 * Delete a refurbished device entry.
 */
export async function deleteRefurbished(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('refurbishedDevices').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Refurbished] DELETE failed:', err)
    res.status(400).json({ error: 'Failed to delete refurbished device' })
  }
}

/**
 * GET /api/sales-data
 * List sales data records.
 */
export async function listSalesData(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const items = await pb.collection('salesData').getFullList()
    res.status(200).json(items)
  } catch (err: unknown) {
    console.error('[Sales] GET failed:', err)
    res.status(500).json({ error: 'Failed to fetch sales data' })
  }
}

/**
 * POST /api/sales-data/upsert
 * Upsert sales data records (create or update by key).
 */
export async function upsertSalesData(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { records } = req.body as { records: Array<Record<string, any>> }
    if (!Array.isArray(records)) {
      res.status(400).json({ error: 'Invalid records array' })
      return
    }

    const results = []
    for (const record of records) {
      // TODO: Implement actual upsert logic based on unique key
      // For now, just create
      const item = await pb.collection('salesData').create(record)
      results.push(item)
    }

    res.status(200).json(results)
  } catch (err: unknown) {
    console.error('[Sales] POST upsert failed:', err)
    res.status(400).json({ error: 'Failed to upsert sales data' })
  }
}

/**
 * GET /api/presets/:collectionId
 * List import presets for a collection.
 */
export async function listPresets(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { collectionId } = req.params
    const presets = await pb
      .collection('importPresets')
      .getFullList({ filter: `collectionId = "${collectionId}"` })
    res.status(200).json(presets)
  } catch (err: unknown) {
    console.error('[Presets] GET failed:', err)
    res.status(500).json({ error: 'Failed to fetch presets' })
  }
}

/**
 * POST /api/presets/:collectionId
 * Create an import preset.
 */
export async function createPreset(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { collectionId } = req.params
    const { name, mapping } = req.body
    const preset = await pb.collection('importPresets').create({
      collectionId,
      name,
      mapping,
    })
    res.status(201).json(preset)
  } catch (err: unknown) {
    console.error('[Presets] POST failed:', err)
    res.status(400).json({ error: 'Failed to create preset' })
  }
}

/**
 * DELETE /api/presets/:recordId
 * Delete an import preset.
 */
export async function deletePreset(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { recordId } = req.params
    await pb.collection('importPresets').delete(recordId)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Presets] DELETE failed:', err)
    res.status(400).json({ error: 'Failed to delete preset' })
  }
}
