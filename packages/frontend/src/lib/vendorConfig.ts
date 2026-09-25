export type ForecastMode = 'device' | 'component'

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

const BASE_PO_FORMAT: VendorConfig['poFormat'] = {
  prefix: 'PO',
  separator: '-',
  includeDate: true,
  dateFormat: 'YYYYMMDD',
  includeSuffix: true,
  customPattern: null,
}

export const DEFAULT_VENDORS: Record<string, VendorConfig> = {
  memory: {
    name: 'Memory',
    leadTimeWeeks: 2,
    safetyStockPct: 0.2,
    color: 'cyan',
    poFormat: { ...BASE_PO_FORMAT },
  },
  'protectli-v-series': {
    name: 'Protectli V-Series',
    leadTimeWeeks: 3,
    safetyStockPct: 0.22,
    color: 'indigo',
    poFormat: { ...BASE_PO_FORMAT },
  },
  storage: {
    name: 'Storage',
    leadTimeWeeks: 2,
    safetyStockPct: 0.18,
    color: 'blue',
    poFormat: { ...BASE_PO_FORMAT },
  },
  network: {
    name: 'Networking',
    leadTimeWeeks: 2,
    safetyStockPct: 0.15,
    color: 'purple',
    poFormat: { ...BASE_PO_FORMAT },
  },
  power: {
    name: 'Power',
    leadTimeWeeks: 2,
    safetyStockPct: 0.15,
    color: 'violet',
    poFormat: { ...BASE_PO_FORMAT },
  },
  accessories: {
    name: 'Accessories',
    leadTimeWeeks: 2,
    safetyStockPct: 0.12,
    color: 'slate',
    poFormat: { ...BASE_PO_FORMAT },
  },
  other: {
    name: 'Other',
    leadTimeWeeks: 2,
    safetyStockPct: 0.2,
    color: 'slate',
    poFormat: { ...BASE_PO_FORMAT },
  },
}

function toMode(mode?: ForecastMode): ForecastMode {
  return mode ?? 'device'
}

function vendorStorageKey(mode?: ForecastMode) {
  return `aida_vendor_configs_${toMode(mode)}`
}

function skuMapStorageKey(mode?: ForecastMode) {
  return `aida_sku_vendor_map_${toMode(mode)}`
}

function buildPoFormat(
  pf: Record<string, unknown> | undefined
): VendorConfig['poFormat'] {
  const defaults = {
    prefix: 'PO',
    separator: '-',
    includeDate: true,
    dateFormat: 'YYYYMMDD' as const,
    includeSuffix: true,
    customPattern: null as string | null,
  }
  if (!pf || typeof pf !== 'object') return defaults
  return {
    prefix: typeof pf.prefix === 'string' ? pf.prefix : defaults.prefix,
    separator: typeof pf.separator === 'string' ? pf.separator : defaults.separator,
    includeDate: typeof pf.includeDate === 'boolean' ? pf.includeDate : defaults.includeDate,
    dateFormat: ['YYYYMMDD', 'MMDD', 'YYYY'].includes(pf.dateFormat as string)
      ? (pf.dateFormat as VendorConfig['poFormat']['dateFormat'])
      : defaults.dateFormat,
    includeSuffix: typeof pf.includeSuffix === 'boolean' ? pf.includeSuffix : defaults.includeSuffix,
    customPattern:
      typeof pf.customPattern === 'string'
        ? pf.customPattern
        : pf.customPattern === null
          ? null
          : defaults.customPattern,
  }
}

export function getVendorConfigs(
  mode: ForecastMode = 'device'
): Record<string, VendorConfig> {
  const key = vendorStorageKey(mode)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return structuredClone(DEFAULT_VENDORS)

    const parsed = JSON.parse(raw)

    // Must be a non-null, non-array object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return structuredClone(DEFAULT_VENDORS)
    }

    // Validate each vendor entry loosely —
    // only reject entries missing the required name field
    const result: Record<string, VendorConfig> = {}
    for (const [vendorKey, vendorValue] of Object.entries(parsed as Record<string, unknown>)) {
      const v = vendorValue as Record<string, unknown>
      if (typeof v !== 'object' || v === null) continue
      if (typeof v.name !== 'string') continue

      result[vendorKey] = {
        name: String(v.name),
        leadTimeWeeks: typeof v.leadTimeWeeks === 'number' ? v.leadTimeWeeks : 2,
        safetyStockPct: typeof v.safetyStockPct === 'number' ? v.safetyStockPct : 0.20,
        color: typeof v.color === 'string' ? v.color : 'slate',
        poFormat: buildPoFormat(v.poFormat as Record<string, unknown> | undefined),
      }
    }

    // Return saved vendors as-is; user may have deleted or renamed defaults.
    // Only fall back to defaults if truly nothing valid was parsed.
    return Object.keys(result).length > 0 ? result : structuredClone(DEFAULT_VENDORS)
  } catch {
    return structuredClone(DEFAULT_VENDORS)
  }
}

