import type PocketBase from 'pocketbase'
import type { IntegrationAdapter, SyncResult } from './registry.js'
import { aggregateSalesEntries, upsertSalesEntries } from './salesSync.js'

interface ShopifyOrderLineItem {
  id: number
  sku: string
  quantity: number
  price: string // unit price, e.g. "29.99"
}

interface ShopifyOrder {
  id: number
  created_at: string // e.g. "2026-02-15T10:30:00-05:00"
  line_items: ShopifyOrderLineItem[]
}

interface ShopifyVariant {
  id: number
  sku: string
  inventory_quantity: number
  inventory_management: string | null
}

interface ShopifyProduct {
  id: number
  title: string
  tags: string
  variants: ShopifyVariant[]
}

type InventoryCollection = 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory'

interface InventorySkuEntry {
  id: string
  onlineStock: number
  collection: InventoryCollection
}

interface UnknownSkuEntry {
  sku: string
  productName: string
  stock: number
}

function normalizeSku(sku: string): string {
  return sku.toLowerCase().replace(/\s*-\s*/g, '-').trim()
}

// Parse the cursor URL from Shopify's Link header: <url>; rel="next"
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] ?? null : null
}

async function shopifyFetch(url: string, accessToken: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Shopify request timed out after 15 s. Verify the store URL and network connectivity.')
    }
    if (err instanceof TypeError) {
      const cause = (err as Error & { cause?: unknown }).cause
      const detail = cause instanceof Error ? cause.message : String(cause ?? err.message)
      throw new Error(`Cannot reach Shopify store: ${detail}`)
    }
    throw err
  }
}

