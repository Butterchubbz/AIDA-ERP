import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import type { Shipment } from '../types/shipment';

export const useShipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection('shipments').getFullList();
      setShipments(records as unknown as Shipment[]);
    } catch (err) {
      setError('Failed to fetch shipments.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return { shipments, loading, error, refetch: fetchShipments };
};
