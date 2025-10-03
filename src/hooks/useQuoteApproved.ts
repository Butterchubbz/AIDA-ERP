import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import type { Order } from '../types/order';

export const useQuoteApproved = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'quoteApprovedOrders' collection
      const records = await pb.collection('quoteApprovedOrders').getFullList();
      setOrders(records as unknown as Order[]);
    } catch (err) {
      setError('Failed to fetch orders. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const addOrder = useCallback(
    async (data: Partial<Order>) => {
      setLoading(true);
      try {
        // Add item to PocketBase 'quoteApprovedOrders' collection
        await pb.collection('quoteApprovedOrders').create(data);
        await fetchOrders(); // Re-fetch all data after add
      } catch (err) {
        setError('Failed to add order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchOrders]
  );

  const updateOrder = useCallback(
    async (id: string, data: Partial<Order>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'quoteApprovedOrders' collection
        await pb.collection('quoteApprovedOrders').update(id, data);
        await fetchOrders(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchOrders]
  );

  const deleteOrder = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // Delete item from PocketBase 'quoteApprovedOrders' collection
        await pb.collection('quoteApprovedOrders').delete(id);
        await fetchOrders(); // Re-fetch all data after delete
      } catch (err) {
        setError('Failed to delete order.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchOrders]
  );

  return { orders, loading, error, addOrder, updateOrder, deleteOrder };
};
