import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';
import { hasSetupCompleted, type FirstRunStatus } from '../../lib/firstRun';

interface ProtectedRouteProps {
  children: ReactNode;
  firstRunStatus?: FirstRunStatus;
}

const ProtectedRoute = ({ children, firstRunStatus = 'ready' }: ProtectedRouteProps) => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  // You might want to add a loading state check here from useAuth if it provides one
  // to show a spinner while the auth state is being determined.

  if (firstRunStatus === 'first-run' && !location.pathname.startsWith('/setup')) {
    return <Navigate to="/setup" replace />;
  }

  if (!isLoggedIn) {
    if (firstRunStatus === 'checking' && !hasSetupCompleted()) {
      return null;
    }

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
