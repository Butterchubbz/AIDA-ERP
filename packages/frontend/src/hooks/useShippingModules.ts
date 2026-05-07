import { useState, useEffect, useCallback } from 'react'
import type { Shipment } from '@aida/shared'
import type { InboundShipment, InboundShipmentItem } from '@aida/shared'
import type { AmazonPO } from '@aida/shared'
import type { AmazonItem } from '@aida/shared'
import { apiClient } from '../lib/apiClient'

function logUnknownError(message: string, error: unknown) {
  console.error(message, error)
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

/** Loads outbound shipment records and exposes a refresh handler. */
export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await apiClient.get<Shipment[]>('/api/shipments')
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

/** Manages inbound shipments, SKU search, and inventory push operations. */
export function useInboundShipments() {
  const [inboundShipments, setInboundShipments] = useState<InboundShipment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInboundShipments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await apiClient.get<InboundShipment[]>('/api/shipments/inbound')
      setInboundShipments(
        records.map(r => ({ ...r, items: parseInboundItems(r.items) }))
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
        await apiClient.post('/api/shipments/inbound', data)
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
        await apiClient.patch(`/api/shipments/inbound/${id}`, data)
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
        await apiClient.delete(`/api/shipments/inbound/${id}`)
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

  /** Search inventory SKUs/names across devices and components via backend. */
  const searchSKU = useCallback(async (q: string): Promise<{ sku: string; name: string }[]> => {
    if (!q.trim()) return []
    try {
      return await apiClient.get<{ sku: string; name: string }[]>(
        `/api/inventory/search?q=${encodeURIComponent(q)}`
      )
    } catch (error: unknown) {
      logUnknownError('searchSKU failed:', error)
      return []
    }
  }, [])

  /**
   * Pushes all items in a shipment to inventory stock. The backend handles
   * the multi-step operation atomically and marks the shipment Complete.
   * Returns a partial-failure warning string if some SKUs were skipped.
   */
  const pushShipmentToInventory = useCallback(
    async (shipmentId: string): Promise<string | undefined> => {
      const res = await apiClient.post<{ warning?: string }>(
        `/api/shipments/inbound/${shipmentId}/push`
      )
      await fetchInboundShipments()
      return res?.warning
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

/** Loads and mutates Amazon purchase orders. */
export function useAmazonPOs() {
  const [purchaseOrders, setPurchaseOrders] = useState<AmazonPO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPurchaseOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await apiClient.get<AmazonPO[]>('/api/amazon/pos')
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
        await apiClient.post('/api/amazon/pos', data)
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
        await apiClient.patch(`/api/amazon/pos/${id}`, data)
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
        await apiClient.delete(`/api/amazon/pos/${id}`)
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
      const records = await apiClient.get<AmazonItem[]>('/api/inventory/devices')
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
        await apiClient.patch(`/api/inventory/devices/${id}`, data)
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