import type PocketBase from 'pocketbase'
import type { IntegrationAdapter, SyncResult } from './registry.js'
import { aggregateSalesEntries, upsertSalesEntries } from './salesSync.js'

interface WCOrderLineItem {
  id: number
  sku: string
  quantity: number
  total: string // e.g. "59.98"
}

interface WCOrder {
  id: number
  date_created: string // e.g. "2026-02-15T10:30:00"
  status: string
  line_items: WCOrderLineItem[]
}

interface WCProduct {
  id: number
  name: string
  type: string
  sku: string
  stock_quantity: number | null
  manage_stock: boolean
  status: string
  categories: Array<{ id: number; name: string; slug: string }>
}

interface WCVariation {
  id: number
  sku: string
  stock_quantity: number | null
  manage_stock: boolean
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
  wcStock: number
}

function normalizeSku(sku: string): string {
  return sku.toLowerCase().replace(/\s*-\s*/g, '-').trim()
}

async function wcFetch(url: string, authHeader: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('WooCommerce request timed out after 15 s. Verify the store URL and that the server can reach it.')
    }
    if (err instanceof TypeError) {
      const cause = (err as Error & { cause?: unknown }).cause
      const detail = cause instanceof Error ? cause.message : String(cause ?? err.message)
      throw new Error(`Cannot reach WooCommerce store: ${detail}`)
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
    // 404 = collection doesn't exist yet (first run before wizard). Re-throw everything else.
    if (status !== 404) {
      throw err
    }
  }
}

