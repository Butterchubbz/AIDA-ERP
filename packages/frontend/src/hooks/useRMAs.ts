import { useCollectionCrud } from './useCollectionCrud';
import type { RMAItem } from '@aida/shared';

export const useRMAs = () => {
  const { items, loading, error, refetch } = useCollectionCrud<RMAItem>({
    collection: 'rma/tickets',
    fetchErrorMessage: 'Failed to fetch RMAs.',
  });

  return { rmas: items, loading, error, refetch };
};
