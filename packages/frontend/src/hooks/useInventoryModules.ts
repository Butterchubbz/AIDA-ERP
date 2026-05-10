import { useState, useEffect, useCallback } from 'react'
import type { DeviceItem } from '@aida/shared'
import type { ComponentItem } from '@aida/shared'
import type { AccessoryItem } from '@aida/shared'
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
  sortItems?: (items: T[]) => T[]
}

function sortInventoryBySku<T extends BaseInventoryItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const normalizedSkuCompare = a.sku.trim().toLowerCase().localeCompare(b.sku.trim().toLowerCase())
    if (normalizedSkuCompare !== 0) {
      return normalizedSkuCompare
    }

    const rawSkuCompare = a.sku.localeCompare(b.sku)
    if (rawSkuCompare !== 0) {
      return rawSkuCompare
    }

    const createdCompare = (a.created ?? '').localeCompare(b.created ?? '')
    if (createdCompare !== 0) {
      return createdCompare
    }

    return a.id.localeCompare(b.id)
  })
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
        setItems(options.sortItems ? options.sortItems(records) : records)
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
        setItems(prev => (options.sortItems ? options.sortItems([...prev, record]) : [...prev, record]))
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
          setItems(prev => {
            const updated = prev.map(item => (item.id === id ? result : item))
            return options.sortItems ? options.sortItems(updated) : updated
          })
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
  sortItems: sortInventoryBySku,
})

const useComponentInventoryBase = createInventoryHook<ComponentItem>({
  apiPath: 'inventory/components',
  stockField: 'countedStock',
  sortItems: sortInventoryBySku,
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

const useAccessoryInventoryBase = createInventoryHook<AccessoryItem>({
  apiPath: 'inventory/accessories',
  stockField: 'warehouseStock',
  sortItems: sortInventoryBySku,
})

export function useAccessoryInventory() {
  const base = useAccessoryInventoryBase()
  return {
    accessories: base.items,
    loading: base.loading,
    error: base.error,
    refetch: base.refetch,
    addAccessoryItem: base.addItem,
    updateAccessoryItem: base.updateItem,
    deleteAccessoryItem: base.deleteItem,
    batchUpdateAccessories: base.batchUpdate,
    setAccessories: base.setItems,
  }
}