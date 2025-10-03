import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import type { RMAItem } from '../types/rma';

export const useRMAs = () => {
  const [rmas, setRMAs] = useState<RMAItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRMAs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection('rmaEntries').getFullList();
      setRMAs(records as unknown as RMAItem[]);
    } catch (err) {
      setError('Failed to fetch RMAs.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRMAs();
  }, [fetchRMAs]);

  return { rmas, loading, error, refetch: fetchRMAs };
};
