import { useCallback } from 'react';
import type { RMAEntry } from '@aida/shared';
import { useCollectionCrud } from './useCollectionCrud';

export const useRMATracker = () => {
  const { items, loading, error, createItem, updateItem, removeItem } = useCollectionCrud<RMAEntry>({
    collection: 'rma/tickets',
    fetchErrorMessage: 'Failed to fetch RMA entries. Please try again.',
    addErrorMessage: 'Failed to add RMA entry.',
    updateErrorMessage: 'Failed to update RMA entry.',
    deleteErrorMessage: 'Failed to delete RMA entry.',
  });

  const addRMAEntry = useCallback(
    async (data: Partial<RMAEntry>) => {
      await createItem(data);
    },
    [createItem]
  );

  const updateRMAEntry = useCallback(
    async (id: string, data: Partial<RMAEntry>) => {
      await updateItem(id, data);
    },
    [updateItem]
  );

  const updateRMAStatus = useCallback(
    async (id: string, newStatus: string) => {
      await updateItem(id, { status: newStatus } as Partial<RMAEntry>);
    },
    [updateItem]
  );

  const deleteRMAEntry = useCallback(
    async (id: string) => {
      await removeItem(id);
    },
    [removeItem]
  );

  return {
    rmaEntries: items,
    loading,
    rmaError: error, // Renamed error to rmaError to match RMATrackerView
    addRMAEntry,
    updateRMAEntry,
    updateRMAStatus,
    deleteRMAEntry,
  };
};
