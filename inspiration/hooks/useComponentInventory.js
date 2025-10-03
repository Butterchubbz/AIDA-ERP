// src/hooks/useComponentInventory.js
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  getDoc,
  getDocs,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';

export const useComponentInventory = () => {
  const [componentInventory, setComponentInventory] = useState([]);
  const [loadingComponents, setLoadingComponents] = useState(true);
  const [componentError, setComponentError] = useState(null);

  const { currentUser, appId } = useAuth();
  const { showToast } = useMessageBox();

  const getComponentInventoryCollectionRef = useCallback(() => {
    // Use the new shared path.
    if (appId) {
      return collection(db, `artifacts/${appId}/componentsInventory`);
    }
    return null;
  }, [appId]);

  useEffect(() => {
    if (!currentUser || !appId) {
      setComponentInventory([]);
      setLoadingComponents(false);
      return;
    }

    const collectionRef = getComponentInventoryCollectionRef();
    if (!collectionRef) {
      setLoadingComponents(false);
      return;
    }

    const q = query(collectionRef, orderBy('sku', 'asc'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        try {
          const inventory = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setComponentInventory(inventory);
          setLoadingComponents(false);
        } catch (e) {
          console.error('Firestore Component Inventory Snapshot Error:', e);
          setComponentError('Failed to load component data.');
          setLoadingComponents(false);
        }
      },
      error => {
        console.error('Component inventory listener error:', error);
        setComponentError(error.message);
        setLoadingComponents(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, appId, getComponentInventoryCollectionRef]);

  const addComponent = useCallback(
    async componentData => {
      const collectionRef = getComponentInventoryCollectionRef();
      if (!collectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        await addDoc(collectionRef, {
          ...componentData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: currentUser.email || currentUser.uid,
        });
        showToast('Component added successfully!', 'success');
      } catch (e) {
        console.error('Error adding component: ', e);
        showToast('Failed to add component.', 'error');
        throw e;
      }
    },
    [getComponentInventoryCollectionRef, currentUser, showToast]
  );

  const updateComponent = useCallback(
    async (id, updatedData) => {
      const collectionRef = getComponentInventoryCollectionRef();
      if (!collectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        const componentRef = doc(collectionRef, id);
        await updateDoc(componentRef, {
          ...updatedData,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: currentUser.email || currentUser.uid,
        });
        showToast('Component updated successfully!', 'success');
      } catch (e) {
        console.error('Error updating component: ', e);
        showToast('Failed to update component.', 'error');
        throw e;
      }
    },
    [getComponentInventoryCollectionRef, currentUser, showToast]
  );

  const deleteComponent = useCallback(
    async id => {
      const collectionRef = getComponentInventoryCollectionRef();
      if (!collectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        await deleteDoc(doc(collectionRef, id));
        showToast('Component deleted successfully!', 'success');
      } catch (e) {
        console.error('Error deleting component:', e);
        showToast('Failed to delete component.', 'error');
        throw e;
      }
    },
    [getComponentInventoryCollectionRef, currentUser, showToast]
  );

  const batchUpdateComponents = useCallback(
    async updates => {
      const collectionRef = getComponentInventoryCollectionRef();
      if (!collectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }

      if (updates.length === 0) return;

      // A Firestore batch can handle up to 500 operations.
      // Each component update might be 2+ operations (update doc + history docs).
      // We'll process in chunks to be safe.
      const BATCH_SIZE = 150; // Process 150 components at a time (max 450 ops, safely under 500 limit)

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        try {
          // Step 1: Read all necessary data for this chunk *before* writing.
          const readPromises = chunk.map(u => getDoc(doc(collectionRef, u.id)));
          const docSnapshots = await Promise.all(readPromises);
          const currentDataMap = new Map();
          docSnapshots.forEach(snap => {
            if (snap.exists()) {
              currentDataMap.set(snap.id, snap.data());
            }
          });

          // Step 2: Prepare all write operations for the batch.
          for (const update of chunk) {
            const { id, updatedFields } = update;
            // Defensively check if the document exists before attempting to update.
            if (!currentDataMap.has(id)) {
              console.warn(
                `Component with ID ${id} was not found in the database and was skipped during the stock count update.`
              );
              continue; // Skip this update to prevent the batch from failing.
            }
            const componentRef = doc(collectionRef, id);
            const currentItemData = currentDataMap.get(id) || {};

            // Add the main document update to the batch
            batch.update(componentRef, {
              ...updatedFields,
              updatedAt: serverTimestamp(),
              lastUpdatedBy: currentUser.email || currentUser.uid,
            });

            // Add history document writes to the batch
            for (const field in updatedFields) {
              if (Object.prototype.hasOwnProperty.call(updatedFields, field)) {
                const oldValue = currentItemData[field] || 0;
                const newValue = updatedFields[field] || 0;
                if (newValue !== oldValue) {
                  // Create a new document reference for the history subcollection
                  const historyDocRef = doc(collection(componentRef, 'stockHistory'));
                  batch.set(historyDocRef, {
                    timestamp: serverTimestamp(),
                    field,
                    oldValue,
                    newValue,
                    change: newValue - oldValue,
                    changedByEmail: currentUser.email || currentUser.uid,
                    operation: 'Stock Count Update',
                  });
                }
              }
            }
          }

          // Step 3: Commit the atomic batch.
          await batch.commit();
        } catch (e) {
          console.error('Error during Firestore batch commit:', e);
          throw e; // Re-throw the error to be caught by the calling component.
        }
      }
    },
    [getComponentInventoryCollectionRef, currentUser, showToast]
  );

  const fetchComponentHistory = useCallback(
    async itemId => {
      const collectionRef = getComponentInventoryCollectionRef();
      if (!collectionRef) {
        throw new Error('Authentication required to fetch component history.');
      }
      try {
        const itemRef = doc(collectionRef, itemId);
        const historyCollectionRef = collection(itemRef, 'stockHistory');
        const q = query(historyCollectionRef, orderBy('timestamp', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toLocaleString(),
        }));
      } catch (e) {
        console.error('Error in fetchComponentHistory:', e);
        throw new Error('Failed to load item history: ' + e.message);
      }
    },
    [getComponentInventoryCollectionRef]
  );

  return {
    componentInventory,
    loadingComponents,
    componentError,
    addComponent,
    updateComponent,
    deleteComponent,
    batchUpdateComponents,
    fetchComponentHistory,
  };
};
