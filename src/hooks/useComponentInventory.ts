import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import { viteEnv } from '../lib/env';
import type { ComponentItem } from '../types/component';

export const useComponentInventory = () => {
  const [componentInventory, setComponentInventory] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComponentInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'componentsInventory' collection
      const records = await pb.collection('inventoryComponent').getFullList();
      setComponentInventory(records as unknown as ComponentItem[]);
    } catch (err) {
      setError('Failed to fetch component inventory. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchComponentInventory();
  }, [fetchComponentInventory]);

  const addComponent = useCallback(
    async (data: ComponentItem) => {
      setLoading(true);
      try {
        // Add item to PocketBase 'componentsInventory' collection
        await pb.collection('inventoryComponent').create(data);
        await fetchComponentInventory(); // Re-fetch all data after add
      } catch (err) {
        setError('Failed to add component.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchComponentInventory]
  );

  const updateComponent = useCallback(
    async (id: string, data: Partial<ComponentItem>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'componentsInventory' collection
        await pb.collection('inventoryComponent').update(id, data);
        await fetchComponentInventory(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update component.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchComponentInventory]
  );

  const deleteComponent = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // Delete item from PocketBase 'componentsInventory' collection
        await pb.collection('inventoryComponent').delete(id);
        await fetchComponentInventory(); // Re-fetch all data after delete
      } catch (err) {
        setError('Failed to delete component.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchComponentInventory]
  );

  const batchUpdateComponents = useCallback(
    async (updates: { id: string; updatedFields: Partial<ComponentItem> }[]) => {
      setLoading(true);
      try {
        // PocketBase does not have a direct batch update function like Firebase.
        // You'll need to loop through updates and call pb.collection().update() for each.
        // For performance, consider using Promise.allSettled if many updates. (Not implemented here for simplicity)
        const promises = updates.map(update =>
          pb.collection('inventoryComponent').update(update.id, update.updatedFields)
        );
        await Promise.allSettled(promises);
        await fetchComponentInventory(); // Re-fetch all data after batch update
      } catch (err) {
        setError('Failed to batch update components.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchComponentInventory]
  );

  const fetchComponentHistory = useCallback(async (id: string) => {
    // This is a placeholder. You'll need to define how history is stored in PocketBase.
    // For example, you might have a 'componentHistory' collection with a relation to 'componentsInventory'.
  if (viteEnv.VITE_DEBUG === 'true') console.log(`Fetching component history for ID: ${id}`);
    // Example: const historyRecords = await pb.collection('componentHistory').getFullList({ filter: `itemId = "${id}"` });
    // return historyRecords;
    return []; // Return empty array for now
  }, []);

  return {
    componentInventory,
    loading,
    componentError: error, // Renamed error to componentError to match DashboardView
    addComponent,
    updateComponent,
    deleteComponent,
    batchUpdateComponents,
    fetchComponentHistory,
  };
};
