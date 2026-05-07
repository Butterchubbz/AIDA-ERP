import { useCallback } from 'react';
import { COLLECTIONS } from '../lib/collections';
import type { RefurbishedDevice } from '@aida/shared';
import { updateRecord } from '../lib/pocketbaseApi';
import { useCollectionCrud } from './useCollectionCrud';

export const useRefurbishedDevices = () => {
  const {
    items,
    loading,
    error,
    createItem,
    updateItem,
    removeItem,
    refetch,
  } = useCollectionCrud<RefurbishedDevice>({
    collection: COLLECTIONS.REFURBISHED_DEVICES,
    listOptions: { sort: 'sortOrder' },
    fetchErrorMessage: 'Failed to fetch refurbished devices. Please try again.',
    addErrorMessage: 'Failed to add device.',
    updateErrorMessage: 'Failed to update device.',
    deleteErrorMessage: 'Failed to delete device.',
    mapRecords: records =>
      [...records].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  });

  const reorderDevices = useCallback(
    async (newOrder: RefurbishedDevice[]) => {
      try {
        for (let i = 0; i < newOrder.length; i++) {
          const item = newOrder[i];
          const sortOrder = i + 1;
          if (!item.id) continue;
          if ((item.sortOrder ?? 0) !== sortOrder) {
            await updateRecord<RefurbishedDevice>(COLLECTIONS.REFURBISHED_DEVICES, item.id, {
              sortOrder,
            });
          }
        }
        await refetch();
      } catch (error: unknown) {
        console.error('Failed to persist refurbished device order:', error);
      }
    },
    [refetch]
  );

  const fetchDeviceHistory = useCallback(async (_id: string) => {
    return [];
  }, []);

  return {
    devices: items,
    loading,
    error,
    addDevice: createItem,
    updateDevice: updateItem,
    deleteDevice: removeItem,
    fetchDeviceHistory,
    reorderDevices,
  };
};
