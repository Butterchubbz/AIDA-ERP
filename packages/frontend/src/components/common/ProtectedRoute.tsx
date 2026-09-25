import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';
import type { FirstRunStatus } from '../../lib/firstRun';

interface ProtectedRouteProps {
  children: ReactNode;
  firstRunStatus?: FirstRunStatus;
}

const ProtectedRoute = ({ children, firstRunStatus = 'ready' }: ProtectedRouteProps) => {
  const { isLoggedIn, loadingAuth } = useAuth();
  const location = useLocation();

  if (firstRunStatus === 'first-run' && !location.pathname.startsWith('/setup')) {
    return <Navigate to="/setup" replace />;
  }

  if (firstRunStatus === 'checking' || loadingAuth) {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
