import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import type { AmazonPO } from '../types/amazon';

export const useAmazonPOs = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<AmazonPO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'amazonPOs' collection
      const records = await pb.collection('amazonPOs').getFullList();
      setPurchaseOrders(records as unknown as AmazonPO[]);
    } catch (err) {
      setError('Failed to fetch purchase orders. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  const addPurchaseOrder = useCallback(
    async (data: AmazonPO) => {
      setLoading(true);
      try {
        // Add item to PocketBase 'amazonPOs' collection
        await pb.collection('amazonPOs').create(data);
        await fetchPurchaseOrders(); // Re-fetch all data after add
      } catch (err) {
        setError('Failed to add purchase order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchPurchaseOrders]
  );

  const updatePurchaseOrder = useCallback(
    async (id: string, data: Partial<AmazonPO>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'amazonPOs' collection
        await pb.collection('amazonPOs').update(id, data);
        await fetchPurchaseOrders(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update purchase order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchPurchaseOrders]
  );

  const deletePurchaseOrder = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // Delete item from PocketBase 'amazonPOs' collection
        await pb.collection('amazonPOs').delete(id);
        await fetchPurchaseOrders(); // Re-fetch all data after delete
      } catch (err) {
        setError('Failed to delete purchase order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchPurchaseOrders]
  );

  return {
    purchaseOrders,
    loading,
    error,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  };
};
