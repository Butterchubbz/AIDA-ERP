/**
 * Pure calculation functions for sales velocity forecasting.
 * All functions are stateless and take data as parameters.
 */

/** Sales record used by the forecasting engine. */
export interface SalesRecord {
  id: string
  sku: string
  itemsSold: number
  year: number
  week: number
}

/** Stock history record used to estimate inventory consumption. */
export interface StockHistoryRecord {
  id: string
  inventoryItemId: string
  field: string
  oldValue: number
  newValue: number
  change: number
  operation: string
  created: string
}

/** Converts an ISO week reference to the Monday of that week. */
export function weekToDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - jan4.getDay() + 1)
  const result = new Date(startOfWeek1)
  result.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  return result
}

/** Resolves a sales record to its calendar date. */
export function getRecordDate(record: SalesRecord): Date {
  return weekToDate(record.year, record.week)
}

/** Preset lookback windows in days keyed by nominal week count. */
export const LOOKBACK_WINDOWS = {
  4: 28,
  8: 56,
  13: 91,
} as const

/**
 * Calculate average weekly sales velocity for a SKU.
 * @param records - All sales records for this SKU
 * @param windowDays - Lookback window in days
 * @returns Weekly velocity or null if no data
 */
export function calcSalesVelocity(
  records: SalesRecord[],
  windowDays: number
): number | null {
  if (records.length === 0) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const inWindow = records.filter(
    r => getRecordDate(r) >= cutoff
  )
  if (inWindow.length === 0) {
    // Fall back to full history
    const total = records.reduce((s, r) => s + r.itemsSold, 0)
    const weeks = windowDays / 7
    return total / weeks
  }
  const total = inWindow.reduce((s, r) => s + r.itemsSold, 0)
  const weeks = windowDays / 7
  return total / weeks
}

/**
 * Calculate inventory consumption velocity from stock history.
 * @param records - Stock history records for this item
 * @param windowDays - Lookback window in days
 * @returns Weekly consumption velocity or null
 */
export function calcInventoryVelocity(
  records: StockHistoryRecord[],
  windowDays: number
): number | null {
  if (records.length < 2) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const inWindow = records.filter(r => {
    return new Date(r.created) >= cutoff &&
      r.change < 0 // consumption only
  })
  if (inWindow.length === 0) return null
  const total = inWindow.reduce(
    (s, r) => s + Math.abs(r.change), 0
  )
  return total / (windowDays / 7)
}

/**
 * Combine sales and inventory velocity signals.
 */
export function calcCombinedVelocity(
  salesVelocity: number | null,
  inventoryVelocity: number | null
): {
  velocity: number
  source: 'sales' | 'inventory' | 'combined'
  discrepancyPct: number | null
  hasDiscrepancy: boolean
} {
  if (salesVelocity !== null && inventoryVelocity !== null) {
    const combined = salesVelocity * 0.6 + inventoryVelocity * 0.4
    const discrepancyPct = Math.abs(salesVelocity - inventoryVelocity)
      / Math.max(salesVelocity, inventoryVelocity, 0.01)
    return {
      velocity: combined,
      source: 'combined',
      discrepancyPct,
      hasDiscrepancy: discrepancyPct > 0.20,
    }
  }
  if (salesVelocity !== null) {
    return {
      velocity: salesVelocity,
      source: 'sales',
      discrepancyPct: null,
      hasDiscrepancy: false,
    }
  }
  if (inventoryVelocity !== null) {
    return {
      velocity: inventoryVelocity,
      source: 'inventory',
      discrepancyPct: null,
      hasDiscrepancy: false,
    }
  }
  return {
    velocity: 0,
    source: 'sales',
    discrepancyPct: null,
    hasDiscrepancy: false,
  }
}

/**
 * Calculate reorder point using lead time and safety stock.
 * Formula: (velocity × leadTime) × (1 + safetyPct)
 */
export function calcReorderPoint(
  velocityPerWeek: number,
  leadTimeWeeks: number,
  safetyStockPct: number
): number {
  return Math.ceil(
    velocityPerWeek * leadTimeWeeks * (1 + safetyStockPct)
  )
}

/**
 * Calculate weeks of stock remaining.
 */
export function calcWeeksRemaining(
  stock: number,
  velocityPerWeek: number
): number | null {
  if (velocityPerWeek <= 0) return null
  return stock / velocityPerWeek
}

/**
 * Determine forecast status.
 */
export function calcStatus(
  effectiveStock: number,
  reorderPoint: number,
  weeksRemaining: number | null
): 'CRITICAL' | 'WARNING' | 'NORMAL' {
  if (effectiveStock < reorderPoint) return 'CRITICAL'
  if (weeksRemaining !== null && weeksRemaining < 2)
    return 'WARNING'
  if (effectiveStock < reorderPoint * 1.5) return 'WARNING'
  return 'NORMAL'
}

/**
 * Calculate confidence level based on weeks of data.
 */
export function calcConfidence(
  recordCount: number
): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
  if (recordCount >= 12) return 'HIGH'
  if (recordCount >= 4) return 'MEDIUM'
  if (recordCount >= 1) return 'LOW'
  return 'NONE'
}

/**
 * Parse storage size string to bytes for sorting.
 * e.g. "500GB" → 536870912000
 */
export function parseStorageSize(str: string): number | null {
  const match = str.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|PB)/i)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers: Record<string, number> = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
    PB: 1024 * 1024 * 1024 * 1024 * 1024,
  }
  return value * (multipliers[unit] ?? 1)
}
