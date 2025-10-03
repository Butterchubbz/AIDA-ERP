// src/hooks/useRMATracker.js
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
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';

export const useRMATracker = () => {
  const [rmaEntries, setRMAEntries] = useState([]);
  const [loadingRMA, setLoadingRMA] = useState(true);
  const [rmaError, setRMAError] = useState(null);

  const { currentUser, appId } = useAuth();
  const { showToast } = useMessageBox();

  const getRMACollectionRef = useCallback(() => {
    // This collection can be read publicly, so we only need the appId.
    if (appId) {
      return collection(db, `artifacts/${appId}/rmaEntries`);
    }
    return null;
  }, [appId]);

  useEffect(() => {
    if (!appId) {
      // We don't need a user to be logged in to view public RMA data.
      setRMAEntries([]);
      setLoadingRMA(false);
      return;
    }

    const rmaCollectionRef = getRMACollectionRef();
    if (!rmaCollectionRef) {
      setLoadingRMA(false);
      return;
    }

    const q = query(rmaCollectionRef, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        try {
          const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Safely handle the timestamp field
            timestamp: (() => {
              const ts = doc.data().timestamp;
              if (ts && typeof ts.toDate === 'function') {
                return ts.toDate().toLocaleString();
              }
              // Return as is if it's not a Firestore Timestamp, or a placeholder
              return ts ? String(ts) : 'No Date';
            })(),
          }));
          setRMAEntries(entries);
          setLoadingRMA(false);
        } catch (e) {
          console.error('Firestore RMA Snapshot Error:', e);
          setRMAError('Failed to load RMA data.');
          setLoadingRMA(false);
        }
      },
      error => {
        console.error('RMA listener error:', error);
        setRMAError(error.message);
        setLoadingRMA(false);
      }
    );

    return () => unsubscribe();
  }, [appId, getRMACollectionRef]);

  const addRMAEntry = useCallback(
    async entryData => {
      const rmaCollectionRef = getRMACollectionRef();
      if (!rmaCollectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        await addDoc(rmaCollectionRef, {
          ...entryData,
          timestamp: serverTimestamp(),
          status: 'Incoming',
          changedByEmail: currentUser.email || currentUser.uid,
        });
        showToast('RMA entry added successfully!', 'success');
      } catch (e) {
        console.error('Error adding RMA entry: ', e);
        showToast('Failed to add RMA entry. Please try again.', 'error');
        throw e;
      }
    },
    [getRMACollectionRef, currentUser, showToast]
  );

  const updateRMAEntry = useCallback(
    async (id, updatedData) => {
      const rmaCollectionRef = getRMACollectionRef();
      if (!rmaCollectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        const entryRef = doc(rmaCollectionRef, id);
        await updateDoc(entryRef, {
          ...updatedData,
          lastUpdatedBy: currentUser.email || currentUser.uid,
          lastUpdatedAt: serverTimestamp(),
        });
        showToast('RMA entry updated successfully!', 'success');
      } catch (e) {
        console.error('Error updating RMA entry: ', e);
        showToast('Failed to update RMA entry. Please try again.', 'error');
        throw e;
      }
    },
    [getRMACollectionRef, currentUser, showToast]
  );

  const updateRMAStatus = useCallback(
    async (id, newStatus) => {
      const rmaCollectionRef = getRMACollectionRef();
      if (!rmaCollectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        const entryRef = doc(rmaCollectionRef, id);
        await updateDoc(entryRef, {
          status: newStatus,
          lastUpdatedBy: currentUser.email || currentUser.uid,
          lastUpdatedAt: serverTimestamp(),
        });
        showToast('RMA status updated!', 'success');
      } catch (e) {
        console.error('Error updating RMA status:', e);
        showToast('Failed to update RMA status. Please try again.', 'error');
        throw e;
      }
    },
    [getRMACollectionRef, currentUser, showToast]
  );

  const deleteRMAEntry = useCallback(
    async id => {
      const rmaCollectionRef = getRMACollectionRef();
      if (!rmaCollectionRef || !currentUser) {
        showToast('Permission denied.', 'error');
        return;
      }
      try {
        await deleteDoc(doc(rmaCollectionRef, id));
        showToast('RMA entry deleted successfully!', 'success');
      } catch (e) {
        console.error('Error deleting RMA entry:', e);
        showToast('Failed to delete RMA entry.', 'error');
        throw e;
      }
    },
    [getRMACollectionRef, currentUser, showToast]
  );

  return {
    rmaEntries,
    loadingRMA,
    rmaError,
    addRMAEntry,
    updateRMAEntry,
    updateRMAStatus,
    deleteRMAEntry,
  };
};