export const WooCommerceAdapter: IntegrationAdapter = {
  id: 'woocommerce',
  name: 'WooCommerce',
  description: 'Sync product stock levels from your WooCommerce store into AIDA inventory.',
  credentialFields: [
    {
      key: 'storeUrl',
      label: 'Store URL',
      type: 'url',
      placeholder: 'https://yourstore.com',
      helpText: 'The full URL of your WooCommerce site (no trailing slash).',
    },
    {
      key: 'consumerKey',
      label: 'Consumer Key',
      type: 'password',
      placeholder: 'ck_••••••••••••••••',
      helpText: 'Found in WooCommerce → Settings → Advanced → REST API.',
    },
    {
      key: 'consumerSecret',
      label: 'Consumer Secret',
      type: 'password',
      placeholder: 'cs_••••••••••••••••',
      helpText: 'Shown once when you create the API key — copy it before closing that page.',
    },
    {
      key: 'syncCategories',
      label: 'Sync Categories (optional)',
      type: 'text',
      required: false,
      placeholder: 'Firewalls, Hardware (leave blank to sync all)',
      helpText: 'Comma-separated WooCommerce category names. Leave blank to import every product.',
    },
  ],

  async sync(credentials: Record<string, string>, pb: PocketBase): Promise<SyncResult> {
    const { storeUrl, consumerKey, consumerSecret, syncCategories } = credentials

    if (!storeUrl || !consumerKey || !consumerSecret) {
      throw new Error('Missing required WooCommerce credentials')
    }

    const trimmedUrl = storeUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      throw new Error('Store URL must start with https:// or http:// (e.g. https://yourstore.com)')
    }

    const baseUrl = trimmedUrl
    const authHeader = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
    const syncTimestamp = new Date().toISOString()
    const errors: string[] = []
    const unknownSkus: UnknownSkuEntry[] = []
    let page = 1
    let recordsImported = 0

    const allowedCategories = new Set<string>(
      (syncCategories ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )

    const productMatchesFilter = (product: WCProduct): boolean => {
      if (allowedCategories.size === 0) return true
      return product.categories.some(
        (c) => allowedCategories.has(c.name.toLowerCase()) || allowedCategories.has(c.slug.toLowerCase())
      )
    }

    // Build normalized SKU → record ID map across all three collections.
    // Device entries take priority if the same SKU exists in multiple collections.
    const skuMap = new Map<string, InventorySkuEntry>()
    await buildSkuMapFromCollection(pb, 'inventoryDevice', skuMap)
    await buildSkuMapFromCollection(pb, 'inventoryComponent', skuMap)
    await buildSkuMapFromCollection(pb, 'inventoryAccessory', skuMap)

    // Track entries evaluated this run so we can write weekly snapshots at the end.
    const evaluatedEntriesMap = new Map<string, InventorySkuEntry>()

    const updateInventoryBySku = async (
      sku: string,
      stockQuantity: number | null,
      manageStock: boolean,
      nameForError: string
    ): Promise<void> => {
      const skuEntry = skuMap.get(normalizeSku(sku))

      if (!skuEntry) {
        unknownSkus.push({ sku, productName: nameForError, wcStock: stockQuantity ?? 0 })
        return
      }

      if (manageStock) {
        const oldValue = skuEntry.onlineStock ?? 0
        const newValue = stockQuantity ?? 0

        await pb.collection(skuEntry.collection).update(skuEntry.id, {
          onlineStock: newValue,
        })

        if (oldValue !== newValue) {
          await pb.collection('stockHistory').create({
            inventoryItemId: skuEntry.id,
            timestamp: syncTimestamp,
            field: 'onlineStock',
            oldValue,
            newValue,
            change: newValue - oldValue,
            operation: 'woocommerce_sync',
          })
        }

        skuEntry.onlineStock = newValue
        evaluatedEntriesMap.set(skuEntry.id, skuEntry)
      }

      recordsImported++
    }

    const syncVariations = async (product: WCProduct): Promise<void> => {
      let variationPage = 1

      while (true) {
        const url = `${baseUrl}/wp-json/wc/v3/products/${product.id}/variations?per_page=100&page=${variationPage}`
        const res = await wcFetch(url, authHeader)

        if (res.status === 401 || res.status === 403) {
          throw new Error('WooCommerce API rejected the credentials. Check your Consumer Key and Consumer Secret.')
        }
        if (!res.ok) {
          throw new Error(`WooCommerce API returned ${res.status} ${res.statusText}`)
        }

        const variations: WCVariation[] = await res.json()
        if (variations.length === 0) {
          break
        }

        for (const variation of variations) {
          if (!variation.sku?.trim()) {
            continue
          }

          try {
            await updateInventoryBySku(
              variation.sku,
              variation.stock_quantity,
              variation.manage_stock,
              `${product.name} variation`
            )
          } catch (err: unknown) {
            errors.push(
              `Failed to update variation SKU "${variation.sku}": ${
                err instanceof Error ? err.message : 'unknown error'
              }`
            )
          }
        }

        if (variations.length < 100) {
          break
        }
        variationPage++
      }
    }

    while (true) {
      const url = `${baseUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`

      const res = await wcFetch(url, authHeader)

      if (res.status === 401 || res.status === 403) {
        throw new Error('WooCommerce API rejected the credentials. Check your Consumer Key and Consumer Secret.')
      }
      if (!res.ok) {
        throw new Error(`WooCommerce API returned ${res.status} ${res.statusText}`)
      }

      const products: WCProduct[] = await res.json()
      if (products.length === 0) break

      for (const product of products) {
        if (!productMatchesFilter(product)) continue

        if (!product.sku?.trim()) {
          if (product.type === 'variable') {
            try {
              await syncVariations(product)
            } catch (err: unknown) {
              errors.push(
                `Failed to fetch variations for product "${product.name}": ${
                  err instanceof Error ? err.message : 'unknown error'
                }`
              )
            }
          }
          continue
        }

        try {
          await updateInventoryBySku(product.sku, product.stock_quantity, product.manage_stock, product.name)
        } catch (err: unknown) {
          errors.push(
            `Failed to update SKU "${product.sku}": ${err instanceof Error ? err.message : 'unknown error'}`
          )
        }
      }

      if (products.length < 100) break
      page++
    }

    // Persist unknown SKUs to PocketBase for user review.
    for (const unknownEntry of unknownSkus) {
      try {
        const existing = await pb
          .collection('wcUnknownSkus')
          .getFirstListItem(`sku = "${unknownEntry.sku}"`, { requestKey: null })
          .catch(() => null)

        if (existing) {
          await pb.collection('wcUnknownSkus').update(existing.id, {
            productName: unknownEntry.productName,
            wcStock: unknownEntry.wcStock,
            seenAt: syncTimestamp,
          })
        } else {
          await pb.collection('wcUnknownSkus').create({
            sku: unknownEntry.sku,
            productName: unknownEntry.productName,
            wcStock: unknownEntry.wcStock,
            seenAt: syncTimestamp,
            dismissed: false,
          })
        }
      } catch (err: unknown) {
        errors.push(
          `Failed to record unknown SKU "${unknownEntry.sku}": ${err instanceof Error ? err.message : 'unknown error'}`
        )
      }
    }

    // Write inventory snapshots for forecasting.
    // One record per evaluated SKU per sync run, tagged 'inventory_snapshot'
    // so forecasting can build an absolute stock time-series separate from delta records.
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

    // --- Sales history sync (last 90 days of completed orders) ---
    const salesCutoff = new Date()
    salesCutoff.setMonth(salesCutoff.getMonth() - 3)
    const salesCutoffIso = salesCutoff.toISOString().replace(/\.\d{3}Z$/, '')

    const rawSalesLines: Array<{ sku: string; saleDate: string; quantity: number; lineTotal: number }> = []
    let ordersPage = 1

    while (true) {
      const url =
        `${baseUrl}/wp-json/wc/v3/orders?per_page=100&page=${ordersPage}&status=completed&after=${encodeURIComponent(salesCutoffIso)}`
      const res = await wcFetch(url, authHeader).catch((err: unknown) => {
        errors.push(`Sales history fetch failed (page ${ordersPage}): ${err instanceof Error ? err.message : 'unknown error'}`)
        return null
      })

      if (!res) break
      if (!res.ok) {
        errors.push(`WooCommerce orders API returned ${res.status} on page ${ordersPage} — skipping sales history`)
        break
      }

      const orders: WCOrder[] = await res.json()
      if (orders.length === 0) break

      for (const order of orders) {
        const saleDate = order.date_created?.split('T')[0]
        if (!saleDate) continue
        for (const item of order.line_items ?? []) {
          if (!item.sku?.trim()) continue
          rawSalesLines.push({
            sku: item.sku,
            saleDate,
            quantity: item.quantity ?? 0,
            lineTotal: parseFloat(item.total ?? '0') || 0,
          })
        }
      }

      if (orders.length < 100) break
      ordersPage++
    }

    const salesEntries = aggregateSalesEntries(rawSalesLines, 'woocommerce')
    const salesResult = await upsertSalesEntries(pb, salesEntries).catch((err: unknown) => ({
      upserted: 0,
      errors: [`Sales data upsert failed: ${err instanceof Error ? err.message : 'unknown error'}`],
    }))
    errors.push(...salesResult.errors)

    return { recordsImported, salesImported: salesResult.upserted, errors, unknownSkuCount: unknownSkus.length }
  },
}
