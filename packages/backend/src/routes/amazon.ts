import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

/**
 * GET /api/amazon/pos
 * List all Amazon purchase orders.
 */
export async function listAmazonPOs(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const pos = await pb.collection('amazonPOs').getFullList()
    res.status(200).json(pos)
  } catch (err: unknown) {
    console.error('[Amazon] GET POs failed:', err)
    res.status(500).json({ error: 'Failed to fetch Amazon POs' })
  }
}

/**
 * POST /api/amazon/pos
 * Create a new Amazon purchase order.
 */
export async function createAmazonPO(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const po = await pb.collection('amazonPOs').create(data)
    res.status(201).json(po)
  } catch (err: unknown) {
    console.error('[Amazon] POST PO failed:', err)
    res.status(400).json({ error: 'Failed to create Amazon PO' })
  }
}

/**
 * PATCH /api/amazon/pos/:id
 * Update an Amazon purchase order.
 */
export async function updateAmazonPO(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const po = await pb.collection('amazonPOs').update(id, data)
    res.status(200).json(po)
  } catch (err: unknown) {
    console.error('[Amazon] PATCH PO failed:', err)
    res.status(400).json({ error: 'Failed to update Amazon PO' })
  }
}

/**
 * DELETE /api/amazon/pos/:id
 * Delete an Amazon purchase order.
 */
export async function deleteAmazonPO(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('amazonPOs').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Amazon] DELETE PO failed:', err)
    res.status(400).json({ error: 'Failed to delete Amazon PO' })
  }
}

/**
 * GET /api/amazon/inventory
 * List Amazon FBA inventory.
 */
export async function listAmazonInventory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const inventory = await pb.collection('amazonInventory').getFullList()
    res.status(200).json(inventory)
  } catch (err: unknown) {
    console.error('[Amazon] GET inventory failed:', err)
    res.status(500).json({ error: 'Failed to fetch Amazon inventory' })
  }
}

/**
 * POST /api/amazon/sync
 * Synchronize Amazon inventory with PocketBase.
 * TODO: Implement actual sync logic with Amazon SP-API.
 */
export async function syncAmazonInventory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    // TODO: Call Amazon SP-API to fetch current inventory
    // TODO: Update amazonInventory collection
    // For now, return stub
    res.status(200).json({ message: 'Sync initiated' })
  } catch (err: unknown) {
    console.error('[Amazon] POST sync failed:', err)
    res.status(400).json({ error: 'Failed to sync Amazon inventory' })
  }
}
