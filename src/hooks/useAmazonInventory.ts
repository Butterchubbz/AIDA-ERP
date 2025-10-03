import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import { viteEnv } from '../lib/env';
import type { AmazonItem } from '../types/amazon';

export const useAmazonInventory = () => {
  const [amazonInventory, setAmazonInventory] = useState<AmazonItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAmazonInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'amazonInventory' collection
      const records = await pb.collection('inventoryDevice').getFullList();
      setAmazonInventory(records as unknown as AmazonItem[]);
    } catch (err) {
      setError('Failed to fetch Amazon inventory. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAmazonInventory();
  }, [fetchAmazonInventory]);

  const updateAmazonItem = useCallback(
    async (id: string, data: Partial<AmazonItem>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'amazonInventory' collection
        await pb.collection('inventoryDevice').update(id, data);
        await fetchAmazonInventory(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update Amazon item.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchAmazonInventory]
  );

  const fetchAmazonItemHistory = useCallback(async (id: string) => {
    // This is a placeholder. You'll need to define how history is stored in PocketBase.
    // For example, you might have a 'amazonItemHistory' collection with a relation to 'amazonInventory'.
  // Debug logging gated via typed env helper
  if (viteEnv.VITE_DEBUG === 'true') console.log(`Fetching Amazon item history for ID: ${id}`);
    // Example: const historyRecords = await pb.collection('amazonItemHistory').getFullList({ filter: `itemId = "${id}"` });
    // return historyRecords;
    return []; // Return empty array for now
  }, []);

  return { amazonInventory, loading, error, updateAmazonItem, fetchAmazonItemHistory };
};
