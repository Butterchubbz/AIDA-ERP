// src/hooks/useUsers.js
import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userRoles } = useAuth();
  const { showToast } = useMessageBox();

  const collectionName = 'users';

  useEffect(() => {
    if (userRoles.Admin !== 'Editor') {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(
      q,
      querySnapshot => {
        const usersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersData);
        setLoading(false);
      },
      err => {
        console.error('Error fetching users:', err);
        setError('Failed to fetch users.');
        setLoading(false);
        showToast('Error fetching users.', 'error');
      }
    );

    return () => unsubscribe();
  }, [userRoles, showToast]);

  const updateUserRoles = async (userId, roles) => {
    if (userRoles.Admin !== 'Editor') {
      showToast('You do not have permission to change user roles.', 'error');
      throw new Error('Permission denied.');
    }
    try {
      const userDocRef = doc(db, collectionName, userId);
      await updateDoc(userDocRef, { roles: roles });
      showToast('User roles updated successfully!', 'success');
    } catch (e) {
      console.error('Error updating user roles:', e);
      showToast('Failed to update user roles.', 'error');
      throw e;
    }
  };

  return { users, loading, error, updateUserRoles };
};
