import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import type { DeviceItem, ComponentItem } from '@aida/shared'

/**
 * GET /api/inventory/devices
 * Fetch all device inventory items for the user.
 */
export async function listDevices(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const items = await pb.collection('deviceInventory').getFullList<DeviceItem>()
    res.status(200).json(items)
  } catch (err: unknown) {
    console.error('[Inventory] GET devices failed:', err)
    res.status(500).json({ error: 'Failed to fetch devices' })
  }
}

/**
 * POST /api/inventory/devices
 * Create a new device inventory item.
 */
export async function createDevice(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const item = await pb.collection('deviceInventory').create<DeviceItem>(data)
    res.status(201).json(item)
  } catch (err: unknown) {
    console.error('[Inventory] POST device failed:', err)
    res.status(400).json({ error: 'Failed to create device' })
  }
}

/**
 * PATCH /api/inventory/devices/:id
 * Update an existing device inventory item.
 */
export async function updateDevice(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const item = await pb.collection('deviceInventory').update<DeviceItem>(id, data)
    res.status(200).json(item)
  } catch (err: unknown) {
    console.error('[Inventory] PATCH device failed:', err)
    res.status(400).json({ error: 'Failed to update device' })
  }
}

/**
 * DELETE /api/inventory/devices/:id
 * Delete a device inventory item.
 */
export async function deleteDevice(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('deviceInventory').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Inventory] DELETE device failed:', err)
    res.status(400).json({ error: 'Failed to delete device' })
  }
}

/**
 * GET /api/inventory/components
 * Fetch all component inventory items.
 */
export async function listComponents(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const items = await pb.collection('componentInventory').getFullList<ComponentItem>()
    res.status(200).json(items)
  } catch (err: unknown) {
    console.error('[Inventory] GET components failed:', err)
    res.status(500).json({ error: 'Failed to fetch components' })
  }
}

/**
 * POST /api/inventory/components
 * Create a new component inventory item.
 */
export async function createComponent(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const item = await pb.collection('componentInventory').create<ComponentItem>(data)
    res.status(201).json(item)
  } catch (err: unknown) {
    console.error('[Inventory] POST component failed:', err)
    res.status(400).json({ error: 'Failed to create component' })
  }
}

/**
 * PATCH /api/inventory/components/:id
 * Update an existing component inventory item.
 */
export async function updateComponent(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const item = await pb.collection('componentInventory').update<ComponentItem>(id, data)
    res.status(200).json(item)
  } catch (err: unknown) {
    console.error('[Inventory] PATCH component failed:', err)
    res.status(400).json({ error: 'Failed to update component' })
  }
}

/**
 * DELETE /api/inventory/components/:id
 * Delete a component inventory item.
 */
export async function deleteComponent(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('componentInventory').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Inventory] DELETE component failed:', err)
    res.status(400).json({ error: 'Failed to delete component' })
  }
}

/**
 * GET /api/inventory/devices/:itemId/history
 * Fetch event history for a device.
 */
export async function getDeviceHistory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { itemId } = req.params
    const events = await pb
      .collection('inventoryEvents')
      .getFullList({ filter: `deviceId = "${itemId}"`, sort: '-created' })
    res.status(200).json(events)
  } catch (err: unknown) {
    console.error('[Inventory] GET device history failed:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
}

/**
 * GET /api/inventory/search?q=...
 * Search for SKUs across devices and components.
 */
export async function searchInventory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const q = req.query.q as string
    if (!q) {
      res.status(400).json({ error: 'Missing search query' })
      return
    }

    // Search both collections for SKU match
    const devices = await pb
      .collection('deviceInventory')
      .getFullList({ filter: `sku ~ "${q}" || description ~ "${q}"` })

    const components = await pb
      .collection('componentInventory')
      .getFullList({ filter: `sku ~ "${q}" || description ~ "${q}"` })

    res.status(200).json({ devices, components })
  } catch (err: unknown) {
    console.error('[Inventory] Search failed:', err)
    res.status(500).json({ error: 'Search failed' })
  }
}

/**
 * PATCH /api/inventory/devices/batch
 * Batch update multiple devices.
 */
export async function batchUpdateDevices(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { updates } = req.body as { updates: Array<{ id: string; data: Record<string, any> }> }
    if (!Array.isArray(updates)) {
      res.status(400).json({ error: 'Invalid updates array' })
      return
    }

    const results = []
    for (const { id, data } of updates) {
      const item = await pb.collection('deviceInventory').update(id, data)
      results.push(item)
    }

    res.status(200).json(results)
  } catch (err: unknown) {
    console.error('[Inventory] Batch update failed:', err)
    res.status(400).json({ error: 'Batch update failed' })
  }
}
