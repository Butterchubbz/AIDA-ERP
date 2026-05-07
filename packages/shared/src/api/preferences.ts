import type { VendorConfig } from '../types/vendor.js'

export interface UserPreferences {
  userId: string
  velocityOverrides: Record<string, 'sales' | 'inventory'>
  vendorConfigs: Record<string, VendorConfig>
  skuVendorMap: Record<string, string[]>
  /** AES-256-GCM encrypted blob — present only if WooCommerce credentials have been saved */
  encryptedWoocommerceKey?: string
}

export interface UpdatePreferencesRequest {
  velocityOverrides?: Record<string, 'sales' | 'inventory'>
  vendorConfigs?: Record<string, VendorConfig>
  skuVendorMap?: Record<string, string[]>
  /** AES-256-GCM encrypted blob: "<ivHex>:<ciphertextHex>" — stored as-is, never decrypted by preferences route */
  encryptedWoocommerceKey?: string
}
