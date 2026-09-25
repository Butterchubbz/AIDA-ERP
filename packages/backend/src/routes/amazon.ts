import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

// ---------------------------------------------------------------------------
// Internal record shapes returned by PocketBase
// ---------------------------------------------------------------------------
interface DeviceRecord {
  id: string
  name: string
  inventorySku: string
  inventoryId?: string
  updatedAt?: string
}

interface VariantRecord {
  id: string
  deviceId: string
  label: string
  sku: string
  asin?: string
  packSize: number
  fbaStock: number
  lowStockThreshold?: number
}

interface PORecord {
  id: string
  status: string
  movedToOutgoing?: boolean
  items: Array<{ sku: string; name: string; quantity: number }>
}

interface StockHistoryRecord {
  id: string
  variantId: string
  timestamp: string
  oldValue: number
  newValue: number
  reason?: string
  changedBy?: string
}

// ---------------------------------------------------------------------------
// GET /api/amazon/devices
// Returns all devices with variants embedded + inbound qty computed from POs.
// ---------------------------------------------------------------------------
export async function listAmazonDevices(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const [devices, variants, pos] = await Promise.all([
      pb.collection('amazonDevices').getFullList() as Promise<DeviceRecord[]>,
      pb.collection('amazonVariants').getFullList() as Promise<VariantRecord[]>,
      pb.collection('amazonPOs').getFullList().catch(() => []) as Promise<PORecord[]>,
    ])

    // Compute inbound per variant SKU from Shipped/Delivered POs that moved to outgoing
    const inboundByVariantSku = new Map<string, number>()
    for (const po of pos) {
      if ((po.status === 'Shipped' || po.status === 'Delivered') && po.movedToOutgoing === true) {
        for (const item of po.items ?? []) {
          inboundByVariantSku.set(item.sku, (inboundByVariantSku.get(item.sku) ?? 0) + item.quantity)
        }
      }
    }

    // Group variants by deviceId
    const variantsByDevice = new Map<string, VariantRecord[]>()
    for (const v of variants) {
      const list = variantsByDevice.get(v.deviceId) ?? []
      list.push(v)
      variantsByDevice.set(v.deviceId, list)
    }

    const result = devices.map((device) => ({
      ...device,
      variants: (variantsByDevice.get(device.id) ?? []).map((v) => ({
        ...v,
        inboundQty: inboundByVariantSku.get(v.sku) ?? 0,
      })),
    }))

    res.json(result)
  } catch (err: unknown) {
    console.error('[Amazon] GET devices failed:', err)
    res.status(500).json({ error: 'Failed to fetch Amazon devices' })
  }
}

