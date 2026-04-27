import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useModeStore } from '../../stores/mode';

const Sidebar = ({ userRoles }: { userRoles: { [key: string]: string } | null }) => {
  const location = useLocation();
  const { isTeam } = useModeStore();

  const isPathActive = useCallback(
    (pathSegment: string): boolean => {
      return location.pathname.startsWith(pathSegment);
    },
    [location.pathname]
  );

  const isOrdersPathActive = useCallback(
    () => isPathActive('/orders') || isPathActive('/quotes'),
    [isPathActive]
  );

  const [isInventoryOpen, setInventoryOpen] = useState(isPathActive('/inventory'));
  const [isForecastingOpen, setForecastingOpen] = useState(isPathActive('/forecasting'));
  const [isAmazonOpen, setAmazonOpen] = useState(isPathActive('/amazon'));
  const [isOrdersOpen, setOrdersOpen] = useState(isOrdersPathActive());

  useEffect(() => {
    setInventoryOpen(isPathActive('/inventory'));
    setForecastingOpen(isPathActive('/forecasting'));
    setAmazonOpen(isPathActive('/amazon'));
    setOrdersOpen(isOrdersPathActive());
  }, [isOrdersPathActive, isPathActive]);

  const baseLinkClasses =
    'w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center';
  const activeLinkClasses = 'bg-blue-600 text-white shadow-md rounded-lg';
  const inactiveLinkClasses = 'text-slate-300 hover:bg-slate-700 hover:text-white';

  const baseSubLinkClasses =
    'w-full text-left pl-12 pr-4 py-2 rounded-md text-sm font-medium transition-colors';
  const activeSubLinkClasses = 'bg-slate-600 text-white';
  const inactiveSubLinkClasses = 'text-slate-400 hover:bg-slate-700 hover:text-white';

  const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `${baseLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`;
  const getSubNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `${baseSubLinkClasses} ${isActive ? activeSubLinkClasses : inactiveSubLinkClasses}`;

  return (
    <aside className="w-64 bg-[#142a52] text-white flex-shrink-0 p-4 flex flex-col rounded-xl shadow-2xl border border-blue-900">
      <nav className="flex-grow pt-8">
        <ul className="space-y-2">
          <li>
            <NavLink to="/dashboard" className={getNavLinkClass}>
              <i className="fas fa-tachometer-alt w-6 text-center mr-3"></i>
              Dashboard
            </NavLink>
          </li>

          {userRoles?.Inventory && userRoles.Inventory !== 'None' && (
            <li>
              <button
                onClick={() => setInventoryOpen(!isInventoryOpen)}
                className={`${baseLinkClasses} justify-between ${
                  isPathActive('/inventory') ? 'text-white' : 'text-slate-300'
                }`}
              >
                <span className="flex items-center">
                  <i className="fas fa-boxes w-6 text-center mr-3"></i>
                  Inventory
                </span>
                <i
                  className={`fas fa-chevron-down transition-transform ${
                    isInventoryOpen ? 'rotate-180' : ''
                  }`}
                ></i>
              </button>
              {isInventoryOpen && (
                <ul className="mt-2 space-y-2">
                  <li>
                    <NavLink to="/inventory/devices" className={getSubNavLinkClass}>
                      Devices
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/inventory/components" className={getSubNavLinkClass}>
                      Components
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/inventory/refurbished" className={getSubNavLinkClass}>
                      Refurbished/RMA
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          )}

          {userRoles?.Forecasting && userRoles.Forecasting !== 'None' && (
            <li>
              <button
                onClick={() => setForecastingOpen(!isForecastingOpen)}
                className={`${baseLinkClasses} justify-between ${
                  isPathActive('/forecasting') ? 'text-white' : 'text-slate-300'
                }`}
              >
                <span className="flex items-center">
                  <i className="fas fa-chart-line w-6 text-center mr-3"></i>
                  Forecasting
                </span>
                <i
                  className={`fas fa-chevron-down transition-transform ${
                    isForecastingOpen ? 'rotate-180' : ''
                  }`}
                ></i>
              </button>
              {isForecastingOpen && (
                <ul className="mt-2 space-y-2">
                  <li>
                    <NavLink to="/forecasting/devices" className={getSubNavLinkClass}>
                      Devices
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/forecasting/component" className={getSubNavLinkClass}>
                      Components
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/forecasting/purchase-order" className={getSubNavLinkClass}>
                      Purchase Orders
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/forecasting/manual" className={getSubNavLinkClass}>
                      Manual
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/forecasting/settings" className={getSubNavLinkClass}>
                      Settings
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          )}

          {userRoles?.Amazon && userRoles.Amazon !== 'None' && (
            <li>
              <button
                onClick={() => setAmazonOpen(!isAmazonOpen)}
                className={`${baseLinkClasses} justify-between ${
                  isPathActive('/amazon') ? 'text-white' : 'text-slate-300'
                }`}
              >
                <span className="flex items-center">
                  <i className="fab fa-amazon w-6 text-center mr-3"></i>
                  Amazon
                </span>
                <i
                  className={`fas fa-chevron-down transition-transform ${
                    isAmazonOpen ? 'rotate-180' : ''
                  }`}
                ></i>
              </button>
              {isAmazonOpen && (
                <ul className="mt-2 space-y-2">
                  <li>
                    <NavLink to="/amazon" className={getSubNavLinkClass}>
                      Overview
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/amazon/processing" className={getSubNavLinkClass}>
                      Processing
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/amazon/outgoing" className={getSubNavLinkClass}>
                      Outgoing
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          )}

          {userRoles?.Orders && userRoles.Orders !== 'None' && (
            <li>
              <button
                onClick={() => setOrdersOpen(!isOrdersOpen)}
                className={`${baseLinkClasses} justify-between ${
                  isOrdersPathActive() ? 'text-white' : 'text-slate-300'
                }`}
              >
                <span className="flex items-center">
                  <i className="fas fa-file-invoice-dollar w-6 text-center mr-3"></i>
                  Orders
                </span>
                <i
                  className={`fas fa-chevron-down transition-transform ${
                    isOrdersOpen ? 'rotate-180' : ''
                  }`}
                ></i>
              </button>
              {isOrdersOpen && (
                <ul className="mt-2 space-y-2">
                  <li>
                    <NavLink to="/quotes/approved" className={getSubNavLinkClass}>
                      Quote Approved
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          )}

          {userRoles?.['Inbound Shipments'] && userRoles['Inbound Shipments'] !== 'None' && (
            <li>
              <NavLink to="/shipments/inbound" className={getNavLinkClass}>
                <i className="fas fa-truck-loading w-6 text-center mr-3"></i>Inbound Shipments
              </NavLink>
            </li>
          )}

          {userRoles?.['RMA Tracker'] && userRoles['RMA Tracker'] !== 'None' && (
            <li>
              <NavLink to="/inventory/rma" className={getNavLinkClass}>
                <i className="fas fa-undo-alt w-6 text-center mr-3"></i>RMA / Returns
              </NavLink>
            </li>
          )}

          <div className="border-t border-slate-700 my-2"></div>
          <li>
            <NavLink to="/profile" className={getNavLinkClass}>
              <i className="fas fa-user-circle w-6 text-center mr-3"></i>My Profile
            </NavLink>
          </li>
          {isTeam && (userRoles?.Admin === 'Editor' || userRoles?.Admin === 'Admin') && (
            <>
              <li>
                <NavLink to="/users" className={getNavLinkClass}>
                  <i className="fas fa-users-cog w-6 text-center mr-3"></i>User Management
                </NavLink>
              </li>
            </>
          )}
          {userRoles?.Admin === 'Editor' && (
            <>
              <li>
                <NavLink to="/data" className={getNavLinkClass}>
                  <i className="fas fa-cog w-6 text-center mr-3"></i>AIDA Management
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>
      <div className="mt-auto">{/* Footer or user info can go here */}</div>
    </aside>
  );
};

export default Sidebar;
