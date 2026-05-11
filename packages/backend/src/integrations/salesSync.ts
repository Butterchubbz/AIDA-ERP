import type PocketBase from 'pocketbase'

export interface SalesEntry {
  sku: string
  saleDate: string // YYYY-MM-DD
  quantity: number
  salePrice: number // total revenue for this sku on this date
  source: string
}

/**
 * Upsert aggregated daily sales entries into the salesData collection.
 * Matches on (sku, saleDate, source). Creates missing records, updates existing ones.
 */
export async function upsertSalesEntries(
  pb: PocketBase,
  entries: SalesEntry[]
): Promise<{ upserted: number; errors: string[] }> {
  if (entries.length === 0) return { upserted: 0, errors: [] }

  const source = entries[0].source
  const dates = [...new Set(entries.map(e => e.saleDate))].sort()
  const minDate = dates[0]

  const existing = await pb.collection('salesData').getFullList<{
    id: string; sku: string; saleDate: string
  }>({
    filter: `source = "${source}" && saleDate >= "${minDate}"`,
    fields: 'id,sku,saleDate',
  }).catch(() => [] as Array<{ id: string; sku: string; saleDate: string }>)

  const existingMap = new Map<string, string>()
  for (const record of existing) {
    existingMap.set(`${record.sku}||${record.saleDate}`, record.id)
  }

  const errors: string[] = []
  let upserted = 0

  for (const entry of entries) {
    const existingId = existingMap.get(`${entry.sku}||${entry.saleDate}`)
    try {
      if (existingId) {
        await pb.collection('salesData').update(existingId, {
          quantity: entry.quantity,
          salePrice: entry.salePrice,
        })
      } else {
        await pb.collection('salesData').create({
          sku: entry.sku,
          saleDate: entry.saleDate,
          quantity: entry.quantity,
          salePrice: entry.salePrice,
          source: entry.source,
          userId: 'system',
        })
      }
      upserted++
    } catch (err: unknown) {
      errors.push(
        `Failed to upsert sales data for SKU "${entry.sku}" on ${entry.saleDate}: ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }
  }

  return { upserted, errors }
}

/**
 * Aggregate raw line-item sales into one SalesEntry per (sku, date).
 */
export function aggregateSalesEntries(
  lines: Array<{ sku: string; saleDate: string; quantity: number; lineTotal: number }>,
  source: string
): SalesEntry[] {
  const agg = new Map<string, SalesEntry>()
  for (const line of lines) {
    if (!line.sku?.trim()) continue
    const key = `${line.sku}||${line.saleDate}`
    const existing = agg.get(key)
    if (existing) {
      existing.quantity += line.quantity
      existing.salePrice += line.lineTotal
    } else {
      agg.set(key, { sku: line.sku, saleDate: line.saleDate, quantity: line.quantity, salePrice: line.lineTotal, source })
    }
  }
  return [...agg.values()]
}
