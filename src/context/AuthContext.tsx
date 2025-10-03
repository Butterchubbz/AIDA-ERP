import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { pb } from '../lib/pocketbase';
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

// Define the shape of the context
interface AuthContextType {
  user: RecordModel | null; // Use RecordModel
  isLoggedIn: boolean;
  userRoles: { [key: string]: string } | null; // Changed from userRole to userRoles
  login: (email: string, pass: string, isAdmin: boolean) => Promise<void>;
  logout: () => void;
  loadingAuth: boolean; // Add this line
  pb: PocketBase;
}

// Helper function to map a single role string to a granular userRoles object
const getUserRolesObject = (role: string | null) => {
  const baseRoles = {
    Inventory: 'None',
    Forecasting: 'None',
    Amazon: 'None',
    'Inbound Shipments': 'None',
    'RMA Tracker': 'None',
    Orders: 'None',
    Admin: 'None', // For User/Data Management
    Profile: 'Viewer', // Assuming Profile is always at least viewable
  };

  if (!role) {
    return baseRoles;
  }

  switch (role) {
    case 'Admin':
      return {
        Inventory: 'Editor',
        Forecasting: 'Editor',
        Amazon: 'Editor',
        'Inbound Shipments': 'Editor',
        'RMA Tracker': 'Editor',
        Orders: 'Editor',
        Admin: 'Editor',
        Profile: 'Editor',
      };
    case 'Manager':
      return {
        Inventory: 'Editor',
        Forecasting: 'Editor',
        Amazon: 'Editor',
        'Inbound Shipments': 'Editor',
        'RMA Tracker': 'Editor',
        Orders: 'Editor',
        Admin: 'None', // Manager has editor for everything but User Management
        Profile: 'Editor',
      };
    case 'Staff':
      return {
        Inventory: 'Viewer',
        Forecasting: 'Viewer',
        Amazon: 'Viewer',
        'Inbound Shipments': 'Editor',
        'RMA Tracker': 'Editor',
        Orders: 'Viewer',
        Admin: 'None',
        Profile: 'Editor',
      };
    case 'Viewer':
      return {
        Inventory: 'Viewer',
        Forecasting: 'Viewer',
        Amazon: 'Viewer',
        'Inbound Shipments': 'Viewer',
        'RMA Tracker': 'Viewer',
        Orders: 'Viewer',
        Admin: 'None',
        Profile: 'Viewer',
      };
    default:
      return baseRoles;
  }
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the provider
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.model as RecordModel | null); // Cast initial value
  const [userRoles, setUserRoles] = useState<{ [key: string]: string } | null>(
    getUserRolesObject(pb.authStore.model?.role || null)
  );
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_, model) => {
      setUser(model as RecordModel | null); // Cast model
      setUserRoles(getUserRolesObject(model?.role || null));
      setLoadingAuth(false);
    }, true);

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string, isAdmin: boolean) => {
    if (isAdmin) {
      await pb.admins.authWithPassword(email, pass);
    } else {
      await pb.collection('users').authWithPassword(email, pass);
    }
    // The useEffect hook will handle setting the user and userRoles state
  };

  const logout = () => {
    pb.authStore.clear();
    // The useEffect hook will handle setting the user and userRoles state to null
  };

  const value = {
    user,
    isLoggedIn: !!user,
    userRoles,
    login,
    logout,
    loadingAuth, // Expose loadingAuth
    pb,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
