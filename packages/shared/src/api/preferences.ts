import type { VendorConfig } from '../types/vendor.js'

export interface UserPreferences {
  userId: string
  velocityOverrides: Record<string, 'sales' | 'inventory'>
  vendorConfigs: Record<string, VendorConfig>
  skuVendorMap: Record<string, string[]>
}

export interface UpdatePreferencesRequest {
  velocityOverrides?: Record<string, 'sales' | 'inventory'>
  vendorConfigs?: Record<string, VendorConfig>
  skuVendorMap?: Record<string, string[]>
}
