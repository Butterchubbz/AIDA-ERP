// src/hooks/useQuoteApproved.js

import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig'; // Adjust this path if needed
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export const useQuoteApproved = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  const collectionRef = collection(db, 'quoteApprovedOrders');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collectionRef);
        const ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Format timestamp if needed
          timestamp: doc.data().timestamp?.toDate().toLocaleDateString(),
        }));
        setOrders(ordersData);
        setError(null);
      } catch (err) {
        console.error('Error fetching quote approved orders:', err);
        setError('Failed to fetch orders. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const addOrder = async orderData => {
    if (!currentUser) {
      throw new Error('Authentication required to add an order.');
    }
    try {
      const newOrder = {
        ...orderData,
        createdBy: currentUser.email || currentUser.uid,
        timestamp: serverTimestamp(),
      };
      const docRef = await addDoc(collectionRef, newOrder);
      setOrders(prev => [
        ...prev,
        { ...newOrder, id: docRef.id, timestamp: new Date().toLocaleDateString() },
      ]);
      return docRef;
    } catch (err) {
      console.error('Error adding order:', err);
      throw new Error('Failed to add order.');
    }
  };

  const updateOrder = async (orderId, updatedData) => {
    if (!currentUser) {
      throw new Error('Authentication required to update an order.');
    }
    const orderDocRef = doc(db, 'quoteApprovedOrders', orderId);
    try {
      const updatePayload = {
        ...updatedData,
        lastUpdatedBy: currentUser.email || currentUser.uid,
        lastUpdatedAt: serverTimestamp(),
      };
      await updateDoc(orderDocRef, updatePayload);
      setOrders(prev =>
        prev.map(order =>
          order.id === orderId
            ? { ...order, ...updatePayload, lastUpdatedAt: new Date().toLocaleDateString() }
            : order
        )
      );
    } catch (err) {
      console.error('Error updating order:', err);
      throw new Error('Failed to update order.');
    }
  };

  const deleteOrder = async orderId => {
    if (!currentUser) {
      throw new Error('Authentication required to delete an order.');
    }
    const orderDocRef = doc(db, 'quoteApprovedOrders', orderId);
    try {
      await deleteDoc(orderDocRef);
      setOrders(prev => prev.filter(order => order.id !== orderId));
    } catch (err) {
      console.error('Error deleting order:', err);
      throw new Error('Failed to delete order.');
    }
  };

  return { orders, loading, error, addOrder, updateOrder, deleteOrder };
};
