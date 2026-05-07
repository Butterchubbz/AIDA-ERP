import { useState, useEffect, useCallback } from 'react'
import type { DeviceItem } from '@aida/shared'
import type { ComponentItem } from '@aida/shared'
import { apiClient } from '../lib/apiClient'

interface BaseInventoryItem {
  id: string
  name: string
  sku: string
  created?: string
  updated?: string
}

interface CreateInventoryHookOptions<T extends BaseInventoryItem> {
  /** API sub-path under /api, e.g. 'inventory/devices' */
  apiPath: string
  stockField: keyof T
}

function createInventoryHook<T extends BaseInventoryItem>(options: CreateInventoryHookOptions<T>) {
  return function useInventoryHook() {
    const [items, setItems] = useState<T[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
        const records = await apiClient.get<T[]>(`/api/${options.apiPath}`)
        setItems(records)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch items'
        setError(msg)
        console.error(`[${options.apiPath}] fetch failed:`, msg)
      } finally {
        setLoading(false)
      }
    }, [])

    useEffect(() => {
      fetchItems()
    }, [fetchItems])

    const addItem = useCallback(async (data: Partial<T>) => {
      setLoading(true)
      try {
        const record = await apiClient.post<T>(`/api/${options.apiPath}`, data)
        setItems(prev => [...prev, record])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to add'
        setError(msg)
        console.error(`[${options.apiPath}] add failed:`, msg)
        throw err
      } finally {
        setLoading(false)
      }
    }, [])

    const updateItem = useCallback(
      async (id: string, data: Partial<T>) => {
        try {
          const result = await apiClient.patch<T>(`/api/${options.apiPath}/${id}`, data)
          setItems(prev => prev.map(item => (item.id === id ? result : item)))
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update'
          setError(msg)
          console.error(`[${options.apiPath}] update failed:`, msg)
          throw err
        }
      },
      []
    )

    const deleteItem = useCallback(async (id: string) => {
      try {
        await apiClient.delete(`/api/${options.apiPath}/${id}`)
        setItems(prev => prev.filter(item => item.id !== id))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to delete'
        setError(msg)
        throw err
      }
    }, [])

    const batchUpdate = useCallback(
      async (updates: { id: string; updatedFields: Partial<T> }[]) => {
        for (const { id, updatedFields } of updates) {
          await updateItem(id, updatedFields)
        }
      },
      [updateItem]
    )

    return {
      items,
      loading,
      error,
      refetch: fetchItems,
      addItem,
      updateItem,
      deleteItem,
      batchUpdate,
      setItems,
    }
  }
}

const useDeviceInventoryBase = createInventoryHook<DeviceItem>({
  apiPath: 'inventory/devices',
  stockField: 'warehouseStock',
})

const useComponentInventoryBase = createInventoryHook<ComponentItem>({
  apiPath: 'inventory/components',
  stockField: 'countedStock',
})

export function useDeviceInventory() {
  const base = useDeviceInventoryBase()
  return {
    devices: base.items,
    loading: base.loading,
    error: base.error,
    refetch: base.refetch,
    addDeviceItem: base.addItem,
    updateDeviceItem: base.updateItem,
    deleteDeviceItem: base.deleteItem,
    batchUpdateDevices: base.batchUpdate,
    setDevices: base.setItems,
  }
}

export function useComponentInventory() {
  const base = useComponentInventoryBase()
  return {
    componentInventory: base.items,
    loading: base.loading,
    componentError: base.error,
    refetch: base.refetch,
    addComponent: base.addItem,
    updateComponent: base.updateItem,
    deleteComponent: base.deleteItem,
    batchUpdateComponents: base.batchUpdate,
    setComponents: base.setItems,
  }
}