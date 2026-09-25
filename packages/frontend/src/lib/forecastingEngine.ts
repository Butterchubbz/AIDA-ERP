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

function toWeekWindow(days: number): number {
  return Math.max(1, Math.round(days / 7))
}

function addWeeks(base: Date, weeks: number): Date {
  const out = new Date(base)
  out.setUTCDate(out.getUTCDate() + weeks * 7)
  return out
}

function getYearWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function yearWeekLabel(year: number, week: number) {
  return `W${week} ${year}`
}

export function calcSalesVelocity(records: SaleRecord[], days: number): number | null {
  if (!records.length) return null
  const weeks = toWeekWindow(days)

  const dated = [...records]
    .map(record => ({ record, date: getRecordDate(record) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const latest = dated[dated.length - 1]?.date ?? new Date()
  const cutoff = addWeeks(latest, -weeks)
  const inWindow = dated.filter(entry => entry.date >= cutoff)
  if (inWindow.length < 3) return null

  const totalSold = inWindow.reduce((sum, entry) => sum + Math.max(0, entry.record.itemsSold), 0)
  return totalSold / weeks
}

export function calcInventoryVelocity(
  stockRecords: StockHistoryRecord[],
  itemId: string,
  weeks: number
): number | null {
  const windowWeeks = Math.max(1, weeks)
  const candidates = stockRecords
    .filter(record => record.inventoryItemId === itemId)
    .filter(record => record.field === 'warehouseStock' || record.field === 'countedStock')
    .filter(record => record.change < 0)
    .map(record => ({
      ...record,
      eventDate: new Date(record.timestamp ?? record.created ?? Date.now()),
    }))
    .filter(record => !Number.isNaN(record.eventDate.getTime()))
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())

  if (!candidates.length) return null

  const latest = candidates[candidates.length - 1].eventDate
  const cutoff = addWeeks(latest, -windowWeeks)
  const inWindow = candidates.filter(record => record.eventDate >= cutoff)
  if (!inWindow.length) return null

  const consumed = inWindow.reduce((sum, record) => sum + Math.abs(record.change), 0)
  return consumed / windowWeeks
}

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
    const discrepancyPct = Math.abs(salesVelocity - inventoryVelocity)
      / Math.max(salesVelocity, inventoryVelocity, 0.0001)
    return {
      velocity: salesVelocity * 0.6 + inventoryVelocity * 0.4,
      source: 'combined',
      discrepancyPct,
      hasDiscrepancy: discrepancyPct > 0.2,
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

export function calcDepletionDate(
  currentStock: number,
  velocityPerWeek: number
): { weeksRemaining: number; depletionDate: string } | null {
  if (currentStock <= 0 || velocityPerWeek <= 0) return null
  const weeksRemaining = currentStock / velocityPerWeek
  const depletion = addWeeks(new Date(), weeksRemaining)
  return {
    weeksRemaining,
    depletionDate: depletion.toISOString(),
  }
}

export function calcReorderPoint(
  velocityPerWeek: number,
  leadTimeWeeks: number,
  safetyStockPct: number
): number {
  return Math.ceil(velocityPerWeek * leadTimeWeeks * (1 + safetyStockPct))
}

export function calcConfidence(
  records: SaleRecord[],
  weeks: number
): 'high' | 'medium' | 'low' | 'none' {
  if (!records.length) return 'none'

  const latest = records
    .map(getRecordDate)
    .reduce((max, date) => (date > max ? date : max), new Date(0))
  const cutoff = addWeeks(latest, -Math.max(1, weeks))
  const uniqueWeeks = new Set(
    records
      .filter(record => getRecordDate(record) >= cutoff)
      .map(record => `${record.year}-${record.week}`)
  )

  const count = uniqueWeeks.size
  if (count >= 12) return 'high'
  if (count >= 4) return 'medium'
  if (count >= 1) return 'low'
  return 'none'
}

export function projectFutureSales(
  records: SaleRecord[],
  velocityPerWeek: number,
  forecastWeeks = 8
): ProjectionPoint[] {
  const byWeek = new Map<string, { year: number; week: number; actualSales: number }>()
  for (const record of records) {
    const key = `${record.year}-${record.week}`
    const previous = byWeek.get(key)
    if (!previous) {
      byWeek.set(key, {
        year: record.year,
        week: record.week,
        actualSales: Math.max(0, record.itemsSold),
      })
      continue
    }

    previous.actualSales += Math.max(0, record.itemsSold)
  }

  const actualSeries = [...byWeek.values()].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.week - b.week
  })

  const trimmedActuals = actualSeries.slice(-7)
  const points: ProjectionPoint[] = trimmedActuals.map(entry => ({
    key: `${entry.year}-${entry.week}`,
    label: yearWeekLabel(entry.year, entry.week),
    week: entry.week,
    year: entry.year,
    actualSales: entry.actualSales,
    projectedSales: null,
  }))

  const referenceDate = trimmedActuals.length
    ? weekToDate(trimmedActuals[trimmedActuals.length - 1].year, trimmedActuals[trimmedActuals.length - 1].week)
    : new Date()

  for (let index = 1; index <= Math.max(1, forecastWeeks); index += 1) {
    const targetDate = addWeeks(referenceDate, index)
    const yearWeek = getYearWeek(targetDate)
    points.push({
      key: `${yearWeek.year}-${yearWeek.week}`,
      label: yearWeekLabel(yearWeek.year, yearWeek.week),
      week: yearWeek.week,
      year: yearWeek.year,
      actualSales: null,
      projectedSales: Number(velocityPerWeek.toFixed(2)),
    })
  }

  return points
}
