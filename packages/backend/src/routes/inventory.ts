import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import type { DeviceItem, ComponentItem, AccessoryItem } from '@aida/shared'

function compareInventorySku(a: Pick<DeviceItem, 'sku' | 'created' | 'id'>, b: Pick<DeviceItem, 'sku' | 'created' | 'id'>): number {
  const normalizedSkuCompare = a.sku.trim().toLowerCase().localeCompare(b.sku.trim().toLowerCase())
  if (normalizedSkuCompare !== 0) {
    return normalizedSkuCompare
  }

  const rawSkuCompare = a.sku.localeCompare(b.sku)
  if (rawSkuCompare !== 0) {
    return rawSkuCompare
  }

  const createdCompare = (a.created ?? '').localeCompare(b.created ?? '')
  if (createdCompare !== 0) {
    return createdCompare
  }

  return a.id.localeCompare(b.id)
}

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
    const items = await pb.collection('inventoryDevice').getFullList<DeviceItem>()
    res.status(200).json([...items].sort(compareInventorySku))
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
    const item = await pb.collection('inventoryDevice').create<DeviceItem>(data)
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
    const item = await pb.collection('inventoryDevice').update<DeviceItem>(id, data)
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
    await pb.collection('inventoryDevice').delete(id)
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
    const items = await pb.collection('inventoryComponent').getFullList<ComponentItem>()
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
    const item = await pb.collection('inventoryComponent').create<ComponentItem>(data)
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
    const item = await pb.collection('inventoryComponent').update<ComponentItem>(id, data)
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
    await pb.collection('inventoryComponent').delete(id)
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
      .collection('stockHistory')
      .getFullList({ filter: `deviceId = "${itemId}"`, sort: '-created' })
    res.status(200).json(events)
  } catch (err: unknown) {
    console.error('[Inventory] GET device history failed:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
}

/**
 * GET /api/inventory/search?q=...
 * Search for SKUs across devices, components, and accessories.
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

    // Search all three collections for SKU match
    const devices = await pb
      .collection('inventoryDevice')
      .getFullList({ filter: `sku ~ "${q}" || description ~ "${q}"` })

    const components = await pb
      .collection('inventoryComponent')
      .getFullList({ filter: `sku ~ "${q}" || description ~ "${q}"` })

    const accessories = await pb
      .collection('inventoryAccessory')
      .getFullList({ filter: `sku ~ "${q}" || description ~ "${q}"` })

    res.status(200).json({ devices, components, accessories })
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
      const item = await pb.collection('inventoryDevice').update(id, data)
      results.push(item)
    }

    res.status(200).json(results)
  } catch (err: unknown) {
    console.error('[Inventory] Batch update failed:', err)
    res.status(400).json({ error: 'Batch update failed' })
  }
}

/**
 * GET /api/inventory/accessories
 * Fetch all accessory inventory items for the user.
 */
export async function listAccessories(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const items = await pb.collection('inventoryAccessory').getFullList<AccessoryItem>()
    res.status(200).json([...items].sort(compareInventorySku))
  } catch (err: unknown) {
    console.error('[Inventory] GET accessories failed:', err)
    res.status(500).json({ error: 'Failed to fetch accessories' })
  }
}

/**
 * POST /api/inventory/accessories
 * Create a new accessory inventory item.
 */
export async function createAccessory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const item = await pb.collection('inventoryAccessory').create<AccessoryItem>(data)
    res.status(201).json(item)
  } catch (err: unknown) {
    console.error('[Inventory] POST accessory failed:', err)
    res.status(400).json({ error: 'Failed to create accessory' })
  }
}

/**
 * PATCH /api/inventory/accessories/:id
 * Update an existing accessory inventory item.
 */
export async function updateAccessory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const item = await pb.collection('inventoryAccessory').update<AccessoryItem>(id, data)
    res.status(200).json(item)
  } catch (err: unknown) {
    console.error('[Inventory] PATCH accessory failed:', err)
    res.status(400).json({ error: 'Failed to update accessory' })
  }
}

/**
 * DELETE /api/inventory/accessories/:id
 * Delete an accessory inventory item.
 */
