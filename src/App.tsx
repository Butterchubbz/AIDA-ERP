import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AmazonView from './pages/AmazonView';
import InboundShipmentView from './pages/InboundShipmentView';
import QuoteApprovedView from './pages/QuoteApprovedView';
import RMATrackerView from './pages/RMATrackerView';
import InventoryComponentsView from './pages/InventoryComponentsView';
import RefurbishedDeviceView from './pages/RefurbishedDeviceView';
import UserManagementView from './pages/UserManagementView';
import DataManagementView from './pages/DataManagementView';
import ManualForecastingView from './pages/ManualForecastingView';
import DeviceForecastingView from './pages/DeviceForecastingView';
import ComponentForecastingView from './pages/ComponentForecastingView';
import AmazonProcessingView from './pages/AmazonProcessingView';
import AmazonOutgoingView from './pages/AmazonOutgoingView';
import SetupPage from './pages/SetupPage';

import ProfileView from './pages/ProfileView';
import InventoryDeviceView from './pages/InventoryDeviceView';

function App() {
  return (
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
    </Routes>
  );
}

export default App;
