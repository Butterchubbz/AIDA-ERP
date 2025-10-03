// src/hooks/useInventory.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  serverTimestamp,
  deleteField,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Import the initialized Firestore instance
import { useAuth } from '../context/AuthContext'; // To get the current user's UID and appId for secure data paths
import { useMessageBox } from '../components/MessageBox'; // For toast messages

/**
 * Custom React hook for managing inventory data with Firebase Firestore.
 * Provides functionalities to:
 * - Listen for real-time inventory changes.
 * - Add new inventory items.
 * - Update existing inventory items with history tracking.
 * - Delete inventory items.
 * - Manage loading and error states.
 */
export const useInventory = inventorySortOrder => {
  // State to store the inventory items
  const [inventory, setInventory] = useState([]);
  // State to track if data is currently being loaded
  const [loading, setLoading] = useState(true);
  // State to store any errors that occur during Firestore operations
  const [error, setError] = useState(null);

  // Get currentUser and appId from AuthContext
  const { currentUser, loadingAuth, appId } = useAuth();
  const { showToast } = useMessageBox(); // Destructure showToast as it's used in update/add/delete

  // Determine the Firestore collection path based on app ID and user ID
  // Path: /artifacts/{appId}/users/{userId}/inventory
  const getInventoryCollectionRef = useCallback(() => {
    if (appId) {
      // Use the new shared path, not the user-specific one.
      return collection(db, `artifacts/${appId}/inventory`);
    }
    return null;
  }, [appId]);

  // Effect to set up real-time listener for inventory data
  useEffect(() => {
    if (loadingAuth || !currentUser) {
      if (!loadingAuth && !currentUser) {
        setInventory([]);
        setLoading(false);
      }
      return;
    }

    setError(null);
    setLoading(true);

    const inventoryCollectionRef = getInventoryCollectionRef();

    if (!inventoryCollectionRef) {
      console.warn(
        'Firestore inventory collection reference not available. Check currentUser and appId.'
      );
      setInventory([]);
      setLoading(false);
      return;
    }

    const q = inventoryCollectionRef;

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const items = [];
        snapshot.forEach(doc => {
          items.push({ id: doc.id, ...doc.data() });
        });

        if (inventorySortOrder && inventorySortOrder.length > 0) {
          items.sort((a, b) => {
            const aIndex = inventorySortOrder.indexOf(a.id);
            const bIndex = inventorySortOrder.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
        } else {
          items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        setInventory(items);
        setLoading(false);
      },
      err => {
        console.error('Error fetching inventory: ', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, loadingAuth, getInventoryCollectionRef, inventorySortOrder]);

  /**
   * Adds a new item to the inventory.
   * @param {object} itemData - The data for the new item.
   */
  const addItem = useCallback(
    async itemData => {
      setLoading(true);
      setError(null);
      const inventoryCollectionRef = getInventoryCollectionRef();
      if (!inventoryCollectionRef) {
        setError('Authentication required to add items.');
        setLoading(false);
        return;
      }

      try {
        console.log('Attempting to add item to path:', inventoryCollectionRef.path);
        await addDoc(inventoryCollectionRef, {
          ...itemData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Item added successfully!', 'success');
      } catch (e) {
        console.error('Error adding document: ', e);
        setError('Failed to add item: ' + e.message);
      } finally {
        setLoading(false);
      }
    },
    [getInventoryCollectionRef, showToast]
  );

  /**
   * Updates an existing item in the inventory with history tracking.
   * @param {string} id - The ID of the item to update.
   * @param {object} updatedData - The data to update.
   */
  const updateItem = useCallback(
    async (id, updatedData) => {
      setLoading(true);
      setError(null);
      const inventoryCollectionRef = getInventoryCollectionRef();
      if (!inventoryCollectionRef) {
        setError('Authentication required to update items.');
        setLoading(false);
        return;
      }

      try {
        const itemDocRef = doc(inventoryCollectionRef, id);
        const currentItemSnap = await getDoc(itemDocRef);
        const currentItemData = currentItemSnap.exists() ? currentItemSnap.data() : {};

        const fieldsToUpdate = { ...updatedData, updatedAt: serverTimestamp() };
        const historyOperations = [];

        // Define fields that should trigger a history log if changed
        const stockFields = ['wooStock', 'productionStock', 'warehouseStock', 'reserveStock'];

        for (const field of stockFields) {
          // Check if the field exists in updatedData and its value has actually changed
          if (field in updatedData && updatedData[field] !== currentItemData[field]) {
            const oldValue = currentItemData[field] || 0;
            const newValue = updatedData[field] || 0;

            historyOperations.push(
              addDoc(collection(itemDocRef, 'stockHistory'), {
                timestamp: serverTimestamp(),
                field: field,
                oldValue: oldValue,
                newValue: newValue,
                change: newValue - oldValue,
                changedByEmail: currentUser?.email || currentUser?.uid || 'Unknown User',
                operation: `Quantity Update - ${field}`,
              })
            );
          }
        }

        console.log('Attempting to update item at path:', itemDocRef.path);
        await updateDoc(itemDocRef, fieldsToUpdate); // Perform the actual update
        await Promise.all(historyOperations); // Commit all history logs
        showToast('Item updated successfully!', 'success'); // Use showToast
      } catch (e) {
        console.error('Error updating document: ', e);
        setError('Failed to update item: ' + e.message);
      } finally {
        setLoading(false);
      }
    },
    [getInventoryCollectionRef, currentUser, showToast]
  );

  /**
   * Deletes an item from the inventory.
   * @param {string} id - The ID of the item to delete.
   */
  const deleteItem = useCallback(
    async id => {
      setLoading(true);
      setError(null);
      const inventoryCollectionRef = getInventoryCollectionRef();
      if (!inventoryCollectionRef) {
        setError('Authentication required to delete items.');
        setLoading(false);
        return;
      }

      try {
        const itemDocRef = doc(inventoryCollectionRef, id);
        console.log('Attempting to delete item at path:', itemDocRef.path);
        await deleteDoc(itemDocRef); // Fixed: ensure deleteDoc receives a DocumentReference
        showToast('Item deleted successfully!', 'success'); // Use showToast
      } catch (e) {
        console.error('Error deleting document: ', e);
        setError('Failed to delete item: ' + e.message);
      } finally {
        setLoading(false);
      }
    },
    [getInventoryCollectionRef, showToast]
  );

  /**
   * Fetches historical stock changes for a specific inventory item.
   * @param {string} itemId - The ID of the inventory item.
   * @returns {Array} An array of history records.
   */
  const fetchItemHistory = useCallback(
    async itemId => {
      const inventoryCollectionRef = getInventoryCollectionRef();
      if (!inventoryCollectionRef) {
        throw new Error('Authentication required to fetch history.');
      }
      try {
        const itemRef = doc(inventoryCollectionRef, itemId);
        const historyCollectionRef = collection(itemRef, 'stockHistory');

        const q = query(historyCollectionRef, orderBy('timestamp', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);

        const historyData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate().toLocaleString(),
          };
        });
        return historyData;
      } catch (e) {
        console.error('Error in fetchItemHistory:', e);
        throw new Error('Failed to load item history: ' + e.message);
      }
    },
    [getInventoryCollectionRef]
  );

  return {
    inventory,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    fetchItemHistory,
  };
};
