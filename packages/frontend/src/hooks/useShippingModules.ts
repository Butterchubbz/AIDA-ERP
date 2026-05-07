import { useState, useEffect, useCallback } from 'react'
import { pb } from '../lib/pocketbase'
import { COLLECTIONS } from '../lib/collections'
import type { Shipment } from '@aida/shared'
import type { InboundShipment, InboundShipmentItem } from '@aida/shared'
import type { AmazonPO } from '@aida/shared'
import type { AmazonItem } from '@aida/shared'
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from '../lib/pocketbaseApi'

function logUnknownError(message: string, error: unknown) {
  console.error(message, error)
}

/** Loads outbound shipment records and exposes a refresh handler. */
export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listRecords<Shipment>(COLLECTIONS.SHIPMENTS)
      setShipments(records)
    } catch (error: unknown) {
      setError('Failed to fetch shipments.')
      logUnknownError('Failed to fetch shipments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchShipments() }, [fetchShipments])

  return { shipments, loading, error, refetch: fetchShipments }
}

function parseInboundItems(value: unknown): InboundShipmentItem[] {
  if (Array.isArray(value)) return value as InboundShipmentItem[]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function mapInboundShipment(record: Record<string, unknown>): InboundShipment {
  return {
    id: String(record.id ?? ''),
    poNumber: String(record.poNumber ?? ''),
    trackingNumber: String(record.trackingNumber ?? ''),
    vendor: String(record.vendor ?? ''),
    shipmentType: String(record.shipmentType ?? ''),
    status: String(record.status ?? 'In Transit'),
    notes: String(record.notes ?? ''),
    items: parseInboundItems(record.items),
    customsDocsDownloaded: Boolean(record.customsDocsDownloaded ?? false),
    importAgentEmailed: Boolean(record.importAgentEmailed ?? false),
    spreadsheetsUpdated: Boolean(record.spreadsheetsUpdated ?? false),
    timestamp: record.timestamp ? String(record.timestamp) : undefined,
    created: record.created ? String(record.created) : undefined,
    updated: record.updated ? String(record.updated) : undefined,
    collectionId: record.collectionId ? String(record.collectionId) : undefined,
    collectionName: record.collectionName ? String(record.collectionName) : undefined,
  }
}

/** Manages inbound shipments, SKU search, and inventory push operations. */
export function useInboundShipments() {
  const [inboundShipments, setInboundShipments] = useState<InboundShipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInboundShipments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listRecords<Record<string, unknown>>(COLLECTIONS.INBOUND_SHIPMENTS)
      setInboundShipments(
        records.map(mapInboundShipment)
      )
    } catch (error: unknown) {
      setError('Failed to fetch inbound shipments. Please try again.')
      logUnknownError('Failed to fetch inbound shipments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInboundShipments() }, [fetchInboundShipments])

  const addInboundShipment = useCallback(
    async (data: Partial<InboundShipment>) => {
      setLoading(true)
      try {
        await createRecord(COLLECTIONS.INBOUND_SHIPMENTS, data)
        await fetchInboundShipments()
      } catch (error: unknown) {
        setError('Failed to add inbound shipment.')
        logUnknownError('Failed to add inbound shipment:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchInboundShipments]
  )

  const updateInboundShipment = useCallback(
    async (id: string, data: Partial<InboundShipment>) => {
      setLoading(true)
      try {
        await updateRecord(COLLECTIONS.INBOUND_SHIPMENTS, id, data)
        await fetchInboundShipments()
      } catch (error: unknown) {
        setError('Failed to update inbound shipment.')
        logUnknownError('Failed to update inbound shipment:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchInboundShipments]
  )

  const deleteInboundShipment = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        await deleteRecord(COLLECTIONS.INBOUND_SHIPMENTS, id)
        await fetchInboundShipments()
      } catch (error: unknown) {
        setError('Failed to delete inbound shipment.')
        logUnknownError('Failed to delete inbound shipment:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchInboundShipments]
  )

  const searchSKU = useCallback(async (q: string): Promise<{ sku: string; name: string }[]> => {
    if (!q.trim()) return []
    try {
      const [devices, components] = await Promise.all([
        pb.collection(COLLECTIONS.INVENTORY_DEVICE)
          .getFullList({ filter: `sku ~ "${q}" || name ~ "${q}"`, fields: 'id,sku,name' }),
        pb.collection(COLLECTIONS.INVENTORY_COMPONENT)
          .getFullList({ filter: `sku ~ "${q}" || name ~ "${q}"`, fields: 'id,sku,name' }),
      ])
      return [...devices, ...components].map(r => ({
        sku: String((r as Record<string, unknown>).sku ?? ''),
        name: String((r as Record<string, unknown>).name ?? ''),
      }))
    } catch (error: unknown) {
      logUnknownError('searchSKU failed:', error)
      return []
    }
  }, [])

  const pushShipmentToInventory = useCallback(
    async (shipmentId: string): Promise<string | undefined> => {
      // Fetch the shipment record
      const raw = await getRecord<Record<string, unknown>>(COLLECTIONS.INBOUND_SHIPMENTS, shipmentId)
      const shipment = mapInboundShipment(raw)

      if (shipment.status === 'Complete') {
        throw new Error('Shipment has already been pushed to inventory.')
      }

      const items = parseInboundItems(shipment.items)
      if (items.length === 0) {
        throw new Error('Shipment has no items to push.')
      }

      let successCount = 0
      const failedItems: string[] = []

      for (const item of items) {
        if (item.pushed) continue
        try {
          let targetId: string | null = null
          let targetCollection: string | null = null
          let currentStock = 0
          let stockField = 'warehouseStock'

          const deviceResults = await pb
            .collection(COLLECTIONS.INVENTORY_DEVICE)
            .getFullList({ filter: `sku = "${item.sku}"`, fields: 'id,warehouseStock' })

          if (deviceResults.length > 0) {
            const rec = deviceResults[0] as unknown as Record<string, unknown>
            targetId = String(rec.id)
            targetCollection = COLLECTIONS.INVENTORY_DEVICE
            currentStock = Number(rec.warehouseStock ?? 0)
            stockField = 'warehouseStock'
          } else {
            const componentResults = await pb
              .collection(COLLECTIONS.INVENTORY_COMPONENT)
              .getFullList({ filter: `sku = "${item.sku}"`, fields: 'id,countedStock' })

            if (componentResults.length > 0) {
              const rec = componentResults[0] as unknown as Record<string, unknown>
              targetId = String(rec.id)
              targetCollection = COLLECTIONS.INVENTORY_COMPONENT
              currentStock = Number(rec.countedStock ?? 0)
              stockField = 'countedStock'
            }
          }

          if (!targetId || !targetCollection) {
            failedItems.push(item.sku)
            continue
          }

          const newStock = currentStock + item.quantity
          await pb.collection(targetCollection).update(targetId, { [stockField]: newStock })

          try {
            await pb.collection(COLLECTIONS.STOCK_HISTORY).create({
              inventoryItemId: targetId,
              field: stockField,
              oldValue: currentStock,
              newValue: newStock,
              change: item.quantity,
              operation: 'inbound_push',
            })
          } catch (error: unknown) {
            logUnknownError('stock history write failed:', error)
          }

          successCount++
        } catch (error: unknown) {
          logUnknownError(`Failed to push item ${item.sku}:`, error)
          failedItems.push(item.sku)
        }
      }

      // Mark shipment as Complete
      await updateRecord(COLLECTIONS.INBOUND_SHIPMENTS, shipmentId, { status: 'Complete' })
      await fetchInboundShipments()

      if (successCount === 0 && items.length > 0) {
        throw new Error(
          `Failed to push all items: ${failedItems.join(', ')}`
        )
      }

      if (failedItems.length > 0) {
        return `Pushed ${successCount} items successfully. Failed: ${failedItems.join(', ')}`
      }

      return undefined
    },
    [fetchInboundShipments]
  )

  return {
    inboundShipments,
    loading,
    error,
    addInboundShipment,
    updateInboundShipment,
    deleteInboundShipment,
    pushShipmentToInventory,
    searchSKU,
  }
}

/** Loads and mutates Amazon purchase orders stored in PocketBase. */
export function useAmazonPOs() {
  const [purchaseOrders, setPurchaseOrders] = useState<AmazonPO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPurchaseOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listRecords<AmazonPO>(COLLECTIONS.AMAZON_POS)
      setPurchaseOrders(records)
    } catch (error: unknown) {
      setError('Failed to fetch purchase orders. Please try again.')
      logUnknownError('Failed to fetch purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPurchaseOrders() }, [fetchPurchaseOrders])

  const addPurchaseOrder = useCallback(
    async (data: AmazonPO) => {
      setLoading(true)
      try {
        await createRecord(COLLECTIONS.AMAZON_POS, data)
        await fetchPurchaseOrders()
      } catch (error: unknown) {
        setError('Failed to add purchase order.')
        logUnknownError('Failed to add purchase order:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchPurchaseOrders]
  )

  const updatePurchaseOrder = useCallback(
    async (id: string, data: Partial<AmazonPO>) => {
      setLoading(true)
      try {
        await updateRecord(COLLECTIONS.AMAZON_POS, id, data)
        await fetchPurchaseOrders()
      } catch (error: unknown) {
        setError('Failed to update purchase order.')
        logUnknownError('Failed to update purchase order:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchPurchaseOrders]
  )

  const deletePurchaseOrder = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        await deleteRecord(COLLECTIONS.AMAZON_POS, id)
        await fetchPurchaseOrders()
      } catch (error: unknown) {
        setError('Failed to delete purchase order.')
        logUnknownError('Failed to delete purchase order:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchPurchaseOrders]
  )

  return {
    purchaseOrders,
    loading,
    error,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  }
}

/** Exposes the Amazon-processing inventory view over device inventory records. */
export function useAmazonInventory() {
  const [amazonInventory, setAmazonInventory] = useState<AmazonItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAmazonInventory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listRecords<AmazonItem>(COLLECTIONS.INVENTORY_DEVICE)
      setAmazonInventory(records)
    } catch (error: unknown) {
      setError('Failed to fetch Amazon inventory. Please try again.')
      logUnknownError('Failed to fetch Amazon inventory:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAmazonInventory() }, [fetchAmazonInventory])

  const updateAmazonItem = useCallback(
    async (id: string, data: Partial<AmazonItem>) => {
      setLoading(true)
      try {
        await updateRecord(COLLECTIONS.INVENTORY_DEVICE, id, data)
        await fetchAmazonInventory()
      } catch (error: unknown) {
        setError('Failed to update Amazon item.')
        logUnknownError('Failed to update Amazon item:', error)
      } finally {
        setLoading(false)
      }
    },
    [fetchAmazonInventory]
  )

  const fetchAmazonItemHistory = useCallback(async (_id: string) => {
    return []
  }, [])

  return { amazonInventory, loading, error, updateAmazonItem, fetchAmazonItemHistory }
}
