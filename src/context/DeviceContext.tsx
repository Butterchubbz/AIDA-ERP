import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useDevice } from '../hooks/useDevice'; // Import the custom inventory hook
import type { DeviceItem } from '../types/device';

// Define the shape of the context
interface DeviceContextType {
  devices: DeviceItem[];
  loading: boolean;
  error: string | null;
  refetch: (options?: { sort?: string; filter?: string }) => Promise<void>;
  addDeviceItem: (item: Partial<DeviceItem>) => Promise<void>;
  updateDeviceItem: (id: string, item: Partial<DeviceItem>) => Promise<void>;
  deleteDeviceItem: (id: string) => Promise<void>;
  // fetchItemHistory: (id: string) => Promise<any>; // Assuming this returns some history data
}

// Create the Inventory Context with a default undefined value
const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Custom hook to use the Inventory Context
// eslint-disable-next-line react-refresh/only-export-components
export const useDeviceContext = () => {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDeviceContext must be used within an DeviceProvider');
  }
  return context;
};

// Inventory Provider Component
interface DeviceProviderProps {
  children: ReactNode;
}

export const DeviceProvider = ({ children }: DeviceProviderProps) => {
  // Call the useInventory custom hook to get all inventory related data and functions
  const { devices, loading, error, refetch, addDeviceItem, updateDeviceItem, deleteDeviceItem } =
    useDevice();

  const value = {
    devices,
    loading,
    error,
    refetch,
    addDeviceItem,
    updateDeviceItem,
    deleteDeviceItem,
    // fetchItemHistory, // Include if implemented in useInventory
  };

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};
