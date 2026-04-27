import { useState, useEffect, useCallback, useMemo } from 'react'
import { COLLECTIONS } from '../lib/collections'
import { listRecords } from '../lib/pocketbaseApi'
import {
  type ProjectionPoint,
  calcSalesVelocity,
  calcInventoryVelocity,
  calcCombinedVelocity,
  calcDepletionDate,
  calcReorderPoint,
  calcConfidence,
  projectFutureSales,
  type SaleRecord,
  type StockHistoryRecord,
  LOOKBACK_WEEKS,
} from '../lib/forecastingEngine'
import {
  getVendorsForSku,
  getVendorConfigs,
  type ForecastMode,
} from '../lib/vendorConfig'

const OVERRIDE_KEY_PREFIX = 'aida_velocity_override_'

/** Forecasted inventory result for a single SKU. */
export interface ForecastItem {
  id: string | null
  inventoryItemIds: string[]
  name: string
  sku: string
  currentStock: number
  inboundQty: number
  effectiveStock: number
  velocityPerWeek: number
  salesVelocity: number | null
  inventoryVelocity: number | null
  velocitySource: 'sales' | 'inventory' | 'combined'
  discrepancyPct: number | null
  hasDiscrepancy: boolean
  weeksRemaining: number | null
  depletionDate: string | null
  reorderPoint: number
  trend: 'up' | 'down' | 'stable'
  confidence: 'high' | 'medium' | 'low' | 'none'
  status: 'CRITICAL' | 'WARNING' | 'NORMAL'
  vendorKeys: string[]
  vendorNames: string[]
  vendorLeadTimeWeeks: number
  vendorSafetyStockPct: number
  projection: ProjectionPoint[]
}

interface InventorySnapshot {
  id: string
  name: string
  sku: string
  stock: number
}

/** Configuration for the shared forecasting hook. */
interface UseForecastingOptions {
  mode: ForecastMode
}

interface InboundShipmentRecord {
  status?: string
  items?: Array<{ sku: string; quantity: number }>
}

type SignalOverride = 'sales' | 'inventory'

function getSignalOverride(sku: string): SignalOverride | null {
  try {
    const stored = localStorage.getItem(`${OVERRIDE_KEY_PREFIX}${sku}`)
    if (stored === 'sales' || stored === 'inventory') return stored
    return null
  } catch {
    return null
  }
}

function setSignalOverride(sku: string, signal: SignalOverride | null) {
  try {
    const key = `${OVERRIDE_KEY_PREFIX}${sku}`
    if (signal === null) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, signal)
  } catch {
    // ignore localStorage errors
  }
}

function normalizeDeviceItem(record: Record<string, unknown>): InventorySnapshot {
  return {
    id: String(record.id ?? ''),
    name: String(record.name ?? ''),
    sku: String(record.sku ?? '').trim(),
    stock: Number(record.warehouseStock ?? 0),
  }
}

function normalizeComponentItem(record: Record<string, unknown>): InventorySnapshot {
  return {
    id: String(record.id ?? ''),
    name: String(record.name ?? ''),
    sku: String(record.sku ?? '').trim(),
    stock: Number(record.countedStock ?? 0),
  }
}

function normalizeSalesRecord(record: Record<string, unknown>): SaleRecord {
  return {
    id: String(record.id ?? ''),
    sku: String(record.sku ?? '').trim(),
    itemsSold: Number(record.itemsSold ?? record.netSales ?? 0),
    year: Number(record.year ?? 0),
    week: Number(record.week ?? 0),
  }
}

function normalizeHistoryRecord(record: Record<string, unknown>): StockHistoryRecord {
  return {
    id: String(record.id ?? ''),
    inventoryItemId: String(record.inventoryItemId ?? ''),
    field: String(record.field ?? ''),
    oldValue: Number(record.oldValue ?? 0),
    newValue: Number(record.newValue ?? 0),
    change: Number(record.change ?? 0),
    operation: String(record.operation ?? ''),
    created: String(record.created ?? ''),
    timestamp: String(record.timestamp ?? ''),
  }
}

function getUrgencyRank(status: ForecastItem['status']) {
  if (status === 'CRITICAL') return 0
  if (status === 'WARNING') return 1
  return 2
}

