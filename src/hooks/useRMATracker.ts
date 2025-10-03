import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import type { RMAEntry } from '../types/rma';

export const useRMATracker = () => {
  const [rmaEntries, setRmaEntries] = useState<RMAEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRMAEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'rmaEntries' collection
      const records = await pb.collection('rmaEntries').getFullList();
      setRmaEntries(records as unknown as RMAEntry[]);
    } catch (err) {
      setError('Failed to fetch RMA entries. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRMAEntries();
  }, [fetchRMAEntries]);

  const addRMAEntry = useCallback(
    async (data: Partial<RMAEntry>) => {
      setLoading(true);
      try {
        // Add item to PocketBase 'rmaEntries' collection
        await pb.collection('rmaEntries').create(data);
        await fetchRMAEntries(); // Re-fetch all data after add
      } catch (err) {
        setError('Failed to add RMA entry.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchRMAEntries]
  );

  const updateRMAEntry = useCallback(
    async (id: string, data: Partial<RMAEntry>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'rmaEntries' collection
        await pb.collection('rmaEntries').update(id, data);
        await fetchRMAEntries(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update RMA entry.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchRMAEntries]
  );

  const updateRMAStatus = useCallback(
    async (id: string, newStatus: string) => {
      setLoading(true);
      try {
        // Update status of an item in PocketBase 'rmaEntries' collection
        await pb.collection('rmaEntries').update(id, { status: newStatus });
        await fetchRMAEntries(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update RMA status.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchRMAEntries]
  );

  const deleteRMAEntry = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // Delete item from PocketBase 'rmaEntries' collection
        await pb.collection('rmaEntries').delete(id);
        await fetchRMAEntries(); // Re-fetch all data after delete
      } catch (err) {
        setError('Failed to delete RMA entry.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchRMAEntries]
  );

  return {
    rmaEntries,
    loading,
    rmaError: error, // Renamed error to rmaError to match RMATrackerView
    addRMAEntry,
    updateRMAEntry,
    updateRMAStatus,
    deleteRMAEntry,
  };
};
