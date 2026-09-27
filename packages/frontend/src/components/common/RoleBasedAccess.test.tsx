import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireModule from './RequireModule';
import Sidebar from './Sidebar';
import Layout from './Layout';
import { isModuleAllowed, ROLE_MODULES, ROLE_PERMISSIONS, type AppRole, type User } from '@aida/shared';

// Helper to mock useAuth for different test roles
let currentRole: AppRole = 'Viewer';
let currentUserEmail = 'user@example.com';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => {
    const user: User = {
      id: 'test-user-id',
      email: currentUserEmail,
      name: 'Test User',
      role: currentRole,
      roles: ROLE_PERMISSIONS[currentRole],
    };

    return {
      user,
      role: currentRole,
      isLoggedIn: true,
      userRoles: ROLE_PERMISSIONS[currentRole],
      can: (module: string) => isModuleAllowed(currentRole, module),
      login: vi.fn(),
      logout: vi.fn(),
      loadingAuth: false,
    };
  },
}));

describe('Role-Based UI Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Protection with RequireModule', () => {
    const renderRoute = (initialPath = '/users') => {
      return render(
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="/users"
              element={
                <RequireModule module="Admin">
                  <div data-testid="user-management-page">User Management Content</div>
                </RequireModule>
              }
            />
            <Route
              path="/data"
              element={
                <RequireModule module="Admin">
                  <div data-testid="data-management-page">Data Management Content</div>
                </RequireModule>
              }
            />
            <Route
              path="/forecasting/settings"
              element={
                <RequireModule module="settings/forecasting">
                  <div data-testid="forecasting-settings-page">Forecasting Settings Content</div>
                </RequireModule>
              }
            />
            <Route
              path="/dashboard"
              element={<div data-testid="dashboard-page">Dashboard Content</div>}
            />
          </Routes>
        </MemoryRouter>
      );
    };

    test('viewer is blocked from /users and sees NoAccess page', () => {
      currentRole = 'Viewer';
      currentUserEmail = 'viewer@example.com';

      renderRoute('/users');

      expect(screen.getByTestId('no-access')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-page')).not.toBeInTheDocument();
    });

    test('manager is blocked from /users and sees NoAccess page', () => {
      currentRole = 'Manager';
      currentUserEmail = 'manager@example.com';

      renderRoute('/users');

      expect(screen.getByTestId('no-access')).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-page')).not.toBeInTheDocument();
    });

    test('admin is allowed on /users and views the page content', () => {
      currentRole = 'Admin';
      currentUserEmail = 'admin@example.com';

      renderRoute('/users');

      expect(screen.queryByTestId('no-access')).not.toBeInTheDocument();
      expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      expect(screen.getByText('User Management Content')).toBeInTheDocument();
    });

    test('viewer is blocked from /forecasting/settings', () => {
      currentRole = 'Viewer';
      currentUserEmail = 'viewer@example.com';

      renderRoute('/forecasting/settings');

      expect(screen.getByTestId('no-access')).toBeInTheDocument();
      expect(screen.queryByTestId('forecasting-settings-page')).not.toBeInTheDocument();
    });

    test('manager is allowed on /forecasting/settings', () => {
      currentRole = 'Manager';
      currentUserEmail = 'manager@example.com';

      renderRoute('/forecasting/settings');

      expect(screen.queryByTestId('no-access')).not.toBeInTheDocument();
      expect(screen.getByTestId('forecasting-settings-page')).toBeInTheDocument();
    });

    test('admin is allowed on /forecasting/settings', () => {
      currentRole = 'Admin';
      currentUserEmail = 'admin@example.com';

      renderRoute('/forecasting/settings');

      expect(screen.queryByTestId('no-access')).not.toBeInTheDocument();
      expect(screen.getByTestId('forecasting-settings-page')).toBeInTheDocument();
    });

    test('viewer navigating to /users within Layout sees Sidebar without Admin links and main area shows NoAccess', () => {
      currentRole = 'Viewer';
      currentUserEmail = 'viewer@example.com';

      render(
        <MemoryRouter initialEntries={['/users']}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route
                path="users"
                element={
                  <RequireModule module="Admin">
                    <div data-testid="user-management-page">User Management Content</div>
                  </RequireModule>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      // Main content shows NoAccess
      expect(screen.getByTestId('no-access')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /return to dashboard/i })).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-page')).not.toBeInTheDocument();

      // Sidebar is rendered, but Admin links are hidden
      expect(screen.queryByRole('link', { name: /user management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /data management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /integrations/i })).not.toBeInTheDocument();
    });
  });

  describe('Sidebar Navigation Filtering', () => {
    const renderSidebar = (initialPath = '/dashboard') => {
      return render(
        <MemoryRouter initialEntries={[initialPath]}>
          <Sidebar />
        </MemoryRouter>
      );
    };

    test('viewer sidebar hides admin links (/users, /data, /integrations) and forecasting settings', () => {
      currentRole = 'Viewer';
      currentUserEmail = 'viewer@example.com';

      renderSidebar();

      // Open Forecasting dropdown
      const forecastingButton = screen.getByRole('button', { name: /forecasting/i });
      fireEvent.click(forecastingButton);

      // Open AIDA Management dropdown
      const managementButton = screen.getByRole('button', { name: /aida management/i });
      fireEvent.click(managementButton);

      // Admin modules must NOT be in the sidebar for Viewer
      expect(screen.queryByRole('link', { name: /user management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /data management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /integrations/i })).not.toBeInTheDocument();

      // Forecasting Settings must NOT be in the sidebar for Viewer
      expect(screen.queryByRole('link', { name: /^settings$/i })).not.toBeInTheDocument();

      // Readable modules must be visible
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /my profile/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /devices/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /components/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /purchase orders/i })).toBeInTheDocument();
    });

    test('manager sidebar shows forecasting settings but hides admin links', () => {
      currentRole = 'Manager';
      currentUserEmail = 'manager@example.com';

      renderSidebar();

      // Open Forecasting dropdown
      const forecastingButton = screen.getByRole('button', { name: /forecasting/i });
      fireEvent.click(forecastingButton);

      // Open AIDA Management dropdown
      const managementButton = screen.getByRole('button', { name: /aida management/i });
      fireEvent.click(managementButton);

      // Forecasting settings MUST be in the sidebar for Manager
      expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();

      // Admin links must NOT be in the sidebar for Manager
      expect(screen.queryByRole('link', { name: /user management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /data management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /integrations/i })).not.toBeInTheDocument();

      // Profile is visible
      expect(screen.getByRole('link', { name: /my profile/i })).toBeInTheDocument();
    });

    test('admin sidebar shows all links including users, data, integrations, and forecasting settings', () => {
      currentRole = 'Admin';
      currentUserEmail = 'admin@example.com';

      renderSidebar();

      // Open Forecasting dropdown
      const forecastingButton = screen.getByRole('button', { name: /forecasting/i });
      fireEvent.click(forecastingButton);

      // Open AIDA Management dropdown
      const managementButton = screen.getByRole('button', { name: /aida management/i });
      fireEvent.click(managementButton);

      // All links must be in the sidebar for Admin
      expect(screen.getByRole('link', { name: /^settings$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /user management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /data management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /integrations/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /my profile/i })).toBeInTheDocument();
    });
  });

  describe('Consistency: frontend can(route) === backend isModuleAllowed(role, module)', () => {
    // Routes wrapped in RequireModule in App.tsx with their configured module requirement
    const routesWrappedInRequireModule = [
      { route: 'forecasting/settings', module: 'settings/forecasting' },
      { route: '/forecasting/settings', module: 'settings/forecasting' },
      { route: 'users', module: 'Admin' },
      { route: '/users', module: 'Admin' },
      { route: 'data', module: 'Admin' },
      { route: '/data', module: 'Admin' },
      { route: 'integrations', module: 'Admin' },
      { route: '/integrations', module: 'Admin' },
    ] as const;

    test('for every role in ROLE_MODULES and every route wrapped in RequireModule in App.tsx, frontend can(route) matches backend isModuleAllowed(role, module)', () => {
      const roles = Object.keys(ROLE_MODULES) as AppRole[];
      const mismatches: Array<{
        role: AppRole;
        route: string;
        module: string;
        frontendCan: boolean;
        backendAllowed: boolean;
      }> = [];

      for (const role of roles) {
        // frontend can(route) evaluates route path
        const frontendCan = (targetRoute: string) => isModuleAllowed(role, targetRoute);

        for (const { route, module } of routesWrappedInRequireModule) {
          const feAllowed = frontendCan(route);
          const beAllowed = isModuleAllowed(role, module);

          if (feAllowed !== beAllowed) {
            mismatches.push({
              role,
              route,
              module,
              frontendCan: feAllowed,
              backendAllowed: beAllowed,
            });
          }
        }
      }

      // Explicitly report any mismatches rather than fixing silently
      expect(
        mismatches,
        `Found role/route consistency mismatches: ${JSON.stringify(mismatches, null, 2)}`
      ).toEqual([]);
    });
  });
});
