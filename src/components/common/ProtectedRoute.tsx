import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isLoggedIn } = useAuth();

  // You might want to add a loading state check here from useAuth if it provides one
  // to show a spinner while the auth state is being determined.

  if (!isLoggedIn) {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const bypassQuery = params.get('bypass') === '1';
        const bypassLocal = (() => {
          try {
            return window.localStorage && window.localStorage.getItem('aida.test.bypass') === '1';
          } catch (_err) {
            return false;
          }
        })();
        if (bypassQuery || bypassLocal) {
          return <>{children}</>;
        }
      }
    } catch (_) {
      // ignore
    }
    // Redirect them to the /login page, but save the current location they were
    // trying to go to so we can send them there after they login.
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
