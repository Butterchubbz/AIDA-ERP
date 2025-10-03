import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import type { InventoryItem } from '../types/inventory';

interface FetchOptions {
  sort?: string;
  filter?: string;
}

export const useInventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async (options: FetchOptions = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { sort = '-created', filter } = options;
      const requestOptions: { sort: string; filter?: string } = { sort };
      if (filter) {
        requestOptions.filter = filter;
      }
      const records = await pb
        .collection('inventoryDevice')
        .getFullList<InventoryItem>(requestOptions);
      setInventory(records);
    } catch (err) {
      setError('Failed to fetch inventory. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const addInventoryItem = useCallback(
    async (data: Partial<InventoryItem>) => {
      setLoading(true);
      try {
        await pb.collection('inventoryDevice').create(data);
        await fetchInventory(); // Refetch with default options
      } catch (err) {
        setError('Failed to add inventory item.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchInventory]
  );

  const updateInventoryItem = useCallback(
    async (id: string, data: Partial<InventoryItem>) => {
      setLoading(true);
      try {
        await pb.collection('inventoryDevice').update(id, data);
        await fetchInventory(); // Refetch with default options
      } catch (err) {
        setError('Failed to update inventory item.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchInventory]
  );

  const deleteInventoryItem = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await pb.collection('inventoryDevice').delete(id);
        await fetchInventory(); // Refetch with default options
      } catch (err) {
        setError('Failed to delete inventory item.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchInventory]
  );

  return {
    inventory,
    loading,
    error,
    refetch: fetchInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
  };
};
