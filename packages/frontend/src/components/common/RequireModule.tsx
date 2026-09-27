import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import NoAccess from '../../pages/NoAccess';

interface RequireModuleProps {
  module: string;
  children: ReactNode;
}

/**
 * Route wrapper that renders children if the authenticated user has access
 * to the specified module, otherwise renders a clean NoAccess view.
 */
export default function RequireModule({ module, children }: RequireModuleProps) {
  const { can, loadingAuth } = useAuth();

  if (loadingAuth) {
    return null;
  }

  if (!can(module)) {
    return <NoAccess />;
  }

  return <>{children}</>;
}
