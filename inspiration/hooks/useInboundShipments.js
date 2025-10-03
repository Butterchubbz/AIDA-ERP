// src/hooks/useInboundShipments.js

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  getDoc,
  getDocs,
  where,
  limit,
  writeBatch,
} from 'firebase/firestore'; // Added getDocs, where, limit, writeBatch
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox'; // Added useMessageBox

/**
 * Custom React hook for managing inbound shipment data with Firebase Firestore.
 * Data is stored per user.
 * Provides functionalities to:
 * - Listen for real-time inbound shipment changes.
 * - Add new inbound shipments.
 * - Update existing inbound shipments.
 * - Delete inbound shipments.
 * - Manage loading and error states.
 */
export const useInboundShipments = () => {
  const [inboundShipments, setInboundShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentUser, appId } = useAuth();
  const { showToast } = useMessageBox(); // Destructure showToast

  // Get the Firestore collection reference for inbound shipments
  const getCollectionRef = useCallback(() => {
    if (appId) {
      return collection(db, `artifacts/${appId}/inboundShipments`);
    }
    return null;
  }, [appId]);

  // Effect to set up real-time listener for inbound shipment data
  useEffect(() => {
    if (!currentUser || !db || !appId) {
      setInboundShipments([]);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const collectionRef = getCollectionRef();
    if (!collectionRef) {
      console.warn('Inbound shipments collection ref not available. Check currentUser and appId.');
      setInboundShipments([]);
      setLoading(false);
      return;
    }

    // Order by timestamp descending (newest first)
    const q = query(collectionRef, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const shipments = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Fetched shipment data:', data);
          console.log('Fetched shipment items:', data.items);

          // Defensive: handle both Timestamp and string
          let timestampStr = '';
          if (data.timestamp && typeof data.timestamp.toDate === 'function') {
            timestampStr = data.timestamp.toDate().toLocaleString();
          } else if (typeof data.timestamp === 'string') {
            timestampStr = data.timestamp;
          } else {
            timestampStr = '';
          }

          let estimatedDOAStr = '';
          if (data.estimatedDOA && typeof data.estimatedDOA.toDate === 'function') {
            estimatedDOAStr = data.estimatedDOA.toDate().toLocaleDateString();
          } else if (typeof data.estimatedDOA === 'string') {
            estimatedDOAStr = data.estimatedDOA;
          } else {
            estimatedDOAStr = '';
          }

          return {
            id: doc.id,
            ...data,
            timestamp: timestampStr,
            estimatedDOA: estimatedDOAStr,
          };
        });
        setInboundShipments(shipments);
        setLoading(false);
      },
      err => {
        console.error('Error fetching inbound shipments: ', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, db, appId, getCollectionRef]);

  /**
   * Adds a new inbound shipment.
   * @param {object} shipmentData - The data for the new shipment.
   */
  const addInboundShipment = useCallback(
    async shipmentData => {
      setLoading(true);
      setError(null);
      const collectionRef = getCollectionRef();
      if (!collectionRef) {
        setError('Authentication required to add shipments.');
        setLoading(false);
        return;
      }
      try {
        const dataToAdd = { ...shipmentData };
        if (dataToAdd.estimatedDOA) {
          dataToAdd.estimatedDOA = new Date(dataToAdd.estimatedDOA);
        }
        // Ensure items array is present, even if empty
        if (!dataToAdd.items) {
          dataToAdd.items = [];
        }
        await addDoc(collectionRef, {
          ...dataToAdd,
          timestamp: serverTimestamp(),
          status: 'In Transit', // Default status for new inbound shipments
          lastUpdatedBy: currentUser.email || currentUser.uid, // Log who added it
        });
      } catch (e) {
        console.error('Error adding inbound shipment: ', e);
        setError('Failed to add inbound shipment: ' + e.message);
      } finally {
        setLoading(false);
      }
    },
    [getCollectionRef, currentUser]
  );

  /**
   * Updates an existing inbound shipment.
   * @param {string} id - The ID of the shipment to update.
   * @param {object} updatedData - The data to update.
   */
  const updateInboundShipment = useCallback(
    async (id, updatedData) => {
      setLoading(true);
      setError(null);
      const collectionRef = getCollectionRef();
      if (!collectionRef) {
        setError('Authentication required to update shipments.');
        setLoading(false);
        return;
      }
      try {
        const dataToUpdate = { ...updatedData };
        if (dataToUpdate.estimatedDOA) {
          dataToUpdate.estimatedDOA = new Date(dataToUpdate.estimatedDOA);
        }
        // Remove undefined fields
        Object.keys(dataToUpdate).forEach(
          key => dataToUpdate[key] === undefined && delete dataToUpdate[key]
        );
        const updatePayload = {
          ...dataToUpdate,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: currentUser.email || currentUser.uid,
        };

        const shipmentDocRef = doc(collectionRef, id);
        await updateDoc(shipmentDocRef, updatePayload);
      } catch (e) {
        console.error('Error updating inbound shipment: ', e);
        setError('Failed to update inbound shipment: ' + e.message);
      } finally {
        setLoading(false);
      }
    },
    [getCollectionRef, currentUser]
  );

  /**
   * Deletes an inbound shipment.
   * @param {string} id - The ID of the shipment to delete.
   */
  const deleteInboundShipment = useCallback(
    async id => {
      setLoading(true);
      setError(null);
      const collectionRef = getCollectionRef();
      if (!collectionRef) {
        setError('Authentication required to delete shipments.');
        setLoading(false);
        return;
      }
      try {
        const shipmentDocRef = doc(collectionRef, id);
        await deleteDoc(shipmentDocRef);
      } catch (e) {
        console.error('Error deleting inbound shipment: ', e);
        setError('Failed to delete inbound shipment: ' + e.message);
      } finally {
        setLoading(false);
      }
    },
    [getCollectionRef]
  );

  const pushShipmentToInventory = useCallback(
    async shipmentId => {
      setLoading(true);
      setError(null);
      const inboundShipmentsRef = getCollectionRef();
      const inventoryRef = collection(db, `artifacts/${appId}/inventory`);
      if (!inboundShipmentsRef || !inventoryRef) {
        setError('Authentication required to push shipments.');
        setLoading(false);
        return;
      }

      const shipmentDocRef = doc(inboundShipmentsRef, shipmentId);

      try {
        const shipmentDoc = await getDoc(shipmentDocRef);
        if (!shipmentDoc.exists()) {
          throw new Error('Shipment not found.');
        }

        const shipmentData = shipmentDoc.data();
        const itemsToPush = shipmentData.items.filter(item => !item.pushed);

        if (itemsToPush.length === 0) {
          showToast('All items in this shipment have already been pushed to inventory.', 'info');
          return;
        }

        const batch = writeBatch(db);

        for (const item of itemsToPush) {
          const q = query(inventoryRef, where('sku', '==', item.sku), limit(1));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // SKU exists, update warehouseStock
            const inventoryDoc = querySnapshot.docs[0];
            const newStock = (inventoryDoc.data().warehouseStock || 0) + item.quantity;
            batch.update(inventoryDoc.ref, { warehouseStock: newStock });
          } else {
            // SKU does not exist, create new item
            const newInventoryItemRef = doc(inventoryRef);
            batch.set(newInventoryItemRef, {
              sku: item.sku,
              name: `New Item - ${item.sku}`, // Placeholder name
              warehouseStock: item.quantity,
              productionStock: 0,
              wooStock: 0,
              reserveStock: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        // Mark items as pushed in the shipment
        const updatedItems = shipmentData.items.map(item => ({ ...item, pushed: true }));
        batch.update(shipmentDocRef, { items: updatedItems });

        await batch.commit();
        showToast('Shipment items successfully pushed to inventory.', 'success');
      } catch (e) {
        console.error('Error pushing shipment to inventory: ', e);
        setError('Failed to push shipment to inventory: ' + e.message);
        showToast('Failed to push shipment to inventory. ' + e.message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [getCollectionRef, appId, showToast]
  );

  const searchSKU = useCallback(
    async searchString => {
      if (!appId) return [];
      const inventoryRef = collection(db, `artifacts/${appId}/inventory`);
      const q = query(
        inventoryRef,
        where('sku', '>=', searchString),
        where('sku', '<=', searchString + '\uf8ff'),
        limit(10)
      );
      try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data());
      } catch (error) {
        console.error('Error searching for SKU: ', error);
        return [];
      }
    },
    [appId]
  );

  return {
    inboundShipments,
    loading,
    error,
    addInboundShipment,
    updateInboundShipment,
    deleteInboundShipment,
    pushShipmentToInventory,
    searchSKU,
  };
};
