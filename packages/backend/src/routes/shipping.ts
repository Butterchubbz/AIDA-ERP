import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import pb from '../lib/pocketbase.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireModule } from '../middleware/authorize.js'

const router = Router()

function getPrimarySku(record: Record<string, unknown>): string {
  const direct = typeof record?.sku === 'string' ? record.sku : ''
  if (direct.trim()) return direct.trim()

  const items = Array.isArray(record?.itemsShipped) ? record.itemsShipped : []
  for (const item of items) {
    if (item && typeof item === 'object' && typeof (item as any).sku === 'string' && (item as any).sku.trim()) {
      return String((item as any).sku).trim()
    }
  }

  return ''
}

function sortBySku<T extends { sku?: string; created?: string; id?: string; itemsShipped?: unknown[] }>(left: T, right: T): number {
  const leftSku = getPrimarySku(left as Record<string, unknown>).trim().toLowerCase()
  const rightSku = getPrimarySku(right as Record<string, unknown>).trim().toLowerCase()

  if (leftSku !== rightSku) return leftSku.localeCompare(rightSku)

  const leftRaw = getPrimarySku(left as Record<string, unknown>).trim()
  const rightRaw = getPrimarySku(right as Record<string, unknown>).trim()
  if (leftRaw !== rightRaw) return leftRaw.localeCompare(rightRaw)

  const leftCreated = String((left as any).created ?? '').trim()
  const rightCreated = String((right as any).created ?? '').trim()
  if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated)

  return String((left as any).id ?? '').localeCompare(String((right as any).id ?? ''))
}

function isAdminEditor(req: Request): boolean {
  const user = req.user
  if (!user) return false
  return user.role === 'Admin' || user.roles?.Admin === 'Editor'
}

function requireAdminEditor(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminEditor(req)) {
    res.status(403).json({ error: 'Forbidden: DELETE requires an Admin-level editor.' })
    return
  }
  next()
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

router.use(authMiddleware)

router.get('/', requireModule('Inbound Shipments', 'Viewer'), async (_req: Request, res: Response) => {
  try {
    const records = await pb.collection('shippingHistory').getFullList()
    const sorted = [...records].sort(sortBySku)
    res.status(200).json(sorted)
  } catch (error: unknown) {
    console.error('[Shipping] GET /api/shipping failed:', error)
    res.status(500).json({ error: 'Failed to fetch shipping records.' })
  }
})

router.post('/', requireModule('Inbound Shipments', 'Editor'), async (req: Request, res: Response) => {
  try {
    const data = req.body ?? {}
    const trackingNumber = normalizeString(data.trackingNumber)
    const carrier = normalizeString(data.carrier)
    const destination = normalizeString(data.destination)

    if (!trackingNumber) {
      res.status(400).json({ error: 'Validation failed: trackingNumber is required.' })
      return
    }

    if (!carrier) {
      res.status(400).json({ error: 'Validation failed: carrier is required.' })
      return
    }

    if (!destination) {
      res.status(400).json({ error: 'Validation failed: destination is required.' })
      return
    }

    const payload = {
      ...data,
      trackingNumber,
      carrier: carrier || 'Other',
      destination,
      shipDate: data.shipDate ?? new Date().toISOString(),
      status: data.status ?? 'label_created',
      itemsShipped: Array.isArray(data.itemsShipped) ? data.itemsShipped : [],
      packageWeight: data.packageWeight ?? 0,
      postageCost: data.postageCost ?? 0,
    }

    const created = await pb.collection('shippingHistory').create(payload)
    res.status(201).json(created)
  } catch (error: unknown) {
    console.error('[Shipping] POST /api/shipping failed:', error)
    res.status(400).json({ error: 'Failed to create shipping record.' })
  }
})

router.patch('/:id', requireModule('Inbound Shipments', 'Editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = req.body ?? {}
    const existing = await pb.collection('shippingHistory').getOne(id)

    const payload = {
      ...data,
      ...(data.status ? { status: String(data.status).trim() } : { status: existing?.status ?? 'label_created' }),
      ...(data.trackingNumber ? { trackingNumber: normalizeString(data.trackingNumber) } : {}),
      ...(data.carrier ? { carrier: String(data.carrier).trim() } : {}),
      ...(data.destination ? { destination: normalizeString(data.destination) } : {}),
      ...(data.shipDate ? { shipDate: data.shipDate } : {}),
      ...(Array.isArray(data.itemsShipped) ? { itemsShipped: data.itemsShipped } : {}),
    }

    const updated = await pb.collection('shippingHistory').update(id, payload)
    res.status(200).json(updated)
  } catch (error: unknown) {
    console.error('[Shipping] PATCH /api/shipping/:id failed:', error)
    res.status(400).json({ error: 'Failed to update shipping record.' })
  }
})

router.delete('/:id', requireModule('Inbound Shipments', 'Editor'), requireAdminEditor, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await pb.collection('shippingHistory').delete(id)
    res.status(204).send()
  } catch (error: unknown) {
    console.error('[Shipping] DELETE /api/shipping/:id failed:', error)
    res.status(400).json({ error: 'Failed to delete shipping record.' })
  }
})

export default router