async function buildSkuMapFromCollection(
  pb: PocketBase,
  collectionName: InventoryCollection,
  skuMap: Map<string, InventorySkuEntry>
): Promise<void> {
  try {
    const records = (await pb
      .collection(collectionName)
      .getFullList({ fields: 'id,sku,onlineStock' })) as Array<{ id: string; sku?: string; onlineStock?: number | null }>

    for (const record of records) {
      if (record.sku?.trim()) {
        const key = normalizeSku(record.sku)
        if (!skuMap.has(key)) {
          skuMap.set(key, {
            id: record.id,
            onlineStock: record.onlineStock ?? 0,
            collection: collectionName,
          })
        }
      }
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    // 404 = collection not yet created (pre-wizard first run). Re-throw everything else.
    if (status !== 404) throw err
  }
}

export const ShopifyAdapter: IntegrationAdapter = {
  id: 'shopify',
  name: 'Shopify',
  description: 'Sync product inventory levels from your Shopify store into AIDA.',
  credentialFields: [
    {
      key: 'storeUrl',
      label: 'Store URL',
      type: 'url',
      placeholder: 'https://your-store.myshopify.com',
      helpText: 'Your Shopify store URL — must include https://.',
    },
    {
      key: 'accessToken',
      label: 'Admin API Access Token',
      type: 'password',
      placeholder: 'shpat_••••••••••••••••',
      helpText: 'Shopify Admin → Settings → Apps → Develop apps → your app → Admin API access token.',
    },
    {
      key: 'syncTags',
      label: 'Filter by Tags (optional)',
      type: 'text',
      required: false,
      placeholder: 'hardware, networking (leave blank to sync all)',
      helpText: 'Comma-separated Shopify product tags. Leave blank to sync every product.',
    },
  ],

  async sync(credentials: Record<string, string>, pb: PocketBase): Promise<SyncResult> {
    const { storeUrl, accessToken, syncTags } = credentials

    if (!storeUrl || !accessToken) {
      throw new Error('Missing required Shopify credentials (storeUrl, accessToken)')
    }

    const trimmedUrl = storeUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      throw new Error('Store URL must start with https:// (e.g. https://your-store.myshopify.com)')
    }

    const syncTimestamp = new Date().toISOString()
    const errors: string[] = []
    const unknownSkus: UnknownSkuEntry[] = []
    let recordsImported = 0

    const allowedTags = new Set<string>(
      (syncTags ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    )

    const productMatchesFilter = (product: ShopifyProduct): boolean => {
      if (allowedTags.size === 0) return true
      const productTags = product.tags.split(',').map((t) => t.trim().toLowerCase())
      return productTags.some((t) => allowedTags.has(t))
    }

    // Build normalized SKU → PocketBase record map. Device entries take priority.
    const skuMap = new Map<string, InventorySkuEntry>()
    await buildSkuMapFromCollection(pb, 'inventoryDevice', skuMap)
    await buildSkuMapFromCollection(pb, 'inventoryComponent', skuMap)
    await buildSkuMapFromCollection(pb, 'inventoryAccessory', skuMap)

    const evaluatedEntriesMap = new Map<string, InventorySkuEntry>()

    const updateInventoryBySku = async (
      sku: string,
      quantity: number,
      productTitle: string
    ): Promise<void> => {
      const skuEntry = skuMap.get(normalizeSku(sku))

      if (!skuEntry) {
        unknownSkus.push({ sku, productName: productTitle, stock: quantity })
        return
      }

      const oldValue = skuEntry.onlineStock ?? 0
      const newValue = quantity

      await pb.collection(skuEntry.collection).update(skuEntry.id, { onlineStock: newValue })

      if (oldValue !== newValue) {
        await pb.collection('stockHistory').create({
          inventoryItemId: skuEntry.id,
          timestamp: syncTimestamp,
          field: 'onlineStock',
          oldValue,
          newValue,
          change: newValue - oldValue,
          operation: 'shopify_sync',
        })
      }

      skuEntry.onlineStock = newValue
      evaluatedEntriesMap.set(skuEntry.id, skuEntry)
      recordsImported++
    }

    // Shopify cursor-based pagination via Link header
    let nextUrl: string | null =
      `${trimmedUrl}/admin/api/2025-01/products.json?limit=250&fields=id,title,tags,variants`

    while (nextUrl) {
      const res = await shopifyFetch(nextUrl, accessToken)

      if (res.status === 401 || res.status === 403) {
        throw new Error(
          'Shopify API rejected the access token. Check that it has read_products scope and has not been revoked.'
        )
      }
      if (res.status === 404) {
        throw new Error(
          'Store not found. Make sure the URL is correct (e.g. https://your-store.myshopify.com).'
        )
      }
      if (!res.ok) {
        throw new Error(`Shopify API returned ${res.status} ${res.statusText}`)
      }

      const data: { products: ShopifyProduct[] } = await res.json()
      nextUrl = parseNextLink(res.headers.get('Link'))

      for (const product of data.products) {
        if (!productMatchesFilter(product)) continue

        for (const variant of product.variants) {
          if (!variant.sku?.trim()) continue
          // Only sync variants where Shopify manages inventory — unmanaged variants
          // have inventory_management === null and no meaningful quantity to track.
          if (variant.inventory_management !== 'shopify') continue

          try {
            await updateInventoryBySku(variant.sku, variant.inventory_quantity ?? 0, product.title)
          } catch (err: unknown) {
            errors.push(
              `Failed to update SKU "${variant.sku}": ${err instanceof Error ? err.message : 'unknown error'}`
            )
          }
        }
      }
    }

    // Persist unknown SKUs to PocketBase for user review (reuses wcUnknownSkus collection).
    for (const entry of unknownSkus) {
      try {
        const existing = await pb
          .collection('wcUnknownSkus')
          .getFirstListItem(`sku = "${entry.sku}"`, { requestKey: null })
          .catch(() => null)

        if (existing) {
          await pb.collection('wcUnknownSkus').update(existing.id, {
            productName: entry.productName,
            wcStock: entry.stock,
            seenAt: syncTimestamp,
          })
        } else {
          await pb.collection('wcUnknownSkus').create({
            sku: entry.sku,
            productName: entry.productName,
            wcStock: entry.stock,
            seenAt: syncTimestamp,
            dismissed: false,
          })
        }
      } catch (err: unknown) {
        errors.push(
          `Failed to record unknown SKU "${entry.sku}": ${err instanceof Error ? err.message : 'unknown error'}`
        )
      }
    }

    // Write inventory snapshots for forecasting (one absolute reading per evaluated SKU per run).
    for (const entry of evaluatedEntriesMap.values()) {
      try {
        await pb.collection('stockHistory').create({
          inventoryItemId: entry.id,
          timestamp: syncTimestamp,
          field: 'onlineStock',
          oldValue: 0,
          newValue: entry.onlineStock,
          change: 0,
          operation: 'inventory_snapshot',
        })
      } catch {
        // Non-fatal — snapshot failure does not abort the sync result.
      }
    }

    // --- Sales history sync (last 90 days of paid orders) ---
    const salesCutoff = new Date()
    salesCutoff.setMonth(salesCutoff.getMonth() - 3)
    const salesCutoffIso = salesCutoff.toISOString()

    const rawSalesLines: Array<{ sku: string; saleDate: string; quantity: number; lineTotal: number }> = []
    let ordersNextUrl: string | null =
      `${trimmedUrl}/admin/api/2025-01/orders.json?limit=250&financial_status=paid&created_at_min=${encodeURIComponent(salesCutoffIso)}&fields=id,created_at,line_items`

    while (ordersNextUrl) {
      const res = await shopifyFetch(ordersNextUrl, accessToken).catch((err: unknown) => {
        errors.push(`Sales history fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`)
        return null
      })

      if (!res) break
      if (!res.ok) {
        errors.push(`Shopify orders API returned ${res.status} — skipping sales history`)
        break
      }

      const data: { orders: ShopifyOrder[] } = await res.json()
      ordersNextUrl = parseNextLink(res.headers.get('Link'))

      for (const order of data.orders ?? []) {
        const saleDate = order.created_at?.split('T')[0]
        if (!saleDate) continue
        for (const item of order.line_items ?? []) {
          if (!item.sku?.trim()) continue
          const unitPrice = parseFloat(item.price ?? '0') || 0
          rawSalesLines.push({
            sku: item.sku,
            saleDate,
            quantity: item.quantity ?? 0,
            lineTotal: unitPrice * (item.quantity ?? 0),
          })
        }
      }
    }

    const salesEntries = aggregateSalesEntries(rawSalesLines, 'shopify')
    const salesResult = await upsertSalesEntries(pb, salesEntries).catch((err: unknown) => ({
      upserted: 0,
      errors: [`Sales data upsert failed: ${err instanceof Error ? err.message : 'unknown error'}`],
    }))
    errors.push(...salesResult.errors)

    return { recordsImported, salesImported: salesResult.upserted, errors, unknownSkuCount: unknownSkus.length }
  },
}
