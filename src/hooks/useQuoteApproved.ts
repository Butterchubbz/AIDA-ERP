import { useCollectionCrud } from './useCollectionCrud';
import { COLLECTIONS } from '../lib/collections';
import type { Order } from '../types/order';

export const useQuoteApproved = () => {
  const { items, loading, error, createItem, updateItem, removeItem } = useCollectionCrud<Order>({
    collection: COLLECTIONS.QUOTE_APPROVED_ORDERS,
    fetchErrorMessage: 'Failed to fetch orders. Please try again.',
    addErrorMessage: 'Failed to add order.',
    updateErrorMessage: 'Failed to update order.',
    deleteErrorMessage: 'Failed to delete order.',
  });

  return {
    orders: items,
    loading,
    error,
    addOrder: createItem,
    updateOrder: updateItem,
    deleteOrder: removeItem,
  };
};
