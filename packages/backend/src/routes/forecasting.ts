import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import type {
  ForecastItem,
  GetForecastResponse,
  ForecastMode,
  DeviceItem,
  ComponentItem,
  VendorConfig,
  InboundShipment,
  ProjectionPoint,
} from '@aida/shared'
function normalizeSku(sku: string): string {
  return sku.toLowerCase().replace(/\s*-\s*/g, '-').trim()
}

// ISO 8601 Monday of week N — mirrors the shared weekToDate util
function weekToDate(year: number, week: number): Date {
  const january4th = new Date(Date.UTC(year, 0, 4))
  const day = january4th.getUTCDay() || 7
  const mondayOfWeek1 = new Date(january4th)
  mondayOfWeek1.setUTCDate(january4th.getUTCDate() + 1 - day)
  const out = new Date(mondayOfWeek1)
  out.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7)
  return out
}

// ISO week (Monday-based) from a UTC Date
function getIsoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function weekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`
}

function weekLabel(year: number, week: number): string {
  const date = weekToDate(year, week)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function shiftWeeks(year: number, week: number, n: number): { year: number; week: number } {
  const date = weekToDate(year, week)
  date.setUTCDate(date.getUTCDate() + n * 7)
  return getIsoWeek(date)
}

function deviceCurrentStock(item: DeviceItem): number {
  return (item.webStock ?? 0) + (item.warehouseStock ?? 0) + (item.productionStock ?? 0) + (item.reserveStock ?? 0)
}

function componentCurrentStock(item: ComponentItem): number {
  return item.countedStock ?? 0
}

type SalesDataRecord = { id: string; sku: string; quantity: number; saleDate: string }
type HistoryRecord = { id: string; inventoryItemId: string; change: number; operation: string; timestamp: string }
type UserPrefs = { vendorConfigs?: Record<string, VendorConfig>; velocityOverrides?: Record<string, number>; skuVendorMap?: Record<string, string[]> }

const SYNC_OPS = new Set(['woocommerce_sync', 'shopify_sync', 'inventory_snapshot'])
const PROJECTION_FUTURE_WEEKS = 8

export async function getVendorConfigs(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id
    const prefs = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    const vendorConfigs = prefs?.vendorConfigs || {}
    res.status(200).json(vendorConfigs)
  } catch (err: unknown) {
    console.error('[Forecasting] GET vendor configs failed:', err)
    res.status(500).json({ error: 'Failed to fetch vendor configs' })
  }
}

export async function saveVendorConfigs(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id
    const vendorConfigs = req.body as Record<string, VendorConfig>

    const existing = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    let record
    if (existing) {
      record = await pb.collection('userPreferences').update(existing.id, { vendorConfigs })
    } else {
      record = await pb.collection('userPreferences').create({
        userId,
        vendorConfigs,
        velocityOverrides: {},
        skuVendorMap: {},
      })
    }

    res.status(200).json(record.vendorConfigs)
  } catch (err: unknown) {
    console.error('[Forecasting] POST vendor configs failed:', err)
    res.status(400).json({ error: 'Failed to save vendor configs' })
  }
}

export async function getForecast(req: Request, res: Response): Promise<void> {
  const mode: ForecastMode = (req.query.mode as string) === 'component' ? 'component' : 'device'
  const windowRaw = Number(req.query.window)
  const windowWeeks: number = [4, 8, 13].includes(windowRaw) ? windowRaw : 13
  const computedAt = new Date().toISOString()
  const now = new Date()

  const cutoffDate = new Date(now.getTime() - windowWeeks * 7 * 24 * 60 * 60 * 1000)
  const cutoffIso = cutoffDate.toISOString().split('T')[0]

  try {
    // Inventory items
    const inventoryItems = mode === 'device'
      ? await pb.collection('inventoryDevice').getFullList<DeviceItem>()
      : await pb.collection('inventoryComponent').getFullList<ComponentItem>()

    // User preferences (vendorConfigs, velocityOverrides, skuVendorMap)
    const userId = req.user?.id
    const prefs: UserPrefs | null = userId
      ? await pb.collection('userPreferences').getFirstListItem<UserPrefs>(`userId = "${userId}"`).catch(() => null)
      : null

    const vendorConfigs: Record<string, VendorConfig> = prefs?.vendorConfigs ?? {}
    const velocityOverrides: Record<string, number> = prefs?.velocityOverrides ?? {}
    const skuVendorMap: Record<string, string[]> = prefs?.skuVendorMap ?? {}

    // Sales data within window: sku → weekKey → qty
    const salesRecords = await pb.collection('salesData').getFullList<SalesDataRecord>({
      filter: `saleDate >= "${cutoffIso}"`,
    }).catch(() => [] as SalesDataRecord[])

    const salesBySku = new Map<string, Map<string, number>>()
    for (const record of salesRecords) {
      if (!record.sku?.trim() || !record.saleDate) continue
      const nSku = normalizeSku(record.sku)
      const { year, week } = getIsoWeek(new Date(record.saleDate))
      const key = weekKey(year, week)
      if (!salesBySku.has(nSku)) salesBySku.set(nSku, new Map())
      const m = salesBySku.get(nSku)!
      m.set(key, (m.get(key) ?? 0) + (record.quantity ?? 0))
    }

    // Stock history (negative outbound movements, non-sync) within window: itemId → weekKey → qty
    const historyRecords = await pb.collection('stockHistory').getFullList<HistoryRecord>({
      filter: `timestamp >= "${cutoffIso}" && change < 0`,
    }).catch(() => [] as HistoryRecord[])

    const historyByItem = new Map<string, Map<string, number>>()
    for (const record of historyRecords) {
      if (SYNC_OPS.has(record.operation ?? '')) continue
      const { year, week } = getIsoWeek(new Date(record.timestamp))
      const key = weekKey(year, week)
      if (!historyByItem.has(record.inventoryItemId)) historyByItem.set(record.inventoryItemId, new Map())
      const m = historyByItem.get(record.inventoryItemId)!
      m.set(key, (m.get(key) ?? 0) + Math.abs(record.change))
    }

    // Pending inbound shipments → inboundQty by SKU
    const inboundShipments = await pb.collection('inboundShipment').getFullList<InboundShipment>({
      filter: 'status != "Received" && status != "Cancelled"',
    }).catch(() => [] as InboundShipment[])

    const inboundBySku = new Map<string, number>()
    for (const shipment of inboundShipments) {
      for (const lineItem of (shipment.items ?? [])) {
        if (lineItem.sku?.trim()) {
          const nSku = normalizeSku(lineItem.sku)
          inboundBySku.set(nSku, (inboundBySku.get(nSku) ?? 0) + (lineItem.quantity ?? 0))
        }
      }
    }

    // Build ordered list of past weeks (window) + future projection weeks
    const { year: nowYear, week: nowWeek } = getIsoWeek(now)
    const windowStart = shiftWeeks(nowYear, nowWeek, -(windowWeeks - 1))

    const pastWeeks: Array<{ year: number; week: number }> = []
    for (let i = 0; i < windowWeeks; i++) {
      pastWeeks.push(shiftWeeks(windowStart.year, windowStart.week, i))
    }

    // Build ForecastItem for each inventory item
    const items: ForecastItem[] = []

    for (const item of inventoryItems) {
      if (!item.sku?.trim()) continue

      const currentStock = mode === 'device'
        ? deviceCurrentStock(item as DeviceItem)
        : componentCurrentStock(item as ComponentItem)

      const nItemSku = normalizeSku(item.sku)
      const inboundQty = inboundBySku.get(nItemSku) ?? 0
      const effectiveStock = currentStock + inboundQty

      // Vendor info
      const vendorKeys = skuVendorMap[item.sku] ?? []
      const vendorList = vendorKeys.map(k => vendorConfigs[k]).filter(Boolean) as VendorConfig[]
      const vendorNames = vendorList.map(v => v.name)
      const vendorLeadTimeWeeks = vendorList.length > 0
        ? Math.min(...vendorList.map(v => v.leadTimeWeeks ?? 4))
        : 4
      const vendorSafetyStockPct = vendorList.length > 0
        ? Math.max(...vendorList.map(v => v.safetyStockPct ?? 20))
        : 20

      // Sales velocity (units/week from salesData)
      const skuSalesMap = salesBySku.get(nItemSku)
      let salesTotal = 0
      let salesWeeksWithData = 0
      for (const pw of pastWeeks) {
        const qty = skuSalesMap?.get(weekKey(pw.year, pw.week)) ?? 0
        salesTotal += qty
        if (qty > 0) salesWeeksWithData++
      }
      const salesVelocity: number | null = salesTotal > 0 ? salesTotal / windowWeeks : null

      // Inventory velocity (units/week from stock outflows)
      const itemHistoryMap = historyByItem.get(item.id)
      let historyTotal = 0
      let historyWeeksWithData = 0
      for (const pw of pastWeeks) {
        const qty = itemHistoryMap?.get(weekKey(pw.year, pw.week)) ?? 0
        historyTotal += qty
        if (qty > 0) historyWeeksWithData++
      }
      const inventoryVelocity: number | null = historyTotal > 0 ? historyTotal / windowWeeks : null

      // Resolved velocity
      const override = velocityOverrides[item.sku]
      let velocityPerWeek: number
      let velocitySource: 'sales' | 'inventory' | 'combined'

      if (override != null) {
        velocityPerWeek = override
        velocitySource = salesVelocity != null && inventoryVelocity != null ? 'combined'
          : salesVelocity != null ? 'sales' : 'inventory'
      } else if (salesVelocity != null && inventoryVelocity != null) {
        velocityPerWeek = (salesVelocity + inventoryVelocity) / 2
        velocitySource = 'combined'
      } else if (salesVelocity != null) {
        velocityPerWeek = salesVelocity
        velocitySource = 'sales'
      } else if (inventoryVelocity != null) {
        velocityPerWeek = inventoryVelocity
        velocitySource = 'inventory'
      } else {
        velocityPerWeek = 0
        velocitySource = 'sales'
      }

      // Discrepancy between sales and inventory signals
      let discrepancyPct: number | null = null
      if (salesVelocity != null && inventoryVelocity != null) {
        const maxV = Math.max(salesVelocity, inventoryVelocity)
        discrepancyPct = maxV > 0 ? (Math.abs(salesVelocity - inventoryVelocity) / maxV) * 100 : 0
      }
      const hasDiscrepancy = discrepancyPct != null && discrepancyPct > 20

      // Reorder point: stock needed to cover lead time + safety buffer
      const safetyWeeks = vendorLeadTimeWeeks * (vendorSafetyStockPct / 100)
      const reorderPoint = Math.ceil(velocityPerWeek * (vendorLeadTimeWeeks + safetyWeeks))

      // Depletion estimate
      let weeksRemaining: number | null = null
      let depletionDate: string | null = null
      if (velocityPerWeek > 0) {
        weeksRemaining = effectiveStock / velocityPerWeek
        const depletionMs = now.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000
        depletionDate = new Date(depletionMs).toISOString().split('T')[0]
      }

      // Status
      let status: 'CRITICAL' | 'WARNING' | 'NORMAL' = 'NORMAL'
      if (velocityPerWeek > 0 && weeksRemaining != null) {
        if (weeksRemaining <= vendorLeadTimeWeeks) status = 'CRITICAL'
        else if (weeksRemaining <= vendorLeadTimeWeeks * 2) status = 'WARNING'
      }

      // Trend: compare last 4 weeks vs earlier weeks in window
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (skuSalesMap && pastWeeks.length >= 5) {
        const recentWeeks = pastWeeks.slice(-4)
        const olderWeeks = pastWeeks.slice(0, pastWeeks.length - 4)
        const recentVelocity = recentWeeks.reduce((s, pw) => s + (skuSalesMap.get(weekKey(pw.year, pw.week)) ?? 0), 0) / 4
        const olderVelocity = olderWeeks.reduce((s, pw) => s + (skuSalesMap.get(weekKey(pw.year, pw.week)) ?? 0), 0) / olderWeeks.length
        if (olderVelocity > 0) {
          const delta = (recentVelocity - olderVelocity) / olderVelocity
          if (delta > 0.1) trend = 'up'
          else if (delta < -0.1) trend = 'down'
        }
      }

      // Confidence
      const totalDataWeeks = salesWeeksWithData + historyWeeksWithData
      let confidence: 'high' | 'medium' | 'low' | 'none' = 'none'
      if (totalDataWeeks >= 5) confidence = 'high'
      else if (totalDataWeeks >= 3) confidence = 'medium'
      else if (totalDataWeeks >= 1) confidence = 'low'

      // Projection: past window (actual) + future (projected)
      const projection: ProjectionPoint[] = []
      for (const pw of pastWeeks) {
        const key = weekKey(pw.year, pw.week)
        projection.push({
          key,
          label: weekLabel(pw.year, pw.week),
          week: pw.week,
          year: pw.year,
          actualSales: skuSalesMap?.get(key) ?? 0,
          projectedSales: velocityPerWeek > 0 ? velocityPerWeek : null,
        })
      }
      let futureYW = shiftWeeks(nowYear, nowWeek, 1)
      for (let i = 0; i < PROJECTION_FUTURE_WEEKS; i++) {
        projection.push({
          key: weekKey(futureYW.year, futureYW.week),
          label: weekLabel(futureYW.year, futureYW.week),
          week: futureYW.week,
          year: futureYW.year,
          actualSales: null,
          projectedSales: velocityPerWeek > 0 ? velocityPerWeek : null,
        })
        futureYW = shiftWeeks(futureYW.year, futureYW.week, 1)
      }

      items.push({
        id: item.id,
        inventoryItemIds: [item.id],
        name: item.name,
        sku: item.sku,
        currentStock,
        inboundQty,
        effectiveStock,
        velocityPerWeek,
        salesVelocity,
        inventoryVelocity,
        velocitySource,
        discrepancyPct,
        hasDiscrepancy,
        weeksRemaining,
        depletionDate,
        reorderPoint,
        trend,
        confidence,
        status,
        vendorKeys,
        vendorNames,
        vendorLeadTimeWeeks,
        vendorSafetyStockPct,
        projection,
      })
    }

    // Sort: CRITICAL first, then WARNING, then NORMAL; within each group, fewest weeks remaining first
    const statusOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, NORMAL: 2 }
    items.sort((a, b) => {
      const sd = statusOrder[a.status] - statusOrder[b.status]
      if (sd !== 0) return sd
      return (a.weeksRemaining ?? Infinity) - (b.weeksRemaining ?? Infinity)
    })

    const response: GetForecastResponse = { mode, computedAt, items }
    res.status(200).json(response)
  } catch (err: unknown) {
    console.error('[Forecasting] GET forecast failed:', err)
    res.status(500).json({ error: 'Failed to compute forecast' })
  }
}
