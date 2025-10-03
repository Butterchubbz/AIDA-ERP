import { useState, useEffect, useCallback } from 'react';
import { pb } from '../lib/pocketbase';
import type { User } from '../types/user';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection('users').getFullList();
      setUsers(records as unknown as User[]);
    } catch (err) {
      setError('Failed to fetch users.');
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRoles = useCallback(
    async (userId: string, roles: { [key: string]: string }) => {
      setLoading(true);
      try {
        // Assuming roles are stored in a 'roles' field as a JSON object or similar
        await pb.collection('users').update(userId, { roles: roles });
        await fetchUsers(); // Refetch users to update UI
      } catch (err) {
        setError('Failed to update user roles.');
        console.error(err);
      }
      setLoading(false);
    },
    [fetchUsers]
  );

  return { users, loading, error, updateUserRoles };
};
