import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDeviceInventory } from '../hooks/useInventoryModules';
import type { DeviceItem } from '../types/device';

// Define the shape of the context
interface InventoryContextType {
  inventory: DeviceItem[];
  loading: boolean;
  error: string | null;
  refetch: (options?: { sort?: string; filter?: string }) => Promise<void>;
  addInventoryItem: (item: Partial<DeviceItem>) => Promise<void>;
  updateInventoryItem: (id: string, item: Partial<DeviceItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
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
  const {
    devices: inventory,
    loading,
    error,
    refetch,
    addDeviceItem: addInventoryItem,
    updateDeviceItem: updateInventoryItem,
    deleteDeviceItem: deleteInventoryItem,
  } = useDeviceInventory();

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
