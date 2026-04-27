/**
 * Vendor configuration for forecasting lead times
 * and safety stock percentages.
 * Stored in localStorage, keyed by mode (device/component).
 */

/** Vendor-specific lead-time, safety-stock, and PO formatting settings. */
export interface VendorConfig {
  name: string
  leadTimeWeeks: number
  safetyStockPct: number
  color: string
  poFormat: {
    prefix: string
    separator: string
    includeDate: boolean
    dateFormat: 'YYYYMMDD' | 'MMDD' | 'YYYY'
    includeSuffix: boolean
    customPattern: string | null
  }
}

/** Default vendor configuration used when no saved settings exist. */
export const DEFAULT_VENDORS: Record<string, VendorConfig> = {
  'vendor-a': {
    name: 'Vendor A',
    leadTimeWeeks: 2,
    safetyStockPct: 0.20,
    color: 'cyan',
    poFormat: {
      prefix: 'PO',
      separator: '-',
      includeDate: true,
      dateFormat: 'YYYYMMDD',
      includeSuffix: true,
      customPattern: null,
    }
  },
  'vendor-b': {
    name: 'Vendor B',
    leadTimeWeeks: 3,
    safetyStockPct: 0.25,
    color: 'blue',
    poFormat: {
      prefix: 'PO',
      separator: '-',
      includeDate: true,
      dateFormat: 'YYYYMMDD',
      includeSuffix: true,
      customPattern: null,
    }
  },
  'other': {
    name: 'Other',
    leadTimeWeeks: 4,
    safetyStockPct: 0.30,
    color: 'slate',
    poFormat: {
      prefix: 'PO',
      separator: '-',
      includeDate: true,
      dateFormat: 'YYYYMMDD',
      includeSuffix: true,
      customPattern: null,
    }
  },
}

/** Static SKU-prefix overrides used before per-SKU assignments are checked. */
export const VENDOR_PREFIXES: Record<string, string> = {}

/** Loads persisted vendor configuration for the requested forecasting mode. */
export function getVendorConfigs(
  mode: 'device' | 'component'
): Record<string, VendorConfig> {
  const key = `aida_vendor_configs_${mode}`
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : { ...DEFAULT_VENDORS }
  } catch {
    return { ...DEFAULT_VENDORS }
  }
}

/** Persists vendor configuration for the requested forecasting mode. */
export function saveVendorConfigs(
  mode: 'device' | 'component',
  configs: Record<string, VendorConfig>
): void {
  localStorage.setItem(
    `aida_vendor_configs_${mode}`,
    JSON.stringify(configs)
  )
}

/** Loads the explicit SKU-to-vendor assignments for the requested mode. */
export function getSkuVendorMap(
  mode: 'device' | 'component'
): Record<string, string> {
  try {
    const saved = localStorage.getItem(`aida_sku_vendor_map_${mode}`)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

/** Persists the explicit SKU-to-vendor assignments for the requested mode. */
export function saveSkuVendorMap(
  mode: 'device' | 'component',
  map: Record<string, string>
): void {
  localStorage.setItem(
    `aida_sku_vendor_map_${mode}`,
    JSON.stringify(map)
  )
}

/** Resolves the vendor key for a SKU using saved overrides and static prefixes. */
export function getVendorForSku(
  sku: string,
  mode: 'device' | 'component'
): string {
  const skuMap = getSkuVendorMap(mode)
  if (skuMap[sku]) return skuMap[sku]
  for (const [prefix, vendorKey] of Object.entries(VENDOR_PREFIXES)) {
    if (sku.startsWith(prefix)) return vendorKey
  }
  return 'other'
}

/** Returns the configured lead time for the vendor associated with a SKU. */
export function getLeadTimeForSku(
  sku: string,
  mode: 'device' | 'component'
): number {
  const vendorKey = getVendorForSku(sku, mode)
  const configs = getVendorConfigs(mode)
  return configs[vendorKey]?.leadTimeWeeks ?? 2
}

/** Returns the configured safety stock percentage for the vendor associated with a SKU. */
export function getSafetyPctForSku(
  sku: string,
  mode: 'device' | 'component'
): number {
  const vendorKey = getVendorForSku(sku, mode)
  const configs = getVendorConfigs(mode)
  return configs[vendorKey]?.safetyStockPct ?? 0.20
}

/** Generates a purchase order number using the vendor's saved format rules. */
export function generatePONumber(
  vendorKey: string,
  _vendorName: string,
  mode: 'device' | 'component' = 'device'
): string {
  const configs = getVendorConfigs(mode)
  const vendor = configs[vendorKey]
  const fmt = vendor?.poFormat
  if (!fmt) {
    const date = new Date()
      .toISOString().slice(0, 10).replace(/-/g, '')
    const seq = Math.floor(1000 + Math.random() * 9000)
    return `PO-${date}-${seq}`
  }

  if (fmt.customPattern) {
    const date = formatDate(fmt.dateFormat)
    return fmt.customPattern
      .replace('{PREFIX}', fmt.prefix)
      .replace('{DATE}', date)
      .replace('{VENDOR}', vendorKey.toUpperCase())
      .replace('{SEQ}', String(
        Math.floor(1000 + Math.random() * 9000)
      ))
  }

  const parts: string[] = [fmt.prefix]
  if (fmt.includeDate) parts.push(formatDate(fmt.dateFormat))
  if (fmt.includeSuffix) parts.push(
    String(Math.floor(1000 + Math.random() * 9000))
  )
  return parts.join(fmt.separator)
}

function formatDate(fmt: 'YYYYMMDD' | 'MMDD' | 'YYYY'): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  if (fmt === 'YYYYMMDD') return `${y}${m}${day}`
  if (fmt === 'MMDD') return `${m}${day}`
  return String(y)
}
