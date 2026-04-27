import { useCallback, useEffect, useState } from 'react'
import type { RecordListOptions } from 'pocketbase'
import type { CollectionName } from '../lib/pocketbaseApi'
import { createRecord, deleteRecord, listRecords, updateRecord } from '../lib/pocketbaseApi'

interface UseCollectionCrudOptions<T> {
  collection: CollectionName
  listOptions?: RecordListOptions
  fetchErrorMessage: string
  addErrorMessage?: string
  updateErrorMessage?: string
  deleteErrorMessage?: string
  mapRecords?: (records: T[]) => T[]
}

export function useCollectionCrud<T>({
  collection,
  listOptions,
  fetchErrorMessage,
  addErrorMessage = 'Failed to add item.',
  updateErrorMessage = 'Failed to update item.',
  deleteErrorMessage = 'Failed to delete item.',
  mapRecords,
}: UseCollectionCrudOptions<T>) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const records = await listRecords<T>(collection, listOptions)
      setItems(mapRecords ? mapRecords(records) : records)
    } catch (err: unknown) {
      setError(fetchErrorMessage)
      console.error(fetchErrorMessage, err)
    } finally {
      setLoading(false)
    }
  }, [collection, fetchErrorMessage, listOptions, mapRecords])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const createItem = useCallback(
    async (data: Partial<T>) => {
      setLoading(true)
      try {
        await createRecord<T>(collection, data)
        await fetchItems()
      } catch (err: unknown) {
        setError(addErrorMessage)
        console.error(addErrorMessage, err)
      } finally {
        setLoading(false)
      }
    },
    [addErrorMessage, collection, fetchItems]
  )

  const updateItem = useCallback(
    async (id: string, data: Partial<T>) => {
      setLoading(true)
      try {
        await updateRecord<T>(collection, id, data)
        await fetchItems()
      } catch (err: unknown) {
        setError(updateErrorMessage)
        console.error(updateErrorMessage, err)
      } finally {
        setLoading(false)
      }
    },
    [collection, fetchItems, updateErrorMessage]
  )

  const removeItem = useCallback(
    async (id: string) => {
      setLoading(true)
      try {
        await deleteRecord(collection, id)
        await fetchItems()
      } catch (err: unknown) {
        setError(deleteErrorMessage)
        console.error(deleteErrorMessage, err)
      } finally {
        setLoading(false)
      }
    },
    [collection, deleteErrorMessage, fetchItems]
  )

  return {
    items,
    setItems,
    loading,
    error,
    refetch: fetchItems,
    createItem,
    updateItem,
    removeItem,
  }
}
