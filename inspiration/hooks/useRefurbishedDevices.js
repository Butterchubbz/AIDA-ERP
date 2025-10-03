// src/hooks/useRefurbishedDevices.js

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';

export const useRefurbishedDevices = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser, appId } = useAuth();
  const { showToast } = useMessageBox();

  const collectionName = 'refurbishedDevices';

  const getCollectionRef = useCallback(() => {
    if (appId) {
      return collection(db, `artifacts/${appId}/${collectionName}`);
    }
    return null;
  }, [appId]);

  const logHistory = async (deviceId, field, oldValue, newValue, changedBy) => {
    const collectionRef = getCollectionRef();
    if (!collectionRef) return;
    const historyCollectionRef = collection(collectionRef, deviceId, 'history');
    await addDoc(historyCollectionRef, {
      field,
      oldValue,
      newValue,
      change: (parseFloat(newValue) || 0) - (parseFloat(oldValue) || 0),
      timestamp: serverTimestamp(),
      changedByEmail: changedBy.email || 'N/A',
      changedById: changedBy.uid,
    });
  };

  const fetchDevices = useCallback(() => {
    setLoading(true);
    const collectionRef = getCollectionRef();
    if (!collectionRef) {
      setLoading(false);
      return () => {};
    }

    const q = query(collectionRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      querySnapshot => {
        const devicesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDevices(devicesData);
        setLoading(false);
      },
      err => {
        console.error('Error fetching refurbished devices:', err);
        setError('Failed to fetch refurbished devices.');
        setLoading(false);
        showToast('Error fetching refurbished devices.', 'error');
      }
    );

    return unsubscribe;
  }, [getCollectionRef, showToast]);

  useEffect(() => {
    const unsubscribe = fetchDevices();
    return () => unsubscribe();
  }, [fetchDevices]);

  const addDevice = async deviceData => {
    const collectionRef = getCollectionRef();
    if (!collectionRef || !currentUser) throw new Error('You must be logged in to add devices.');
    try {
      const docRef = await addDoc(collectionRef, {
        ...deviceData,
        createdAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
        createdBy: currentUser.email,
      });
      showToast('Refurbished device added successfully!', 'success');
      await logHistory(docRef.id, 'refurbishedStock', 0, deviceData.refurbishedStock, currentUser);
    } catch (e) {
      console.error('Error adding device: ', e);
      showToast('Failed to add device.', 'error');
      throw e;
    }
  };

  const updateDevice = async (id, updatedFields) => {
    const collectionRef = getCollectionRef();
    if (!collectionRef || !currentUser) throw new Error('You must be logged in to update devices.');
    const deviceDocRef = doc(collectionRef, id);
    try {
      const docSnap = await getDoc(deviceDocRef);
      if (!docSnap.exists()) throw new Error('Device not found');
      const oldData = docSnap.data();

      await updateDoc(deviceDocRef, {
        ...updatedFields,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: currentUser.email,
      });

      for (const key in updatedFields) {
        if (oldData[key] !== updatedFields[key]) {
          await logHistory(id, key, oldData[key] || '', updatedFields[key], currentUser);
        }
      }
      showToast('Device updated successfully!', 'success');
    } catch (e) {
      console.error('Error updating device: ', e);
      showToast('Failed to update device.', 'error');
      throw e;
    }
  };

  const deleteDevice = async id => {
    const collectionRef = getCollectionRef();
    if (!collectionRef || !currentUser) throw new Error('You must be logged in to delete devices.');
    await deleteDoc(doc(collectionRef, id));
  };

  const fetchDeviceHistory = async deviceId => {
    const collectionRef = getCollectionRef();
    if (!collectionRef) throw new Error('Authentication required.');
    const q = query(collection(collectionRef, deviceId, 'history'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate().toLocaleString() ?? 'N/A',
    }));
  };

  return { devices, loading, error, addDevice, updateDevice, deleteDevice, fetchDeviceHistory };
};
