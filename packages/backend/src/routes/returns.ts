import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import pb from '../lib/pocketbase.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireModule } from '../middleware/authorize.js'

const router = Router()

function sortBySku<T extends { sku?: string; created?: string; id?: string }>(left: T, right: T): number {
  const leftSku = String(left.sku ?? '').trim().toLowerCase()
  const rightSku = String(right.sku ?? '').trim().toLowerCase()

  if (leftSku !== rightSku) return leftSku.localeCompare(rightSku)

  const leftRaw = String(left.sku ?? '').trim()
  const rightRaw = String(right.sku ?? '').trim()
  if (leftRaw !== rightRaw) return leftRaw.localeCompare(rightRaw)

  const leftCreated = String(left.created ?? '').trim()
  const rightCreated = String(right.created ?? '').trim()
  if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated)

  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
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

function getNormalizedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function normalizeStatusTransition(nextStatus: unknown): string | undefined {
  if (nextStatus === undefined || nextStatus === null || String(nextStatus).trim() === '') {
    return undefined
  }

  return String(nextStatus).trim()
}

async function ensureInventorySkuExists(sku: string): Promise<boolean> {
  const normalized = sku.trim().toUpperCase()
  if (!normalized) return false

  try {
    const inventory = await pb.collection('inventoryItems').getFullList()
    return inventory.some((item: any) => String(item?.sku ?? '').trim().toUpperCase() === normalized)
  } catch {
    return false
  }
}

router.use(authMiddleware)

router.get('/', requireModule('RMA Tracker', 'Viewer'), async (_req: Request, res: Response) => {
  try {
    const records = await pb.collection('euReturns').getFullList()
    const sorted = [...records].sort(sortBySku)
    res.status(200).json(sorted)
  } catch (error: unknown) {
    console.error('[Returns] GET /api/returns failed:', error)
    res.status(500).json({ error: 'Failed to fetch returns.' })
  }
})

router.post('/', requireModule('RMA Tracker', 'Editor'), async (req: Request, res: Response) => {
  try {
    const data = req.body ?? {}
    const rmaNumber = getNormalizedString(data.rmaNumber)
    const sku = getNormalizedString(data.sku)

    if (!rmaNumber) {
      res.status(400).json({ error: 'Validation failed: rmaNumber is required.' })
      return
    }

    if (!sku) {
      res.status(400).json({ error: 'Validation failed: sku is required.' })
      return
    }

    const skuExists = await ensureInventorySkuExists(sku)
    if (!skuExists) {
      res.status(400).json({ error: `Validation failed: SKU "${sku}" does not exist in inventoryItems.` })
      return
    }

    const historyLogs = Array.isArray(data.historyLogs) ? data.historyLogs : []
    const initialStatus = getNormalizedString(data.status || 'pending_receipt')

    const payload = {
      ...data,
      rmaNumber,
      sku: sku.toUpperCase(),
      status: initialStatus || 'pending_receipt',
      condition: data.condition ?? 'opened_functional',
      processedBy: data.processedBy ?? req.user?.email ?? 'system',
      receivedAt: data.receivedAt ?? new Date().toISOString(),
      historyLogs: historyLogs.length > 0
        ? historyLogs
        : [
            {
              timestamp: new Date().toISOString(),
              status: initialStatus || 'pending_receipt',
              changedBy: req.user?.email ?? 'system',
              notes: 'Returned record created via API.',
            },
          ],
    }

    const created = await pb.collection('euReturns').create(payload)
    res.status(201).json(created)
  } catch (error: unknown) {
    console.error('[Returns] POST /api/returns failed:', error)
    res.status(400).json({ error: 'Failed to create return record.' })
  }
})

router.patch('/:id', requireModule('RMA Tracker', 'Editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = req.body ?? {}

    const existing = await pb.collection('euReturns').getOne(id)
    const nextStatus = normalizeStatusTransition(data.status)
    const historyLogs = Array.isArray(existing?.historyLogs) ? [...existing.historyLogs] : []

    if (nextStatus && nextStatus !== String(existing?.status ?? '')) {
      historyLogs.push({
        timestamp: new Date().toISOString(),
        status: nextStatus,
        changedBy: req.user?.email ?? 'system',
        notes: data.statusNote ?? `Status updated from ${String(existing?.status ?? 'unknown')} to ${nextStatus}.`,
      })
    }

    const payload = {
      ...data,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(historyLogs.length > 0 ? { historyLogs } : {}),
    }

    const updated = await pb.collection('euReturns').update(id, payload)
    res.status(200).json(updated)
  } catch (error: unknown) {
    console.error('[Returns] PATCH /api/returns/:id failed:', error)
    res.status(400).json({ error: 'Failed to update return record.' })
  }
})

router.delete('/:id', requireModule('RMA Tracker', 'Editor'), requireAdminEditor, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await pb.collection('euReturns').delete(id)
    res.status(204).send()
  } catch (error: unknown) {
    console.error('[Returns] DELETE /api/returns/:id failed:', error)
    res.status(400).json({ error: 'Failed to delete return record.' })
  }
})

export default router
