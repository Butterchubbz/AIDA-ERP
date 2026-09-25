export interface SaleRecord {
  id?: string
  sku: string
  itemsSold: number
  year: number
  week: number
}

export interface StockHistoryRecord {
  id?: string
  inventoryItemId: string
  field: string
  oldValue: number
  newValue: number
  change: number
  operation?: string
  created?: string
  timestamp?: string
}

export interface ProjectionPoint {
  key: string
  label: string
  week: number
  year: number
  actualSales: number | null
  projectedSales: number | null
}

export const LOOKBACK_WEEKS = [4, 8, 13] as const

export function weekToDate(year: number, week: number): Date {
  const january4th = new Date(Date.UTC(year, 0, 4))
  const day = january4th.getUTCDay() || 7
  const mondayOfWeek1 = new Date(january4th)
  mondayOfWeek1.setUTCDate(january4th.getUTCDate() + 1 - day)
  const out = new Date(mondayOfWeek1)
  out.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7)
  return out
}

export function getRecordDate(record: SaleRecord): Date {
  return weekToDate(record.year, record.week)
}
