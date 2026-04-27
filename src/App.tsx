import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';
import FirstRunDetector from './components/common/FirstRunDetector';

const Login = React.lazy(() => import('./pages/Login'));
const SetupPage = React.lazy(() => import('./pages/SetupPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const InventoryDeviceView = React.lazy(() => import('./pages/InventoryDeviceView'));
const InventoryComponentsView = React.lazy(() => import('./pages/InventoryComponentsView'));
const RefurbishedDeviceView = React.lazy(() => import('./pages/RefurbishedDeviceView'));
const DeviceForecastingView = React.lazy(() => import('./pages/DeviceForecastingView'));
const ComponentForecastingView = React.lazy(() => import('./pages/ComponentForecastingView'));
const ManualForecastingView = React.lazy(() => import('./pages/ManualForecastingView'));
const ForecastingSettingsView = React.lazy(() => import('./pages/ForecastingSettingsView'));
const PurchaseOrderView = React.lazy(() => import('./pages/PurchaseOrderView'));
const AmazonView = React.lazy(() => import('./pages/AmazonView'));
const AmazonProcessingView = React.lazy(() => import('./pages/AmazonProcessingView'));
const AmazonOutgoingView = React.lazy(() => import('./pages/AmazonOutgoingView'));
const QuoteApprovedView = React.lazy(() => import('./pages/QuoteApprovedView'));
const InboundShipmentView = React.lazy(() => import('./pages/InboundShipmentView'));
const RMATrackerView = React.lazy(() => import('./pages/RMATrackerView'));
const ProfileView = React.lazy(() => import('./pages/ProfileView'));
const UserManagementView = React.lazy(() => import('./pages/UserManagementView'));
const DataManagementView = React.lazy(() => import('./pages/DataManagementView'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-slate-900 text-cyan-400">
          Loading...
        </div>
      }
    >
      <FirstRunDetector />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory/devices" element={<InventoryDeviceView />} />
          <Route path="inventory/components" element={<InventoryComponentsView />} />
          <Route path="inventory/refurbished" element={<RefurbishedDeviceView />} />
          <Route path="forecasting/devices" element={<DeviceForecastingView />} />
          <Route path="forecasting/component" element={<ComponentForecastingView />} />
          <Route path="forecasting/manual" element={<ManualForecastingView />} />
          <Route path="forecasting/purchase-order" element={<PurchaseOrderView />} />
          <Route path="forecasting/settings" element={<ForecastingSettingsView />} />
          <Route path="amazon" element={<AmazonView />} />
          <Route path="amazon/processing" element={<AmazonProcessingView />} />
          <Route path="amazon/outgoing" element={<AmazonOutgoingView />} />
          <Route path="quotes/approved" element={<QuoteApprovedView />} />
          <Route path="shipments/inbound" element={<InboundShipmentView />} />
          <Route path="inventory/rma" element={<RMATrackerView />} />
          <Route path="profile" element={<ProfileView />} />
          <Route path="users" element={<UserManagementView />} />
          <Route path="data" element={<DataManagementView />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
