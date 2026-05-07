import { useState, useEffect, useCallback } from 'react'
import { COLLECTIONS } from '../lib/collections'
import type { DeviceItem } from '@aida/shared'
import type { ComponentItem } from '@aida/shared'
import {
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
  type CollectionName,
} from '../lib/pocketbaseApi'

interface BaseInventoryItem {
  id: string
  name: string
  sku: string
  created?: string
  updated?: string
}

interface CreateInventoryHookOptions<T extends BaseInventoryItem> {
  collectionName: CollectionName
  stockField: keyof T
  defaultSort?: string
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
        const records = await listRecords<T>(options.collectionName, {
          sort: options.defaultSort ?? '-created',
        })
        setItems(records)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch items'
        setError(msg)
        console.error(`[${options.collectionName}] fetch failed:`, msg)
      } finally {
        setLoading(false)
      }
    }, [options.collectionName, options.defaultSort])

    useEffect(() => {
      fetchItems()
    }, [fetchItems])

    const addItem = useCallback(
      async (data: Partial<T>) => {
        setLoading(true)
        try {
          const record = await createRecord<T>(options.collectionName, data)
          setItems(prev => [...prev, record])
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to add'
          setError(msg)
          console.error(`[${options.collectionName}] add failed:`, msg)
          throw err
        } finally {
          setLoading(false)
        }
      },
      [options.collectionName]
    )

    const updateItem = useCallback(
      async (id: string, data: Partial<T>) => {
        try {
          const result = await updateRecord<T>(options.collectionName, id, data)
          setItems(prev => prev.map(item => (item.id === id ? result : item)))

          if (options.stockField in data) {
            const oldItem = items.find(i => i.id === id)
            const oldValue = oldItem ? Number(oldItem[options.stockField]) : 0
            const newValue = Number(data[options.stockField])
            try {
              await createRecord(COLLECTIONS.STOCK_HISTORY, {
                inventoryItemId: id,
                field: String(options.stockField),
                oldValue,
                newValue,
                change: newValue - oldValue,
                operation: 'manual_update',
              })
            } catch (historyErr: unknown) {
              console.error('stock history write failed:', historyErr)
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update'
          setError(msg)
          console.error(`[${options.collectionName}] update failed:`, msg)
          throw err
        }
      },
      [items, options.collectionName, options.stockField]
    )

    const deleteItem = useCallback(
      async (id: string) => {
        try {
          await deleteRecord(options.collectionName, id)
          setItems(prev => prev.filter(item => item.id !== id))
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to delete'
          setError(msg)
          throw err
        }
      },
      [options.collectionName]
    )

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
  collectionName: COLLECTIONS.INVENTORY_DEVICE,
  stockField: 'warehouseStock',
  defaultSort: '-updated',
})

const useComponentInventoryBase = createInventoryHook<ComponentItem>({
  collectionName: COLLECTIONS.INVENTORY_COMPONENT,
  stockField: 'countedStock',
  defaultSort: '-created',
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
