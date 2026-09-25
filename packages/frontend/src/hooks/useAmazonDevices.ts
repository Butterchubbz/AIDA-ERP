import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../lib/apiClient'
import type { AmazonDevice, AmazonVariant, AmazonStockHistoryEntry } from '@aida/shared'

export interface AmazonVariantFull extends AmazonVariant {
  inboundQty: number
}

export interface AmazonDeviceFull extends AmazonDevice {
  variants: AmazonVariantFull[]
}

export interface EnrichedHistoryEntry extends AmazonStockHistoryEntry {
  variantLabel: string
  variantSku: string
}

export function useAmazonDevices() {
  const [devices, setDevices] = useState<AmazonDeviceFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<AmazonDeviceFull[]>('/api/amazon/devices')
      setDevices(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Amazon devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDevices()
  }, [fetchDevices])

  const addDevice = useCallback(
    async (body: { name: string; inventorySku: string; inventoryId?: string }) => {
      await apiClient.post('/api/amazon/devices', body)
      await fetchDevices()
    },
    [fetchDevices]
  )

  const updateDevice = useCallback(
    async (id: string, body: Partial<Pick<AmazonDevice, 'name' | 'inventorySku' | 'inventoryId'>>) => {
      await apiClient.patch(`/api/amazon/devices/${id}`, body)
      await fetchDevices()
    },
    [fetchDevices]
  )

  const deleteDevice = useCallback(
    async (id: string) => {
      await apiClient.delete(`/api/amazon/devices/${id}`)
      await fetchDevices()
    },
    [fetchDevices]
  )

  const addVariant = useCallback(
    async (
      deviceId: string,
      body: Pick<AmazonVariant, 'label' | 'sku'> &
        Partial<Pick<AmazonVariant, 'asin' | 'packSize' | 'lowStockThreshold'>>
    ) => {
      await apiClient.post(`/api/amazon/devices/${deviceId}/variants`, body)
      await fetchDevices()
    },
    [fetchDevices]
  )

  const updateVariant = useCallback(
    async (
      variantId: string,
      body: Partial<Pick<AmazonVariant, 'label' | 'sku' | 'asin' | 'packSize' | 'lowStockThreshold'>>
    ) => {
      await apiClient.patch(`/api/amazon/variants/${variantId}`, body)
      await fetchDevices()
    },
    [fetchDevices]
  )

  const deleteVariant = useCallback(
    async (variantId: string) => {
      await apiClient.delete(`/api/amazon/variants/${variantId}`)
      await fetchDevices()
    },
    [fetchDevices]
  )

  const adjustStock = useCallback(
    async (variantId: string, fbaStock: number, reason?: string) => {
      await apiClient.post(`/api/amazon/variants/${variantId}/stock`, { fbaStock, reason })
      await fetchDevices()
    },
    [fetchDevices]
  )

  const getDeviceHistory = useCallback(async (deviceId: string): Promise<EnrichedHistoryEntry[]> => {
    return apiClient.get<EnrichedHistoryEntry[]>(`/api/amazon/devices/${deviceId}/history`)
  }, [])

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
    addDevice,
    updateDevice,
    deleteDevice,
    addVariant,
    updateVariant,
    deleteVariant,
    adjustStock,
    getDeviceHistory,
  }
}
