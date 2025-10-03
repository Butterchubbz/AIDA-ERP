// src/hooks/useAmazonInventory.js

import { useState, useEffect, useCallback } from 'react';
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
  serverTimestamp,
  deleteField,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';

/**
 * Custom React hook for managing Amazon-specific inventory data with Firebase Firestore.
 * This data is distinct from AIDA's core inventory.
 * Provides functionalities to:
 * - Listen for real-time Amazon inventory changes.
 * - Add new Amazon inventory items.
 * - Update existing Amazon inventory items.
 * - Delete Amazon inventory items.
 * - Manage loading and error states.
 * - Handle specific logic like combining 'OnTheWay' quantities and managing forecast params.
 */
export const useAmazonInventory = () => {
  const [amazonInventory, setAmazonInventory] = useState([]);
  const [loadingAmazon, setLoadingAmazon] = useState(true);
  const [amazonError, setAmazonError] = useState(null);

  const { showToast, showMessageBox } = useMessageBox();

  const { currentUser, loadingAuth, appId } = useAuth();

  // --- Firestore Collection References ---
  const getAmazonInventoryCollectionRef = useCallback(() => {
    if (appId) {
      return collection(db, `artifacts/${appId}/amazonPOs`);
    }
    return null;
  }, [appId]);

  const getForecastParamsDocRef = useCallback(() => {
    if (currentUser && appId) {
      const userId = currentUser.uid;
      return doc(db, 'artifacts', appId, 'users', userId, 'settings', 'fbaForecastParams');
    }
    return null;
  }, [currentUser, appId]);

  // --- Effect for Amazon Inventory Data Listener ---
  useEffect(() => {
    if (loadingAuth || !currentUser) {
      if (!loadingAuth && !currentUser) {
        setAmazonInventory([]);
        setLoadingAmazon(false);
      }
      return;
    }

    setAmazonError(null);
    setLoadingAmazon(true);

    const amazonInventoryCollectionRef = getAmazonInventoryCollectionRef();
    if (!amazonInventoryCollectionRef) {
      console.warn('Amazon inventory collection ref not available. Check currentUser and appId.');
      setAmazonInventory([]);
      setLoadingAmazon(false);
      return;
    }

    const unsubscribe = onSnapshot(
      amazonInventoryCollectionRef,
      snapshot => {
        const items = snapshot.docs.map(doc => {
          const data = doc.data();
          // Combine BeingBuilt and EnRoute into a new 'onTheWay' property for display/calculations.
          // This client-side aggregation prioritizes the new 'OnTheWay' field if it exists.
          const onTheWayQuantities = {
            amazonFBA_Base_OnTheWayQuantity:
              data.amazonFBA_Base_OnTheWayQuantity ??
              (data.amazonFBA_Base_BeingBuiltQuantity || 0) +
                (data.amazonFBA_Base_EnRouteQuantity || 0),
            amazonFBA_250_OnTheWayQuantity:
              data.amazonFBA_250_OnTheWayQuantity ??
              (data.amazonFBA_250_BeingBuiltQuantity || 0) +
                (data.amazonFBA_250_EnRouteQuantity || 0),
            amazonFBA_500_OnTheWayQuantity:
              data.amazonFBA_500_OnTheWayQuantity ??
              (data.amazonFBA_500_BeingBuiltQuantity || 0) +
                (data.amazonFBA_500_EnRouteQuantity || 0),
            amazonFBM_Base_OnTheWayQuantity:
              data.amazonFBM_Base_OnTheWayQuantity ??
              (data.amazonFBM_Base_BeingBuiltQuantity || 0) +
                (data.amazonFBM_Base_EnRouteQuantity || 0),
            amazonFBM_250_OnTheWayQuantity:
              data.amazonFBM_250_OnTheWayQuantity ??
              (data.amazonFBM_250_BeingBuiltQuantity || 0) +
                (data.amazonFBM_250_EnRouteQuantity || 0),
            amazonFBM_500_OnTheWayQuantity:
              data.amazonFBM_500_OnTheWayQuantity ??
              (data.amazonFBM_500_BeingBuiltQuantity || 0) +
                (data.amazonFBM_500_EnRouteQuantity || 0),
          };

          return {
            id: doc.id,
            ...data,
            ...onTheWayQuantities,
            // Ensure plannedToBuild exists for all items
            plannedToBuild: data.plannedToBuild || 0,
          };
        });
        // Sort items by SKU client-side as default
        items.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
        setAmazonInventory(items);
        setLoadingAmazon(false);
      },
      err => {
        console.error('Error fetching Amazon inventory: ', err);
        setAmazonError(err.message);
        setLoadingAmazon(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser, loadingAuth, getAmazonInventoryCollectionRef]);

  // --- CRUD Operations for Amazon Inventory ---
  const addAmazonItem = useCallback(
    async itemData => {
      setLoadingAmazon(true);
      setAmazonError(null);
      const amazonInventoryCollectionRef = getAmazonInventoryCollectionRef();
      if (!amazonInventoryCollectionRef) {
        setAmazonError('Authentication required to add Amazon items.');
        setLoadingAmazon(false);
        return;
      }
      try {
        await addDoc(amazonInventoryCollectionRef, {
          ...itemData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Amazon item added successfully!', 'success');
      } catch (e) {
        console.error('Error adding Amazon item: ', e);
        setAmazonError('Failed to add Amazon item: ' + e.message);
      } finally {
        setLoadingAmazon(false);
      }
    },
    [getAmazonInventoryCollectionRef, showToast]
  );

  const updateAmazonItem = useCallback(
    async (id, updatedData) => {
      setLoadingAmazon(true);
      setAmazonError(null);
      const amazonInventoryCollectionRef = getAmazonInventoryCollectionRef();
      if (!amazonInventoryCollectionRef) {
        setAmazonError('Authentication required to update Amazon items.');
        setLoadingAmazon(false);
        return;
      }
      try {
        const itemDocRef = doc(amazonInventoryCollectionRef, id);

        // Log changes to stock history (similar to AmzWoo.js original logic)
        const currentItemSnap = await getDoc(itemDocRef);
        const currentItemData = currentItemSnap.exists() ? currentItemSnap.data() : {};
        const historyOperations = [];

        const quantityFields = [
          'amazonFBA_BaseQuantity',
          'amazonFBA_Base_OnTheWayQuantity',
          'amazonFBA_250Quantity',
          'amazonFBA_250_OnTheWayQuantity',
          'amazonFBA_500Quantity',
          'amazonFBA_500_OnTheWayQuantity',
          'amazonFBM_BaseQuantity',
          'amazonFBM_250Quantity',
          'amazonFBM_500Quantity',
          'spareStockQuantity',
          'wooCommercePhysicalStock',
          'plannedToBuild',
        ];

        for (const field of quantityFields) {
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

        // Also explicitly delete old fields if they exist and are not in new data structure
        const fieldsToDelete = [
          'amazonFBA_Base_BeingBuiltQuantity',
          'amazonFBA_Base_EnRouteQuantity',
          'amazonFBA_250_BeingBuiltQuantity',
          'amazonFBA_250_EnRouteQuantity',
          'amazonFBA_500_BeingBuiltQuantity',
          'amazonFBA_500_EnRouteQuantity',
          'amazonFBM_Base_BeingBuiltQuantity',
          'amazonFBM_Base_EnRouteQuantity',
          'amazonFBM_250_BeingBuiltQuantity',
          'amazonFBM_250_EnRouteQuantity',
          'amazonFBM_500_BeingBuiltQuantity',
          'amazonFBM_500_EnRouteQuantity',
        ];
        const updatesWithDeletions = { ...updatedData, updatedAt: serverTimestamp() };
        fieldsToDelete.forEach(field => {
          if (currentItemData[field] !== undefined) {
            updatesWithDeletions[field] = deleteField();
          }
        });

        await updateDoc(itemDocRef, updatesWithDeletions);
        await Promise.all(historyOperations);
        showToast('Amazon item updated successfully!', 'success');
      } catch (e) {
        console.error('Error updating Amazon item: ', e);
        setAmazonError('Failed to update Amazon item: ' + e.message);
      } finally {
        setLoadingAmazon(false);
      }
    },
    [getAmazonInventoryCollectionRef, currentUser, showToast]
  );

  const deleteAmazonItem = useCallback(
    async id => {
      setLoadingAmazon(true);
      setAmazonError(null);
      const amazonInventoryCollectionRef = getAmazonInventoryCollectionRef();
      if (!amazonInventoryCollectionRef) {
        setAmazonError('Authentication required to delete Amazon items.');
        setLoadingAmazon(false);
        return;
      }
      try {
        await deleteDoc(doc(amazonInventoryCollectionRef, id));
        showToast('Amazon item deleted successfully!', 'success');
      } catch (e) {
        console.error('Error deleting Amazon item: ', e);
        setAmazonError('Failed to delete Amazon item.', 'error');
      } finally {
        setLoadingAmazon(false);
      }
    },
    [getAmazonInventoryCollectionRef, showToast]
  );

  const batchUpdateAmazonStock = useCallback(
    async updates => {
      // This function will not set the global loading state, to allow for background sync.
      setAmazonError(null);
      const amazonInventoryCollectionRef = getAmazonInventoryCollectionRef();
      if (!amazonInventoryCollectionRef || !currentUser) {
        const errorMsg = 'Authentication required to batch update Amazon items.';
        setAmazonError(errorMsg);
        showToast(errorMsg, 'error');
        return;
      }

      const updatePromises = updates.map(async update => {
        const { id, updatedFields } = update;
        const itemDocRef = doc(amazonInventoryCollectionRef, id);

        // We can still log history for each update
        const currentItemSnap = await getDoc(itemDocRef);
        const currentItemData = currentItemSnap.exists() ? currentItemSnap.data() : {};
        const historyOperations = [];

        for (const field in updatedFields) {
          if (updatedFields[field] !== currentItemData[field]) {
            const oldValue = currentItemData[field] || 0;
            const newValue = updatedFields[field] || 0;
            historyOperations.push(
              addDoc(collection(itemDocRef, 'stockHistory'), {
                timestamp: serverTimestamp(),
                field: field,
                oldValue: oldValue,
                newValue: newValue,
                change: newValue - oldValue,
                changedByEmail: currentUser.email || currentUser.uid,
                operation: 'Stock Sync from Vaults (Counted)',
              })
            );
          }
        }

        // Perform the update and history logging
        await updateDoc(itemDocRef, { ...updatedFields, updatedAt: serverTimestamp() });
        await Promise.all(historyOperations);
      });

      await Promise.all(updatePromises); // This will throw if any promise rejects, which can be caught by the caller.
    },
    [getAmazonInventoryCollectionRef, currentUser, showToast]
  );

  const fetchAmazonItemHistory = useCallback(
    async itemId => {
      const amazonInventoryCollectionRef = getAmazonInventoryCollectionRef();
      if (!amazonInventoryCollectionRef) {
        throw new Error('Authentication required to fetch Amazon item history.');
      }
      try {
        const itemRef = doc(amazonInventoryCollectionRef, itemId);
        const historyCollectionRef = collection(itemRef, 'stockHistory');
        const q = query(historyCollectionRef, orderBy('timestamp', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toLocaleString(),
        }));
      } catch (e) {
        console.error('Error in fetchAmazonItemHistory:', e);
        throw new Error('Failed to load item history: ' + e.message);
      }
    },
    [getAmazonInventoryCollectionRef]
  );

  return {
    amazonInventory,
    loadingAmazon,
    amazonError,
    addAmazonItem,
    updateAmazonItem,
    deleteAmazonItem,
    batchUpdateAmazonStock,
    fetchAmazonItemHistory,
  };
};
