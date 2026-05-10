import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAccessoryInventory } from '../hooks/useInventoryModules';
import type { AccessoryItem } from '@aida/shared';

// Define the shape of the context
interface AccessoryContextType {
  accessories: AccessoryItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addAccessoryItem: (item: Partial<AccessoryItem>) => Promise<void>;
  updateAccessoryItem: (id: string, item: Partial<AccessoryItem>) => Promise<void>;
  deleteAccessoryItem: (id: string) => Promise<void>;
}

// Create the Accessory Context with a default undefined value
const AccessoryContext = createContext<AccessoryContextType | undefined>(undefined);

// Custom hook to use the Accessory Context
// eslint-disable-next-line react-refresh/only-export-components
export const useAccessoryContext = () => {
  const context = useContext(AccessoryContext);
  if (context === undefined) {
    throw new Error('useAccessoryContext must be used within an AccessoryProvider');
  }
  return context;
};

// Accessory Provider Component
interface AccessoryProviderProps {
  children: ReactNode;
}

export const AccessoryProvider = ({ children }: AccessoryProviderProps) => {
  const { accessories, loading, error, refetch, addAccessoryItem, updateAccessoryItem, deleteAccessoryItem } =
    useAccessoryInventory();

  const value = {
    accessories,
    loading,
    error,
    refetch,
    addAccessoryItem,
    updateAccessoryItem,
    deleteAccessoryItem,
  };

  return <AccessoryContext.Provider value={value}>{children}</AccessoryContext.Provider>;
};
