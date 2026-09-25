import type { ForecastItem } from '../types/forecast.js'
import type { VendorConfig } from '../types/vendor.js'

export type ForecastMode = 'device' | 'component'

export interface GetForecastResponse {
  mode: ForecastMode
  computedAt: string
  items: ForecastItem[]
}

export interface GetVendorConfigsResponse {
  vendors: Record<string, VendorConfig>
}