// ---------------------------------------------------------------------------
// POST /api/amazon/devices
// ---------------------------------------------------------------------------
export async function createAmazonDevice(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { name, inventorySku, inventoryId } = req.body as Record<string, string>
  if (!name?.trim() || !inventorySku?.trim()) {
    res.status(400).json({ error: 'name and inventorySku are required' })
    return
  }

  try {
    const device = await pb.collection('amazonDevices').create({
      name: name.trim(),
      inventorySku: inventorySku.trim(),
      inventoryId: inventoryId?.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    res.status(201).json(device)
  } catch (err: unknown) {
    console.error('[Amazon] POST device failed:', err)
    res.status(400).json({ error: 'Failed to create Amazon device' })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/amazon/devices/:id
// ---------------------------------------------------------------------------
export async function updateAmazonDevice(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params
  const { name, inventorySku, inventoryId } = req.body as Record<string, string | undefined>

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name.trim()
  if (inventorySku !== undefined) patch.inventorySku = inventorySku.trim()
  if (inventoryId !== undefined) patch.inventoryId = inventoryId?.trim() || null

  try {
    const device = await pb.collection('amazonDevices').update(id, patch)
    res.json(device)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(404).json({ error: 'Device not found' })
      return
    }
    console.error('[Amazon] PATCH device failed:', err)
    res.status(400).json({ error: 'Failed to update Amazon device' })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/amazon/devices/:id
// Cascade-deletes all variants and their stock history.
// ---------------------------------------------------------------------------
export async function deleteAmazonDevice(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params

  try {
    const variants = await pb
      .collection('amazonVariants')
      .getFullList({ filter: pb.filter('deviceId = {:deviceId}', { deviceId: id }) }) as VariantRecord[]

    for (const variant of variants) {
      const history = await pb
        .collection('amazonStockHistory')
        .getFullList({ filter: pb.filter('variantId = {:variantId}', { variantId: variant.id }) })
        .catch(() => [])
      await Promise.all(history.map((h) => pb.collection('amazonStockHistory').delete(h.id).catch(() => null)))
      await pb.collection('amazonVariants').delete(variant.id)
    }

    await pb.collection('amazonDevices').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(404).json({ error: 'Device not found' })
      return
    }
    console.error('[Amazon] DELETE device failed:', err)
    res.status(500).json({ error: 'Failed to delete Amazon device' })
  }
}

// ---------------------------------------------------------------------------
// GET /api/amazon/devices/:id/history
// Returns stock history for all variants of a device, newest first.
// ---------------------------------------------------------------------------
export async function getAmazonDeviceHistory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params

  try {
    const variants = await pb
      .collection('amazonVariants')
      .getFullList({ filter: pb.filter('deviceId = {:deviceId}', { deviceId: id }) }) as VariantRecord[]

    if (variants.length === 0) {
      res.json([])
      return
    }

    const variantParams = Object.fromEntries(
      variants.map((variant, index) => [`variantId${index}`, variant.id])
    )
    const history = await pb
      .collection('amazonStockHistory')
      .getFullList({
        filter: pb.filter(
          variants.map((_variant, index) => `variantId = {:variantId${index}}`).join(' || '),
          variantParams
        ),
        sort: '-timestamp',
      })
      .catch(() => []) as StockHistoryRecord[]

    // Attach variant label + sku for display
    const variantMap = new Map(variants.map((v) => [v.id, v]))
    const enriched = history.map((h) => {
      const variant = variantMap.get(h.variantId)
      return {
        ...h,
        variantLabel: variant?.label ?? '',
        variantSku: variant?.sku ?? '',
      }
    })

    res.json(enriched)
  } catch (err: unknown) {
    console.error('[Amazon] GET device history failed:', err)
    res.status(500).json({ error: 'Failed to fetch device history' })
  }
}

// ---------------------------------------------------------------------------
// POST /api/amazon/devices/:id/variants
// ---------------------------------------------------------------------------
export async function addAmazonVariant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id: deviceId } = req.params
  const { label, sku, asin, packSize, lowStockThreshold } = req.body as {
    label?: string
    sku?: string
    asin?: string
    packSize?: number
    lowStockThreshold?: number
  }

  if (!label?.trim() || !sku?.trim()) {
    res.status(400).json({ error: 'label and sku are required' })
    return
  }

  try {
    // Verify device exists
    await pb.collection('amazonDevices').getOne(deviceId)

    const variant = await pb.collection('amazonVariants').create({
      deviceId,
      label: label.trim(),
      sku: sku.trim(),
      asin: asin?.trim() || null,
      packSize: packSize ?? 1,
      fbaStock: 0,
      lowStockThreshold: lowStockThreshold ?? 10,
    })
    res.status(201).json(variant)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(404).json({ error: 'Device not found' })
      return
    }
    console.error('[Amazon] POST variant failed:', err)
    res.status(400).json({ error: 'Failed to create Amazon variant' })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/amazon/variants/:id
// Updates variant metadata (not stock — use /stock for that).
// ---------------------------------------------------------------------------
export async function updateAmazonVariant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params
  const { label, sku, asin, packSize, lowStockThreshold } = req.body as {
    label?: string
    sku?: string
    asin?: string
    packSize?: number
    lowStockThreshold?: number
  }

  const patch: Record<string, unknown> = {}
  if (label !== undefined) patch.label = label.trim()
  if (sku !== undefined) patch.sku = sku.trim()
  if (asin !== undefined) patch.asin = asin?.trim() || null
  if (packSize !== undefined) patch.packSize = packSize
  if (lowStockThreshold !== undefined) patch.lowStockThreshold = lowStockThreshold

  try {
    const variant = await pb.collection('amazonVariants').update(id, patch)
    res.json(variant)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(404).json({ error: 'Variant not found' })
      return
    }
    console.error('[Amazon] PATCH variant failed:', err)
    res.status(400).json({ error: 'Failed to update Amazon variant' })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/amazon/variants/:id
// ---------------------------------------------------------------------------
export async function deleteAmazonVariant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params

  try {
    const history = await pb
      .collection('amazonStockHistory')
      .getFullList({ filter: pb.filter('variantId = {:variantId}', { variantId: id }) })
      .catch(() => [])
    await Promise.all(history.map((h) => pb.collection('amazonStockHistory').delete(h.id).catch(() => null)))

    await pb.collection('amazonVariants').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(404).json({ error: 'Variant not found' })
      return
    }
    console.error('[Amazon] DELETE variant failed:', err)
    res.status(500).json({ error: 'Failed to delete Amazon variant' })
  }
}

