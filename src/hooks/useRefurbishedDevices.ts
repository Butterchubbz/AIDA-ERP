import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import { viteEnv } from '../lib/env';
import type { RefurbishedDevice } from '../types/refurbished';

export const useRefurbishedDevices = () => {
  const [devices, setDevices] = useState<RefurbishedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'refurbishedDevices' collection
      // Prefer server-side sorting by 'sortOrder' if available, fallback to unsorted
      const records = await pb.collection('refurbishedDevices').getFullList({ sort: 'sortOrder' });
      const typed = records as unknown as RefurbishedDevice[];
      // Ensure we have a stable order even if sortOrder is missing
      typed.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setDevices(typed);
    } catch (err) {
      setError('Failed to fetch refurbished devices. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const addDevice = useCallback(
    async (data: Partial<RefurbishedDevice>) => {
      setLoading(true);
      try {
        // Add item to PocketBase 'refurbishedDevices' collection
        await pb.collection('refurbishedDevices').create(data);
        await fetchDevices(); // Re-fetch all data after add
      } catch (err) {
        setError('Failed to add device.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchDevices]
  );

  const updateDevice = useCallback(
    async (id: string, data: Partial<RefurbishedDevice>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'refurbishedDevices' collection
        await pb.collection('refurbishedDevices').update(id, data);
        await fetchDevices(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update device.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchDevices]
  );

  const deleteDevice = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // Delete item from PocketBase 'refurbishedDevices' collection
        await pb.collection('refurbishedDevices').delete(id);
        await fetchDevices(); // Re-fetch all data after delete
      } catch (err) {
        setError('Failed to delete device.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchDevices]
  );

  const reorderDevices = useCallback(
    async (newOrder: RefurbishedDevice[]) => {
      setLoading(true);
      try {
        // Persist sortOrder for each item sequentially. If PocketBase supports batch updates,
        // that would be preferable, but we update one-by-one for simplicity.
        for (let i = 0; i < newOrder.length; i++) {
          const item = newOrder[i];
          const sortOrder = i + 1;
          // Only update if different to reduce writes
          if (!item.id) continue;
          if ((item.sortOrder ?? 0) !== sortOrder) {
            await pb.collection('refurbishedDevices').update(item.id, { sortOrder });
          }
        }
        await fetchDevices();
      } catch (err) {
        setError('Failed to persist device order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchDevices]
  );

  const fetchDeviceHistory = useCallback(async (id: string) => {
    // This is a placeholder. You'll need to define how history is stored in PocketBase.
    // For example, you might have a 'deviceHistory' collection with a relation to 'refurbishedDevices'.
  if (viteEnv.VITE_DEBUG === 'true') console.log(`Fetching device history for ID: ${id}`);
    // Example: const historyRecords = await pb.collection('deviceHistory').getFullList({ filter: `itemId = "${id}"` });
    // return historyRecords;
    return []; // Return empty array for now
  }, []);

  return {
    devices,
    loading,
    error,
    addDevice,
    updateDevice,
    deleteDevice,
    fetchDeviceHistory,
    reorderDevices,
  };
};
