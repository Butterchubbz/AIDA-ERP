// src/App.js

import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar'; // Import the new Sidebar
import Header from './components/Header'; // Contains the Auth component
import InventoryForm from './components/InventoryForm'; // Form for adding/editing items (now a modal)
import InventoryList from './components/InventoryList'; // Displays the list of Vaults
import LoadingSpinner from './components/LoadingSpinner'; // Generic loading indicator
import { useAuth } from './context/AuthContext'; // Access authentication state
import { useInventoryContext } from './context/InventoryContext'; // Access inventory data and actions
import RMATrackerView from './components/RMATrackerView'; // Import RMATrackerView
import AmazonView from './components/AmazonView'; // Import AmazonView
import ManualForecastingView from './components/ManualForecastingView'; // Import ManualForecastingView
import InboundShipmentView from './components/InboundShipmentView'; // Import InboundShipmentView
import DashboardView from './components/DashboardView'; // Import DashboardView

// NEW: Import the specific inventory sub-views
import ComponentInventoryView from './components/ComponentInventoryView';
import RefurbishedDeviceView from './components/RefurbishedDeviceView'; // Import the new view
import VaultForecastingView from './components/VaultForecastingView';
import ComponentForecastingView from './components/ComponentForecastingView';
import AmazonProcessingView from './components/AmazonProcessingView';
import AmazonOutgoingView from './components/AmazonOutgoingView';
import QuoteApprovedView from './components/QuoteApprovedView';
import ProfileView from './views/ProfileView'; // New Profile View
import UserManagementView from './views/UserManagementView'; // New User Management View
import DataManagementView from './views/DataManagementView';
import LoginView from './views/LoginView'; // New Login View

/**
 * The main application component (AIDA - Accurate Inventory Data Assistant).
 * It orchestrates the overall layout, manages the item being edited,
 * conditionally renders content based on authentication status,
 * and now includes a dashboard for multiple functions.
 */
function App() {
  // State to hold the item currently being edited.
  const [itemToEdit, setItemToEdit] = useState(null);
  // State to control the visibility of the "Add Item" modal
  const [showAddModal, setShowAddModal] = useState(false); // This state is specific to the Vaults view now

  // Access authentication state from AuthContext
  const { currentUser, userRoles, loadingAuth } = useAuth();
  // Access inventory loading state from InventoryContext
  const { loading: loadingInventory, error: inventoryError } = useInventoryContext();

  /**
   * Callback function passed to InventoryList to initiate an edit operation.
   * When an item's 'Edit' button is clicked, this function is called with the item data.
   * This will open the InventoryForm modal in edit mode.
   * @param {object} item - The inventory item object to be edited.
   */
  const handleEditItem = item => {
    setItemToEdit(item);
    setShowAddModal(true); // Open the modal in edit mode
  };

  /**
   * Callback function passed to InventoryForm.
   * Called when an item is successfully added or updated, or when 'Cancel' is clicked during edit.
   * This resets the form to "add new item" mode.
   * @param {boolean} success - True if the form submission was successful, false if cancelled.
   */
  const handleFormSubmitSuccess = success => {
    if (success !== false) {
      setItemToEdit(null); // Clear the item being edited to revert form to "add" mode
    } else {
      setItemToEdit(null);
    }
    setShowAddModal(false); // Ensure modal closes
  };

  /**
   * Callback for closing the InventoryForm modal.
   * Resets itemToEdit if the modal was closed without saving/cancelling an edit.
   */
  const handleCloseModal = () => {
    setShowAddModal(false);
    setItemToEdit(null); // Ensure itemToEdit is cleared when modal closes
  };

  return (
    <div className="min-h-screen bg-slate-900 font-inter antialiased text-slate-100">
      {loadingAuth ? (
        <LoadingSpinner />
      ) : !currentUser ? (
        <LoginView />
      ) : (
        <div className="flex min-h-screen">
          {/* Persistent Sidebar */}
          <Sidebar userRoles={userRoles} />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-grow p-6">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<DashboardView />} />
                {userRoles.Inventory && userRoles.Inventory !== 'None' && (
                  <Route
                    path="/inventory/vaults"
                    element={
                      <>
                        {loadingInventory ? (
                          <LoadingSpinner />
                        ) : (
                          <InventoryList
                            onEditItem={handleEditItem}
                            onAddItem={() => {
                              setItemToEdit(null);
                              setShowAddModal(true);
                            }}
                          />
                        )}
                        {inventoryError && (
                          <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center mt-4">
                            <p className="font-semibold">Inventory Data Error:</p>
                            <p>{inventoryError}</p>
                          </div>
                        )}
                      </>
                    }
                  />
                )}
                {userRoles.Inventory && userRoles.Inventory !== 'None' && (
                  <Route path="/inventory/components" element={<ComponentInventoryView />} />
                )}
                {userRoles.Inventory && userRoles.Inventory !== 'None' && (
                  <Route path="/inventory/refurbished" element={<RefurbishedDeviceView />} />
                )}
                {userRoles.Amazon && userRoles.Amazon !== 'None' && (
                  <Route path="/amazon/overview" element={<AmazonView />} />
                )}
                {userRoles.Amazon && userRoles.Amazon !== 'None' && (
                  <Route path="/amazon/processing" element={<AmazonProcessingView />} />
                )}
                {userRoles.Amazon && userRoles.Amazon !== 'None' && (
                  <Route path="/amazon/outgoing" element={<AmazonOutgoingView />} />
                )}
                {userRoles.Forecasting && userRoles.Forecasting !== 'None' && (
                  <Route path="/forecasting/vault" element={<VaultForecastingView />} />
                )}
                {userRoles.Forecasting && userRoles.Forecasting !== 'None' && (
                  <Route path="/forecasting/component" element={<ComponentForecastingView />} />
                )}
                {userRoles.Forecasting && userRoles.Forecasting !== 'None' && (
                  <Route path="/forecasting/manual" element={<ManualForecastingView />} />
                )}
                {userRoles['RMA Tracker'] && userRoles['RMA Tracker'] !== 'None' && (
                  <Route path="/rma-tracking" element={<RMATrackerView />} />
                )}
                {userRoles['Inbound Shipments'] && userRoles['Inbound Shipments'] !== 'None' && (
                  <Route path="/inbound-shipments" element={<InboundShipmentView />} />
                )}
                {userRoles.Orders && userRoles.Orders !== 'None' && (
                  <Route path="/orders/quote-approved" element={<QuoteApprovedView />} />
                )}
                <Route path="/profile" element={<ProfileView />} />
                {userRoles.Admin === 'Editor' && (
                  <Route path="/user-management" element={<UserManagementView />} />
                )}
                {userRoles.Admin === 'Editor' && (
                  <Route path="/data-management" element={<DataManagementView />} />
                )}
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </main>
          </div>

          <InventoryForm
            isOpen={showAddModal}
            onClose={handleCloseModal}
            itemToEdit={itemToEdit}
            onFormSubmitSuccess={handleFormSubmitSuccess}
          />
        </div>
      )}
    </div>
  );
}

export default App;