export async function deleteAccessory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('inventoryAccessory').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Inventory] DELETE accessory failed:', err)
    res.status(400).json({ error: 'Failed to delete accessory' })
  }
}

/**
 * PATCH /api/inventory/accessories/batch
 * Batch update multiple accessories.
 */
export async function batchUpdateAccessories(req: Request, res: Response): Promise<void> {
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
      const item = await pb.collection('inventoryAccessory').update(id, data)
      results.push(item)
    }

    res.status(200).json(results)
  } catch (err: unknown) {
    console.error('[Inventory] Batch update accessories failed:', err)
    res.status(400).json({ error: 'Batch update failed' })
  }
}

/**
 * GET /api/inventory/accessories/:itemId/history
 * Fetch event history for an accessory.
 */
export async function getAccessoryHistory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { itemId } = req.params
    const events = await pb
      .collection('stockHistory')
      .getFullList({ filter: `inventoryItemId = "${itemId}"`, sort: '-created' })
    res.status(200).json(events)
  } catch (err: unknown) {
    console.error('[Inventory] GET accessory history failed:', err)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
}

/**
 * POST /api/inventory/sku/move
 * Move a SKU from one inventory section to another.
 * Only Admins and Managers can perform this operation.
 */
export async function moveSkuToSection(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Check if user has Editor role for Inventory
  const userRole = req.user.role as string
  if (userRole !== 'Admin' && userRole !== 'Manager') {
    res.status(403).json({ error: 'Only Admins and Managers can move SKUs' })
    return
  }

  try {
    const { fromCollection, toCollection, itemId, sku } = req.body as {
      fromCollection: 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory'
      toCollection: 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory'
      itemId: string
      sku: string
    }

    if (!fromCollection || !toCollection || !itemId || !sku) {
      res.status(400).json({ error: 'Missing required fields: fromCollection, toCollection, itemId, sku' })
      return
    }

    if (fromCollection === toCollection) {
      res.status(400).json({ error: 'Source and target collections cannot be the same' })
      return
    }

    // Validate collection names
    const validCollections = ['inventoryDevice', 'inventoryComponent', 'inventoryAccessory']
    if (!validCollections.includes(fromCollection) || !validCollections.includes(toCollection)) {
      res.status(400).json({ error: 'Invalid collection names' })
      return
    }

    // Get the item from source collection
    const sourceItem = await pb.collection(fromCollection).getOne(itemId)
    if (!sourceItem) {
      res.status(404).json({ error: 'Item not found in source collection' })
      return
    }

    // Check if SKU already exists in target collection
    const existingInTarget = await pb
      .collection(toCollection)
      .getFullList({ filter: `sku = "${sku}"`, limit: 1 })

    if (existingInTarget.length > 0) {
      res.status(409).json({
        error: 'SKU already exists in target collection',
        detail: `SKU "${sku}" already exists in ${toCollection}`,
      })
      return
    }

    // Create the item in target collection with the same data
    // Remove the id field since PocketBase will generate a new one
    const { id: _, created: __, updated: ___, ...itemDataForTarget } = sourceItem

    const movedItem = await pb.collection(toCollection).create(itemDataForTarget)

    // Delete from source collection
    await pb.collection(fromCollection).delete(itemId)

    // Log the move in stockHistory if the item has an inventoryItemId
    try {
      await pb.collection('stockHistory').create({
        inventoryItemId: movedItem.id,
        operation: 'sku_reassignment',
        quantity: 0,
        notes: `SKU moved from ${fromCollection} to ${toCollection}`,
        timestamp: new Date().toISOString(),
      })
    } catch (err: unknown) {
      console.warn('[Inventory] Failed to log SKU move to stockHistory:', err)
      // Don't fail the operation if logging fails
    }

    res.status(200).json({
      message: 'SKU moved successfully',
      movedItem,
      fromCollection,
      toCollection,
    })
  } catch (err: unknown) {
    console.error('[Inventory] Move SKU failed:', err)
    res.status(400).json({ error: 'Failed to move SKU' })
  }
}
