import { useCallback } from 'react';
import { COLLECTIONS } from '../lib/collections';
import type { User } from '../types/user';
import { useCollectionCrud } from './useCollectionCrud';

export const useUsers = () => {
  const { items, loading, error, updateItem } = useCollectionCrud<User>({
    collection: COLLECTIONS.USERS,
    fetchErrorMessage: 'Failed to fetch users.',
    updateErrorMessage: 'Failed to update user roles.',
  });

  const updateUserRoles = useCallback(
    async (userId: string, roles: { [key: string]: string }) => {
      await updateItem(userId, { roles } as Partial<User>);
    },
    [updateItem]
  );

  return { users: items, loading, error, updateUserRoles };
};
