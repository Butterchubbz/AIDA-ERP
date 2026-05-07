import { useCollectionCrud } from './useCollectionCrud';
import { COLLECTIONS } from '../lib/collections';
import type { RMAItem } from '@aida/shared';

export const useRMAs = () => {
  const { items, loading, error, refetch } = useCollectionCrud<RMAItem>({
    collection: COLLECTIONS.RMA_ENTRIES,
    fetchErrorMessage: 'Failed to fetch RMAs.',
  });

  return { rmas: items, loading, error, refetch };
};
