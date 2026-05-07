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
