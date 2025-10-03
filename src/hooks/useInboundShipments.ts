import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import { viteEnv } from '../lib/env';
import type { InboundShipment } from '../types/inbound';

export const useInboundShipments = () => {
  const [inboundShipments, setInboundShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInboundShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch data from PocketBase 'inboundShipments' collection
      const records = await pb.collection('inboundShipments').getFullList();
      setInboundShipments(records as unknown as InboundShipment[]);
    } catch (err) {
      setError('Failed to fetch inbound shipments. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInboundShipments();
  }, [fetchInboundShipments]);

  const addInboundShipment = useCallback(
    async (data: Partial<InboundShipment>) => {
      setLoading(true);
      try {
        // Add item to PocketBase 'inboundShipments' collection
        await pb.collection('inboundShipments').create(data);
        await fetchInboundShipments(); // Re-fetch all data after add
      } catch (err) {
        setError('Failed to add inbound shipment.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchInboundShipments]
  );

  const updateInboundShipment = useCallback(
    async (id: string, data: Partial<InboundShipment>) => {
      setLoading(true);
      try {
        // Update item in PocketBase 'inboundShipments' collection
        await pb.collection('inboundShipments').update(id, data);
        await fetchInboundShipments(); // Re-fetch all data after update
      } catch (err) {
        setError('Failed to update inbound shipment.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchInboundShipments]
  );

  const deleteInboundShipment = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        // Delete item from PocketBase 'inboundShipments' collection
        await pb.collection('inboundShipments').delete(id);
        await fetchInboundShipments(); // Re-fetch all data after delete
      } catch (err) {
        setError('Failed to delete inbound shipment.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchInboundShipments]
  );

  const pushShipmentToInventory = useCallback(
    async (shipmentId: string) => {
      // This is a placeholder. You'll need to implement the logic to:
      // 1. Fetch the specific shipment by shipmentId.
      // 2. Iterate through its items.
      // 3. For each item, update the corresponding inventory (e.g., 'inventory' or 'componentsInventory' collection).
      // 4. Mark the item as 'pushed' in the shipment record.
  if (viteEnv.VITE_DEBUG === 'true') console.log(`Pushing shipment ${shipmentId} to inventory (placeholder).`);
      // Example:
      // const shipment = await pb.collection('inboundShipments').getOne(shipmentId);
      // for (const item of shipment.items) {
      //   // Find existing inventory item by SKU and update quantity
      //   const existingInventory = await pb.collection('inventory').getFirstListItem(`sku = "${item.sku}"`);
      //   if (existingInventory) {
      //     await pb.collection('inventory').update(existingInventory.id, { quantity: existingInventory.quantity + item.quantity });
      //   } else {
      //     // Or create new inventory item
      //   }
      //   // Mark item as pushed
      //   item.pushed = true;
      // }
      // await pb.collection('inboundShipments').update(shipmentId, { items: shipment.items });
      await fetchInboundShipments(); // Re-fetch all data after push
    },
    [fetchInboundShipments]
  );

  const searchSKU = useCallback(async (searchString: string) => {
    // This is a placeholder. You'll need to implement SKU search against your inventory collections.
  if (viteEnv.VITE_DEBUG === 'true') console.log(`Searching SKU: ${searchString} (placeholder).`);
    // Example: Search in 'inventory' and 'componentsInventory' collections
    // const inventoryResults = await pb.collection('inventory').getFullList({ filter: `sku ~ "${searchString}" || name ~ "${searchString}"` });
    // const componentResults = await pb.collection('componentsInventory').getFullList({ filter: `sku ~ "${searchString}" || name ~ "${searchString}"` });
    // return [...inventoryResults, ...componentResults];
    return [{ sku: searchString, name: `Dummy Item for ${searchString}` }]; // Return dummy data for now
  }, []);

  return {
    inboundShipments,
    loading,
    error,
    addInboundShipment,
    updateInboundShipment,
    deleteInboundShipment,
    pushShipmentToInventory,
    searchSKU,
  };
};