// ---------------------------------------------------------------------------
// POST /api/amazon/variants/:id/stock
// Manual stock adjustment. Writes a history record.
// Body: { fbaStock: number, reason?: string }
// ---------------------------------------------------------------------------
export async function adjustAmazonVariantStock(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params
  const { fbaStock, reason } = req.body as { fbaStock: unknown; reason?: string }

  if (typeof fbaStock !== 'number' || !isFinite(fbaStock) || fbaStock < 0) {
    res.status(400).json({ error: 'fbaStock must be a non-negative number' })
    return
  }

  const newStock = Math.floor(fbaStock)

  try {
    const variant = await pb.collection('amazonVariants').getOne(id) as VariantRecord
    const oldValue = variant.fbaStock ?? 0

    const [updated] = await Promise.all([
      pb.collection('amazonVariants').update(id, { fbaStock: newStock }),
      pb.collection('amazonStockHistory').create({
        variantId: id,
        timestamp: new Date().toISOString(),
        oldValue,
        newValue: newStock,
        reason: reason?.trim() || null,
        changedBy: req.user.email,
      }),
      pb.collection('amazonDevices').update(variant.deviceId, {
        updatedAt: new Date().toISOString(),
      }).catch(() => null),
    ])

    res.json(updated)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 404) {
      res.status(404).json({ error: 'Variant not found' })
      return
    }
    console.error('[Amazon] POST variant stock failed:', err)
    res.status(500).json({ error: 'Failed to adjust stock' })
  }
}

// ---------------------------------------------------------------------------
// GET /api/amazon/variants/:id/history
// ---------------------------------------------------------------------------
export async function getAmazonVariantHistory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params

  try {
    const history = await pb
      .collection('amazonStockHistory')
      .getFullList({
        filter: pb.filter('variantId = {:variantId}', { variantId: id }),
        sort: '-timestamp',
      }) as StockHistoryRecord[]
    res.json(history)
  } catch (err: unknown) {
    console.error('[Amazon] GET variant history failed:', err)
    res.status(500).json({ error: 'Failed to fetch variant history' })
  }
}

// ---------------------------------------------------------------------------
// Legacy routes — kept for Amazon PO module compatibility
// ---------------------------------------------------------------------------
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

export async function createAmazonPO(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const po = await pb.collection('amazonPOs').create(req.body)
    res.status(201).json(po)
  } catch (err: unknown) {
    console.error('[Amazon] POST PO failed:', err)
    res.status(400).json({ error: 'Failed to create Amazon PO' })
  }
}

export async function updateAmazonPO(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const po = await pb.collection('amazonPOs').update(req.params.id, req.body)
    res.status(200).json(po)
  } catch (err: unknown) {
    console.error('[Amazon] PATCH PO failed:', err)
    res.status(400).json({ error: 'Failed to update Amazon PO' })
  }
}

export async function deleteAmazonPO(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    await pb.collection('amazonPOs').delete(req.params.id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Amazon] DELETE PO failed:', err)
    res.status(400).json({ error: 'Failed to delete Amazon PO' })
  }
}

export async function listAmazonInventory(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const inventory = await pb.collection('inventoryDevice').getFullList()
    res.status(200).json(inventory)
  } catch (err: unknown) {
    console.error('[Amazon] GET inventory failed:', err)
    res.status(500).json({ error: 'Failed to fetch Amazon inventory' })
  }
}

export async function syncAmazonInventory(_req: Request, res: Response): Promise<void> {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Amazon SP-API sync is not yet implemented. Use manual stock adjustment.',
  })
}
