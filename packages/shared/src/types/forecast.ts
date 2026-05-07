import type { ProjectionPoint } from './forecastPrimitives.js'

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
