// src/firebaseConfig.js

// Import the functions you need from the Firebase SDKs
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyAwCeXrp-uqW5Csl_RzYJOY3XdW5TMS1Es',
  authDomain: 'inventory-am-woo.firebaseapp.com',
  projectId: 'inventory-am-woo',
  storageBucket: 'inventory-am-woo.firebasestorage.app',
  messagingSenderId: '467052238327',
  appId: '1:467052238327:web:69674b0ae9672793444af2',
  measurementId: 'G-HYP03RBGSK',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
