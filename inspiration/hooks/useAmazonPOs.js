// src/hooks/useAmazonPOs.js

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';

export const useAmazonPOs = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser, appId } = useAuth();
  const { showToast } = useMessageBox();

  const collectionName = 'amazonPurchaseOrders';

  const getCollectionRef = useCallback(() => {
    if (appId) {
      return collection(db, `artifacts/${appId}/${collectionName}`);
    }
    return null;
  }, [appId]);

  useEffect(() => {
    setLoading(true);
    const collectionRef = getCollectionRef();
    if (!collectionRef) {
      setLoading(false);
      return () => {};
    }

    const q = query(collectionRef, orderBy('poDate', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      querySnapshot => {
        const poData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          poDate: doc.data().poDate?.toDate().toLocaleDateString(),
        }));
        setPurchaseOrders(poData);
        setLoading(false);
      },
      err => {
        console.error('Error fetching Amazon POs:', err);
        setError('Failed to fetch Amazon Purchase Orders.');
        setLoading(false);
        showToast('Error fetching Amazon POs.', 'error');
      }
    );

    return () => unsubscribe();
  }, [getCollectionRef, showToast]);

  const addPurchaseOrder = async poData => {
    const collectionRef = getCollectionRef();
    if (!collectionRef || !currentUser) throw new Error('You must be logged in to add POs.');
    try {
      await addDoc(collectionRef, {
        ...poData,
        poDate: new Date(poData.poDate), // Ensure it's a JS Date object before converting to Firestore timestamp
        createdAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
        createdBy: currentUser.email,
      });
      showToast('Purchase Order added successfully!', 'success');
    } catch (e) {
      console.error('Error adding PO: ', e);
      showToast('Failed to add Purchase Order.', 'error');
      throw e;
    }
  };

  const updatePurchaseOrder = async (id, updatedFields) => {
    const collectionRef = getCollectionRef();
    if (!collectionRef || !currentUser) throw new Error('You must be logged in to update POs.');
    const poDocRef = doc(collectionRef, id);
    try {
      const dataToUpdate = {
        ...updatedFields,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: currentUser.email,
      };
      if (updatedFields.poDate && typeof updatedFields.poDate === 'string') {
        dataToUpdate.poDate = new Date(updatedFields.poDate);
      }
      await updateDoc(poDocRef, dataToUpdate);
      showToast('Purchase Order updated successfully!', 'success');
    } catch (e) {
      console.error('Error updating PO: ', e);
      showToast('Failed to update Purchase Order.', 'error');
      throw e;
    }
  };

  const deletePurchaseOrder = async id => {
    const collectionRef = getCollectionRef();
    if (!collectionRef || !currentUser) throw new Error('You must be logged in to delete POs.');
    await deleteDoc(doc(collectionRef, id));
    showToast('Purchase Order deleted successfully!', 'success');
  };

  return {
    purchaseOrders,
    loading,
    error,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  };
};
