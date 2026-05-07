import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import { parseCSV } from '../lib/csvParser.js'

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

/**
 * POST /api/data/import
 * Import sales data from a CSV body.
 *
 * Request body (JSON): { csv: string }
 * Expected CSV columns: sku, quantity, saleDate (optional), salePrice (optional)
 *
 * Validates each row's SKU against deviceInventory.
 * Creates a salesData record per valid row with source='manual_csv'.
 * Returns { recordsImported, errors } — partial success is allowed.
 */
export async function importSalesDataCSV(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { csv } = req.body as { csv?: unknown }

  if (typeof csv !== 'string' || !csv.trim()) {
    res.status(400).json({ error: 'Request body must include a non-empty "csv" string field' })
    return
  }

  const { rows, errors } = parseCSV(csv)

  if (rows.length === 0) {
    res.status(400).json({
      error: 'No valid rows parsed from CSV',
      recordsImported: 0,
      errors,
    })
    return
  }

  // Validate SKUs exist in deviceInventory
  let knownSkus: Set<string>
  try {
    const devices = await pb.collection('deviceInventory').getFullList({ fields: 'sku' })
    knownSkus = new Set(devices.map((d) => (d as unknown as { sku: string }).sku))
  } catch (err: unknown) {
    console.error('[CSV Import] Failed to fetch device SKUs:', err)
    res.status(500).json({ error: 'Failed to validate SKUs against inventory' })
    return
  }

  let recordsImported = 0
  const importErrors = [...errors]

  for (const row of rows) {
    if (!knownSkus.has(row.sku)) {
      importErrors.push({ row: 0, message: `Unknown SKU: "${row.sku}" — not found in device inventory` })
      continue
    }

    try {
      await pb.collection('salesData').create({
        sku: row.sku,
        quantity: row.quantity,
        saleDate: row.saleDate ?? new Date().toISOString(),
        salePrice: row.salePrice ?? 0,
        source: 'manual_csv',
        userId: req.user.id,
      })
      recordsImported++
    } catch (err: unknown) {
      console.error(`[CSV Import] Failed to create salesData record for SKU "${row.sku}":`, err)
      importErrors.push({ row: 0, message: `Failed to save record for SKU "${row.sku}"` })
    }
  }

  res.status(200).json({ recordsImported, errors: importErrors })
}
