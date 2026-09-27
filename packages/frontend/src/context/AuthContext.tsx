import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { isModuleAllowed, type User, type UserRoles, type AppRole } from '@aida/shared';
import { ApiError, apiClient, isApiError } from '../lib/apiClient';

export interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  isLoggedIn: boolean;
  userRoles: UserRoles | null;
  can: (module: string) => boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  loadingAuth: boolean;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the provider
interface AuthProviderProps {
  children: ReactNode;
}

/** Provides backend session auth state and role-derived permissions to the app tree. */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ user: User | null }>('/api/auth/session')
      .then(res => setUser(res.user))
      .catch((error: unknown) => {
        if (isApiError(error) && error.status === 401) {
          setUser(null);
          return;
        }

        console.error('[Auth] Failed to restore session:', error);
        setUser(null);
      })
      .finally(() => setLoadingAuth(false));
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const res = await apiClient.post<{ user: User }>('/api/auth/login', { email, password: pass });
      setUser(res.user);
    } catch (error: unknown) {
      if (isApiError(error) && error.status === 401) {
        throw error;
      }

      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    } finally {
      setUser(null);
    }
  };

  const can = useCallback(
    (module: string): boolean => {
      if (!user) return false;
      return isModuleAllowed(user.role, module);
    },
    [user]
  );

  const value: AuthContextType = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isLoggedIn: !!user,
      userRoles: user?.roles ?? null,
      can,
      login,
      logout,
      loadingAuth,
    }),
    [user, can, loadingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Returns the active auth context and enforces provider usage. */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