/**
 * Builds forecasting rows for either devices or components by combining
 * sales records, stock history, and inbound shipment quantities.
 */
export function useForecasting({ mode }: UseForecastingOptions) {
  const [forecastWindow, setForecastWindow] = useState<(typeof LOOKBACK_WEEKS)[number]>(13)
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([])
  const [inventoryRecords, setInventoryRecords] = useState<InventorySnapshot[]>([])
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([])
  const [historyRecords, setHistoryRecords] = useState<StockHistoryRecord[]>([])
  const [inboundShipments, setInboundShipments] = useState<InboundShipmentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overrideRevision, setOverrideRevision] = useState(0)

  const reloadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const inventoryCollection =
        mode === 'device' ? COLLECTIONS.INVENTORY_DEVICE : COLLECTIONS.INVENTORY_COMPONENT

      const [inventoryRaw, salesRaw, historyRaw, inboundRaw] = await Promise.all([
        listRecords<Record<string, unknown>>(inventoryCollection, { sort: '-updated' }),
        listRecords<Record<string, unknown>>(COLLECTIONS.SALES_DATA, { sort: '-year,-week' }),
        listRecords<Record<string, unknown>>(COLLECTIONS.STOCK_HISTORY, { sort: '-created' }),
        listRecords<Record<string, unknown>>(COLLECTIONS.INBOUND_SHIPMENTS, { sort: '-created' }),
      ])

      const normalizedInventory = inventoryRaw
        .map(item => (mode === 'device' ? normalizeDeviceItem(item) : normalizeComponentItem(item)))
        .filter(item => Boolean(item.sku))

      setInventoryRecords(normalizedInventory)
      setSalesRecords(
        salesRaw
          .map(normalizeSalesRecord)
          .filter(record => Boolean(record.sku))
      )
      setHistoryRecords(
        historyRaw
          .map(normalizeHistoryRecord)
          .filter(record => Boolean(record.inventoryItemId))
      )
      setInboundShipments(
        inboundRaw
          .map(record => ({
            status: String(record.status ?? ''),
            items: Array.isArray(record.items)
              ? (record.items as Array<Record<string, unknown>>).map(item => ({
                  sku: String(item.sku ?? ''),
                  quantity: Number(item.quantity ?? 0),
                }))
              : [],
          }))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load forecasting sources')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    reloadData()
  }, [reloadData])

  const calculate = useMemo(() => {
    if (!inventoryRecords.length) {
      return [] as ForecastItem[]
    }

    const inboundMap = new Map<string, number>()
    for (const shipment of inboundShipments) {
      if (shipment.status === 'Complete') continue
      for (const item of shipment.items ?? []) {
        const sku = item.sku.trim()
        if (!sku) continue
        inboundMap.set(sku, (inboundMap.get(sku) ?? 0) + Number(item.quantity ?? 0))
      }
    }

    const recordsBySku = new Map<string, InventorySnapshot[]>()
    for (const record of inventoryRecords) {
      const sku = record.sku
      if (!recordsBySku.has(sku)) recordsBySku.set(sku, [])
      recordsBySku.get(sku)!.push(record)
    }

    const vendorConfigs = getVendorConfigs(mode)
    const windowDays = forecastWindow * 7

    const items: ForecastItem[] = []

    for (const [sku, skuInventory] of recordsBySku.entries()) {
      const preferredStock =
        skuInventory.find(record => record.stock > 0) ??
        skuInventory.reduce((best, current) => (current.stock > best.stock ? current : best), skuInventory[0])

      const itemIds = skuInventory.map(record => record.id)
      const currentStock = Number(preferredStock.stock ?? 0)
      const inboundQty = inboundMap.get(sku) ?? 0
      const effectiveStock = currentStock + inboundQty

      const skuSales = salesRecords.filter(record => record.sku === sku)
      const skuHistory = historyRecords.filter(record => itemIds.includes(record.inventoryItemId))

      const salesVelocity = calcSalesVelocity(skuSales, windowDays)
      const inventorySignals = itemIds
        .map(itemId => calcInventoryVelocity(skuHistory, itemId, forecastWindow))
        .filter((value): value is number => value !== null)
      const inventoryVelocity =
        inventorySignals.length > 0
          ? inventorySignals.reduce((sum, value) => sum + value, 0) / inventorySignals.length
          : null

      const combined = calcCombinedVelocity(salesVelocity, inventoryVelocity)
      const override = getSignalOverride(sku)

      let velocityPerWeek = combined.velocity
      let velocitySource: ForecastItem['velocitySource'] = combined.source

      if (override === 'sales' && salesVelocity !== null) {
        velocityPerWeek = salesVelocity
        velocitySource = 'sales'
      } else if (override === 'inventory' && inventoryVelocity !== null) {
        velocityPerWeek = inventoryVelocity
        velocitySource = 'inventory'
      }

      const vendorKeys = getVendorsForSku(sku, mode)
      const vendorNames = vendorKeys.map(key => vendorConfigs[key]?.name ?? key)
      const vendorLeadTimeWeeks =
        vendorKeys.length > 0
          ? Math.max(...vendorKeys.map(key => vendorConfigs[key]?.leadTimeWeeks ?? 2))
          : 2
      const vendorSafetyStockPct =
        vendorKeys.length > 0
          ? Math.max(...vendorKeys.map(key => vendorConfigs[key]?.safetyStockPct ?? 0.2))
          : 0.2

      const reorderPoint = calcReorderPoint(
        velocityPerWeek,
        vendorLeadTimeWeeks,
        vendorSafetyStockPct
      )

      const depletion = calcDepletionDate(effectiveStock, velocityPerWeek)
      const weeksRemaining = depletion?.weeksRemaining ?? null
      const depletionDate = depletion?.depletionDate ?? null

      let status: ForecastItem['status'] = 'NORMAL'
      if (effectiveStock < reorderPoint) status = 'CRITICAL'
      else if (weeksRemaining !== null && weeksRemaining <= 2) status = 'WARNING'

      const confidence = calcConfidence(skuSales, forecastWindow)

      const recentRecords = [...skuSales].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.week - b.week
      })
      const half = Math.max(1, Math.floor(recentRecords.length / 2))
      const older = recentRecords.slice(0, half)
      const recent = recentRecords.slice(-half)
      const olderVelocity = calcSalesVelocity(older, Math.max(7, Math.floor(windowDays / 2)))
      const recentVelocity = calcSalesVelocity(recent, Math.max(7, Math.floor(windowDays / 2)))

      let trend: ForecastItem['trend'] = 'stable'
      if (olderVelocity !== null && recentVelocity !== null && olderVelocity > 0) {
        if (recentVelocity > olderVelocity * 1.1) trend = 'up'
        else if (recentVelocity < olderVelocity * 0.9) trend = 'down'
      }

      items.push({
        id: preferredStock.id || null,
        inventoryItemIds: itemIds,
        name: preferredStock.name,
        sku,
        currentStock,
        inboundQty,
        effectiveStock,
        velocityPerWeek,
        salesVelocity,
        inventoryVelocity,
        velocitySource,
        discrepancyPct: combined.discrepancyPct,
        hasDiscrepancy: combined.hasDiscrepancy,
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
        projection: projectFutureSales(skuSales, velocityPerWeek, 8),
      })
    }

    return items.sort((a, b) => {
      const rankDiff = getUrgencyRank(a.status) - getUrgencyRank(b.status)
      if (rankDiff !== 0) return rankDiff
      const weeksA = a.weeksRemaining ?? Number.POSITIVE_INFINITY
      const weeksB = b.weeksRemaining ?? Number.POSITIVE_INFINITY
      if (weeksA !== weeksB) return weeksA - weeksB
      return b.velocityPerWeek - a.velocityPerWeek
    })
  }, [inventoryRecords, salesRecords, historyRecords, inboundShipments, mode, forecastWindow, overrideRevision])

  useEffect(() => {
    setForecastItems(calculate)
  }, [calculate])

  const acceptSignal = useCallback((sku: string, signal: SignalOverride) => {
    setSignalOverride(sku, signal)
    setOverrideRevision(prev => prev + 1)
  }, [])

  const clearSignal = useCallback((sku: string) => {
    setSignalOverride(sku, null)
    setOverrideRevision(prev => prev + 1)
  }, [])

  return {
    forecastItems,
    loading,
    error,
    forecastWindow,
    setForecastWindow,
    refetch: reloadData,
    acceptSignal,
    clearSignal,
  }
}