export function saveVendorConfigs(
  configs: Record<string, VendorConfig>,
  mode: ForecastMode = 'device'
): void {
  localStorage.setItem(vendorStorageKey(mode), JSON.stringify(configs))
}

export function getSkuVendorMap(mode?: ForecastMode): Record<string, string[]> {
  try {
    const saved = localStorage.getItem(skuMapStorageKey(mode))
    if (!saved) return {}
    const parsed = JSON.parse(saved) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const normalized: Record<string, string[]> = {}
    for (const [sku, val] of Object.entries(parsed)) {
      const values =
        typeof val === 'string'
          ? [val]
          : Array.isArray(val)
            ? val.filter((x): x is string => typeof x === 'string')
            : []
      const uniqueValues = [...new Set(values)]
      if (uniqueValues.length > 0) {
        normalized[sku] = uniqueValues
      }
    }

    return normalized
  } catch {
    return {}
  }
}

export function saveSkuVendorMap(map: Record<string, string[]>, mode?: ForecastMode): void {
  localStorage.setItem(skuMapStorageKey(mode), JSON.stringify(map))
}

export function getVendorForSku(sku: string, mode?: ForecastMode): string {
  const vendors = getVendorsForSku(sku, mode)
  return vendors[0] ?? ''
}

export function getVendorsForSku(sku: string, mode?: ForecastMode): string[] {
  const map = getSkuVendorMap(mode)
  const normalizedSku = sku.trim().toUpperCase()
  const raw = map[normalizedSku] ?? map[sku] ?? []
  return [...new Set(raw.filter(vendor => typeof vendor === 'string' && vendor.trim().length > 0))]
}

export function getLeadTimeForSku(sku: string, mode?: ForecastMode): number {
  const vendors = getVendorsForSku(sku, mode)
  if (vendors.length === 0) return 2
  const configs = getVendorConfigs(mode)
  return Math.max(...vendors.map(key => configs[key]?.leadTimeWeeks ?? 2))
}

export function getSafetyPctForSku(sku: string, mode?: ForecastMode): number {
  const vendors = getVendorsForSku(sku, mode)
  if (vendors.length === 0) return 0.2
  const configs = getVendorConfigs(mode)
  return Math.max(...vendors.map(key => configs[key]?.safetyStockPct ?? 0.2))
}

function formatDate(fmt: 'YYYYMMDD' | 'MMDD' | 'YYYY', date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  if (fmt === 'MMDD') return `${m}${d}`
  if (fmt === 'YYYY') return String(y)
  return `${y}${m}${d}`
}

function nextSequence(vendorKey: string, mode: ForecastMode): string {
  const seqKey = `aida_po_seq_${mode}_${vendorKey}`
  const current = Number(localStorage.getItem(seqKey) ?? '0')
  const next = Number.isFinite(current) ? current + 1 : 1
  localStorage.setItem(seqKey, String(next))
  return String(next).padStart(4, '0')
}

export function generatePONumber(
  vendorKey: string,
  vendorName: string,
  mode?: ForecastMode
): string {
  const targetMode = toMode(mode)
  const vendor = getVendorConfigs(targetMode)[vendorKey] ?? DEFAULT_VENDORS.other
  const format = vendor.poFormat
  const dateText = formatDate(format.dateFormat, new Date())
  const seqText = nextSequence(vendorKey || 'other', targetMode)
  const vendorToken = (vendorName || vendor.name || vendorKey || 'OTHER')
    .replace(/\s+/g, '')
    .toUpperCase()

  if (format.customPattern) {
    return format.customPattern
      .replaceAll('{PREFIX}', format.prefix)
      .replaceAll('{DATE}', dateText)
      .replaceAll('{VENDOR}', vendorToken)
      .replaceAll('{SEQ}', seqText)
  }

  const parts: string[] = [format.prefix]
  if (format.includeDate) parts.push(dateText)
  parts.push(vendorToken)
  if (format.includeSuffix) parts.push(seqText)
  return parts.join(format.separator)
}
