// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; // Import auth directly

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'Admin', 'Editor', 'Viewer'
  const [userRoles, setUserRoles] = useState({}); // New state for roles object
  const [inventorySortOrder, setInventorySortOrder] = useState([]); // New state for inventory sort order
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [appId, setAppId] = useState('default-app'); // Or your logic to determine appId

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setLoadingAuth(true);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.role === 'Admin' && !userData.roles) {
            const adminRoles = {
              Inventory: 'Editor',
              Forecasting: 'Editor',
              Amazon: 'Editor',
              Orders: 'Editor',
              'Inbound Shipments': 'Editor',
              'RMA Tracker': 'Editor',
              Admin: 'Editor',
            };
            await updateDoc(userDocRef, { roles: adminRoles });
            setUserRoles(adminRoles);
          } else {
            setUserRoles(userData.roles || {}); // Set the new roles object
          }
          setUserRole(userData.role); // Keep this for now for backwards compatibility
          setInventorySortOrder(userData.inventorySortOrder || []); // Set the inventory sort order
          // Update last login time for existing user
          await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
        } else {
          // New user, create a document for them with a default role
          const defaultRole = 'Viewer';
          const defaultViewerRoles = {
            // Default roles for a new Viewer
            Inventory: 'Viewer',
            Forecasting: 'Viewer',
            Amazon: 'Viewer',
            Orders: 'Viewer',
            'Inbound Shipments': 'Viewer',
            'RMA Tracker': 'Viewer',
            Admin: 'None', // Viewers should not have Admin access
          };
          const defaultInventorySortOrder = []; // Empty inventory sort order for new user
          await setDoc(userDocRef, {
            email: user.email,
            uid: user.uid,
            role: defaultRole,
            roles: defaultViewerRoles, // Use defaultViewerRoles
            inventorySortOrder: defaultInventorySortOrder,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          });
          setUserRole(defaultRole);
          setUserRoles(defaultViewerRoles); // Set the defaultViewerRoles
          setInventorySortOrder(defaultInventorySortOrder);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserRoles({});
        setInventorySortOrder([]);
      }
      setLoadingAuth(false);
    });

    return unsubscribe;
  }, [auth]);

  const updateInventorySortOrder = async newOrder => {
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, { inventorySortOrder: newOrder });
      setInventorySortOrder(newOrder);
    }
  };

  const googleSignIn = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const emailSignIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const emailSignUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logOut = () => signOut(auth);

  const value = {
    currentUser,
    userRole,
    userRoles, // Expose the new roles object
    inventorySortOrder, // Expose the inventory sort order
    updateInventorySortOrder, // Expose the update function
    loadingAuth,
    appId,
    googleSignIn,
    emailSignIn,
    emailSignUp,
    logOut,
  };

  return <AuthContext.Provider value={value}>{!loadingAuth && children}</AuthContext.Provider>;
};
