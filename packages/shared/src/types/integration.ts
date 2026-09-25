export interface IntegrationSettings {
  userId: string
  /** AES-256-GCM encrypted blob: "<ivHex>:<ciphertextHex>" */
  encryptedWoocommerceKey: string
  woocommerceStoreUrl?: string
  syncLastRun?: string
  syncStatus: 'idle' | 'syncing' | 'error'
}
