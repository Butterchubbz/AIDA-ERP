import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useInventory } from '../hooks/useInventory'; // Import the custom inventory hook
import type { InventoryItem } from '../types/inventory';

// Define the shape of the context
interface InventoryContextType {
  inventory: InventoryItem[];
  loading: boolean;
  error: string | null;
  refetch: (options?: { sort?: string; filter?: string }) => Promise<void>;
  addInventoryItem: (item: Partial<InventoryItem>) => Promise<void>;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  // fetchItemHistory: (id: string) => Promise<any>; // Assuming this returns some history data
}

// Create the Inventory Context with a default undefined value
const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Custom hook to use the Inventory Context
// eslint-disable-next-line react-refresh/only-export-components
export const useInventoryContext = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventoryContext must be used within an InventoryProvider');
  }
  return context;
};

// Inventory Provider Component
interface InventoryProviderProps {
  children: ReactNode;
}

export const InventoryProvider = ({ children }: InventoryProviderProps) => {
  // Call the useInventory custom hook to get all inventory related data and functions
  const {
    inventory,
    loading,
    error,
    refetch,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
  } = useInventory();

  const value = {
    inventory,
    loading,
    error,
    refetch,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    // fetchItemHistory, // Include if implemented in useInventory
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};
