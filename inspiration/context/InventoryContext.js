// src/context/InventoryContext.js

import React, { createContext, useContext } from 'react';
import { useInventory } from '../hooks/useInventory'; // Import the custom inventory hook

// Create the Inventory Context
const InventoryContext = createContext();

// Custom hook to use the Inventory Context
export const useInventoryContext = () => {
  // This hook allows any component to easily access the inventory data and functions
  return useContext(InventoryContext);
};

// Inventory Provider Component
export const InventoryProvider = ({ children }) => {
  // Call the useInventory custom hook to get all inventory related data and functions
  // This is where the real-time data fetching and CRUD operations are managed.
  const { inventory, loading, error, addItem, updateItem, deleteItem, fetchItemHistory } =
    useInventory();

  // The value object that will be provided to all consumers of this context.
  // It includes the inventory data, current loading state, any errors,
  // and the functions to perform CRUD operations on the inventory.
  const value = {
    inventory,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    fetchItemHistory,
  };

  return (
    // Provide the context value to its children components.
    // All components wrapped by InventoryProvider will have access to 'value'.
    <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
  );
};
