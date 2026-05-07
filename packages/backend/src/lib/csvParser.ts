/**
 * CSV Parser for sales data import.
 *
 * Expected CSV format:
 *   sku,quantity,saleDate,salePrice
 *
 * Required columns: sku, quantity
 * Optional columns: saleDate (ISO 8601), salePrice (float)
 */

export interface ParsedCSVRow {
  sku: string
  quantity: number
  saleDate?: string
  salePrice?: number
}

export interface CSVRowError {
  row: number
  message: string
}

export interface CSVParseResult {
  rows: ParsedCSVRow[]
  errors: CSVRowError[]
}

/**
 * Parse raw CSV text into typed records.
 * Returns successfully parsed rows alongside per-row errors.
 * Malformed rows are skipped rather than aborting the whole import.
 */
export function parseCSV(csvText: string): CSVParseResult {
  const lines = csvText.trim().split(/\r?\n/)

  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'CSV must have a header row and at least one data row' }],
    }
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const skuIdx = headers.indexOf('sku')
  const qtyIdx = headers.indexOf('quantity')
  const dateIdx = headers.indexOf('saledate')
  const priceIdx = headers.indexOf('saleprice')

  if (skuIdx === -1 || qtyIdx === -1) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'CSV must contain "sku" and "quantity" columns' }],
    }
  }

  const rows: ParsedCSVRow[] = []
  const errors: CSVRowError[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(',')

    const sku = cols[skuIdx]?.trim()
    if (!sku) {
      errors.push({ row: i + 1, message: 'Missing sku' })
      continue
    }

    const rawQty = cols[qtyIdx]?.trim() ?? ''
    const quantity = parseInt(rawQty, 10)
    if (isNaN(quantity) || quantity < 1) {
      errors.push({ row: i + 1, message: `Invalid quantity: "${rawQty}" — must be a positive integer` })
      continue
    }

    const row: ParsedCSVRow = { sku, quantity }

    if (dateIdx !== -1) {
      const rawDate = cols[dateIdx]?.trim()
      if (rawDate) {
        // Accept any ISO 8601 date or date-time string
        row.saleDate = rawDate
      }
    }

    if (priceIdx !== -1) {
      const rawPrice = cols[priceIdx]?.trim()
      if (rawPrice) {
        const salePrice = parseFloat(rawPrice)
        if (!isNaN(salePrice) && salePrice >= 0) {
          row.salePrice = salePrice
        }
      }
    }

    rows.push(row)
  }

  return { rows, errors }
}
