import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';
import type { FirstRunStatus } from '../../lib/firstRun';

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

  if (firstRunStatus === 'checking') {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
