// src/components/InboundShipmentView.js

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useInboundShipments } from '../hooks/useInboundShipments';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from './MessageBox';
import LoadingSpinner from './LoadingSpinner';
import { serverTimestamp } from 'firebase/firestore';

// --- Inbound Shipment Entry Modal Component (Used for both Add and Edit) ---
const InboundShipmentModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  canEdit,
  initialData,
  searchSKU,
}) => {
  const [modalEntryData, setModalEntryData] = useState(
    initialData || {
      poNumber: '',
      trackingNumber: '',
      vendor: '',
      shipmentType: 'Air Shipment',
      status: 'In Transit',
      notes: '',
      items: [],
    }
  );

  const [modalEntryItems, setModalEntryItems] = useState(
    initialData?.items || [{ sku: '', quantity: 0 }]
  );
  const [skuSearchResults, setSkuSearchResults] = useState([]);
  const [activeSkuSearch, setActiveSkuSearch] = useState(-1);

  useEffect(() => {
    if (isOpen) {
      setModalEntryData(
        initialData || {
          poNumber: '',
          trackingNumber: '',
          vendor: '',
          shipmentType: 'Air Shipment',
          status: 'In Transit',
          notes: '',
          items: [],
        }
      );
      setModalEntryItems(initialData?.items || [{ sku: '', quantity: 0 }]);
    }
  }, [isOpen, initialData]);

  const handleModalInputChange = e => {
    const { name, value } = e.target;
    setModalEntryData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddItem = () => {
    setModalEntryItems(prev => [...prev, { sku: '', quantity: 0 }]);
  };

  const handleRemoveItem = index => {
    setModalEntryItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setModalEntryItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSkuSearch = async (index, searchString) => {
    handleItemChange(index, 'sku', searchString);
    if (searchString.length > 2) {
      const results = await searchSKU(searchString);
      setSkuSearchResults(results);
      setActiveSkuSearch(index);
    } else {
      setSkuSearchResults([]);
      setActiveSkuSearch(-1);
    }
  };

  const selectSku = (index, sku) => {
    handleItemChange(index, 'sku', sku);
    setSkuSearchResults([]);
    setActiveSkuSearch(-1);
  };

  const handleSubmit = () => {
    if (!canEdit) return;
    onSubmit({ ...modalEntryData, items: modalEntryItems });
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit Inbound Shipment' : 'New Inbound Shipment'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="po-number" className="block text-slate-300 text-sm font-bold mb-1">
              PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="po-number"
              name="poNumber"
              placeholder="Purchase Order Number"
              value={modalEntryData.poNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="tracking-number"
              className="block text-slate-300 text-sm font-bold mb-1"
            >
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="tracking-number"
              name="trackingNumber"
              placeholder="Shipment Tracking Number"
              value={modalEntryData.trackingNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="vendor" className="block text-slate-300 text-sm font-bold mb-1">
              Vendor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vendor"
              name="vendor"
              placeholder="Vendor Name"
              value={modalEntryData.vendor}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="shipment-type" className="block text-slate-300 text-sm font-bold mb-1">
              Shipment Type
            </label>
            <select
              id="shipment-type"
              name="shipmentType"
              value={modalEntryData.shipmentType}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            >
              <option value="Air Shipment">Air Shipment</option>
              <option value="Sea Shipment">Sea Shipment</option>
            </select>
          </div>
          {isEditMode && (
            <div className="col-span-full">
              <label htmlFor="status" className="block text-slate-300 text-sm font-bold mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={modalEntryData.status}
                onChange={handleModalInputChange}
                disabled={isSubmitting}
                className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
              >
                {[
                  'In Transit',
                  'Arrived at Customs',
                  'Customs Cleared',
                  'Out for Delivery',
                  'Complete',
                ].map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-full">
            <label htmlFor="notes" className="block text-slate-300 text-sm font-bold mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Any additional notes about the shipment"
              value={modalEntryData.notes}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              rows="3"
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-y bg-slate-700 text-slate-100"
            ></textarea>
          </div>
        </div>
        {/* Items Section */}
        <div className="col-span-full mt-4 border-t border-slate-700 pt-4">
          <h4 className="text-lg font-bold text-slate-300 mb-3">Shipment Items</h4>
          {modalEntryItems.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 p-3 border border-slate-700 rounded-md bg-slate-700/30 relative"
            >
              <div className="md:col-span-2">
                <label
                  htmlFor={`sku-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  SKU
                </label>
                <input
                  type="text"
                  id={`sku-${index}`}
                  value={item.sku}
                  onChange={e => handleSkuSearch(index, e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Item SKU"
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
                {activeSkuSearch === index && skuSearchResults.length > 0 && (
                  <ul className="absolute z-10 w-full bg-slate-900 border border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto">
                    {skuSearchResults.map((result, resultIndex) => (
                      <li
                        key={resultIndex}
                        onClick={() => selectSku(index, result.sku)}
                        className="p-2 hover:bg-slate-700 cursor-pointer"
                      >
                        {result.sku}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label
                  htmlFor={`quantity-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  Quantity
                </label>
                <input
                  type="number"
                  id={`quantity-${index}`}
                  value={item.quantity}
                  onChange={e =>
                    handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)
                  }
                  disabled={isSubmitting}
                  placeholder="Quantity"
                  min="0"
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={isSubmitting || modalEntryItems.length === 1}
                  className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddItem}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Item
          </button>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Shipment' : 'Add Shipment'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Main InboundShipmentView Component ---
function InboundShipmentView() {
  const {
    inboundShipments,
    loading,
    error,
    addInboundShipment,
    updateInboundShipment,
    deleteInboundShipment,
    pushShipmentToInventory,
    searchSKU,
  } = useInboundShipments();
  const { currentUser } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [showAddShipmentModal, setShowAddShipmentModal] = useState(false);
  const [isAddingShipment, setIsAddingShipment] = useState(false);
  const [shipmentToEdit, setShipmentToEdit] = useState(null);
  const [showEditShipmentModal, setShowEditShipmentModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const statusOptions = [
    'In Transit',
    'Arrived at Customs',
    'Customs Cleared',
    'Out for Delivery',
    'Complete',
  ];
  const canEdit = !!currentUser;

  useEffect(() => {
    inboundShipments.forEach(shipment => {
      if (
        shipment.status === 'Complete' &&
        shipment.items &&
        shipment.items.some(item => !item.pushed)
      ) {
        pushShipmentToInventory(shipment.id);
      }
    });
  }, [inboundShipments, pushShipmentToInventory]);

  // Add shipment
  const handleAddShipment = async shipmentData => {
    if (!currentUser || !canEdit) {
      showToast('Permission denied. You must be authenticated to add shipments.', 'error');
      return;
    }
    if (!shipmentData.poNumber || !shipmentData.trackingNumber || !shipmentData.vendor) {
      showToast('Please fill in PO Number, Tracking Number, and Vendor.', 'error');
      return;
    }
    setIsAddingShipment(true);
    setShowAddShipmentModal(false);
    try {
      await addInboundShipment(shipmentData);
      showToast('Inbound shipment added successfully!', 'success');
    } catch (e) {
      console.error('Error adding inbound shipment: ', e);
      showToast('Failed to add inbound shipment. Please try again.', 'error');
    } finally {
      setIsAddingShipment(false);
    }
  };

  // Update shipment
  const handleUpdateShipment = async updatedData => {
    if (!currentUser || !canEdit) {
      showToast('Permission denied. You must be authenticated to update shipments.', 'error');
      return;
    }
    if (!updatedData.id) {
      showToast('Error: No ID provided for shipment update.', 'error');
      return;
    }
    if (!updatedData.poNumber || !updatedData.trackingNumber || !updatedData.vendor) {
      showToast('Please fill in PO Number, Tracking Number, and Vendor.', 'error');
      return;
    }
    setIsAddingShipment(true);
    setShowEditShipmentModal(false);
    setShipmentToEdit(null);
    try {
      await updateInboundShipment(updatedData.id, updatedData);
      if (updatedData.status === 'Complete') {
        await pushShipmentToInventory(updatedData.id);
      }
      showToast('Inbound shipment updated successfully!', 'success');
    } catch (e) {
      console.error('Error updating inbound shipment: ', e);
      showToast('Failed to update inbound shipment. Please try again.', 'error');
    } finally {
      setIsAddingShipment(false);
    }
  };

  // Status change
  const handleStatusChange = async (id, newStatus) => {
    if (!currentUser || !canEdit) {
      showToast('Permission denied. You must be authenticated to change shipment status.', 'error');
      return;
    }
    try {
      await updateInboundShipment(id, {
        status: newStatus,
        lastUpdatedBy: currentUser.email || currentUser.uid,
        lastUpdatedAt: serverTimestamp(),
      });
      if (newStatus === 'Complete') {
        await pushShipmentToInventory(id);
      }
      showToast('Shipment status updated!', 'success');
    } catch (e) {
      console.error('Error updating shipment status:', e);
      showToast('Failed to update shipment status. Please try again.', 'error');
    }
  };

  // Confirmation toggle (always pass items)
  const handleConfirmationToggle = async (shipmentId, field, currentValue, items) => {
    if (!currentUser || !canEdit) {
      showToast('Permission denied. You must be authenticated to confirm actions.', 'error');
      return;
    }
    try {
      await updateInboundShipment(shipmentId, {
        [field]: !currentValue,
        items: items,
        lastUpdatedBy: currentUser.email || currentUser.uid,
        lastUpdatedAt: serverTimestamp(),
      });
      showToast(`${field} ${!currentValue ? 'confirmed' : 'unconfirmed'}!`, 'success');
    } catch (e) {
      console.error(`Error toggling ${field}:`, e);
      showToast(`Failed to toggle ${field}.`, 'error');
    }
  };

  // Tracking page
  const openTrackingPage = (trackingNumber, shipmentType) => {
    let url;
    if (shipmentType === 'Sea Shipment') {
      url = `https://nvogo.nvoconsolidation.com/tracker;trackingnr=${trackingNumber}`;
    } else {
      url = `https://www.google.com/search?q=track+package+${trackingNumber}`;
    }
    if (url) {
      window.open(url, '_blank');
    } else {
      showToast('Tracking URL could not be determined.', 'error');
    }
  };

  // Delete shipment
  const handleDeleteShipment = async (id, poNumber) => {
    if (!currentUser || !canEdit) {
      showToast('Permission denied. You must be authenticated to delete shipments.', 'error');
      return;
    }
    const confirmed = await showMessageBox(
      'Confirm Delete',
      `Are you sure you want to delete shipment "${poNumber}"? This action cannot be undone.`,
      true
    );
    if (!confirmed) return;
    try {
      await deleteInboundShipment(id);
      showToast('Inbound shipment deleted successfully!', 'success');
    } catch (e) {
      console.error('Error deleting inbound shipment:', e);
      showToast('Failed to delete inbound shipment.', 'error');
    }
  };

  // Edit modal
  const openEditShipmentModal = shipment => {
    setShipmentToEdit(shipment);
    setShowEditShipmentModal(true);
  };
  const closeEditShipmentModal = () => {
    setShowEditShipmentModal(false);
    setShipmentToEdit(null);
  };

  if (loading) return <LoadingSpinner />;

  const inProgressShipments = inboundShipments.filter(s => s.status !== 'Complete');
  const completedShipments = inboundShipments.filter(s => s.status === 'Complete');

  const renderShipmentTable = (shipments, title) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-cyan-300 mb-3">{title}</h3>
      {shipments.length === 0 ? (
        <p className="text-slate-400 text-center py-4">No shipments in this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Entered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Tracking No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customs Docs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Agent Emailed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Spreadsheets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {shipments.map(shipment => (
                <tr key={shipment.id} className="hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                    {shipment.timestamp}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                    {shipment.poNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {shipment.trackingNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {shipment.vendor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {shipment.shipmentType || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select
                      value={shipment.status}
                      onChange={e => handleStatusChange(shipment.id, e.target.value)}
                      disabled={!canEdit}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-1 bg-white text-gray-900"
                    >
                      {statusOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <input
                      type="checkbox"
                      checked={shipment.customsDocsDownloaded || false}
                      onChange={() =>
                        handleConfirmationToggle(
                          shipment.id,
                          'customsDocsDownloaded',
                          shipment.customsDocsDownloaded,
                          shipment.items
                        )
                      }
                      disabled={!canEdit}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <input
                      type="checkbox"
                      checked={shipment.importAgentEmailed || false}
                      onChange={() =>
                        handleConfirmationToggle(
                          shipment.id,
                          'importAgentEmailed',
                          shipment.importAgentEmailed,
                          shipment.items
                        )
                      }
                      disabled={!canEdit}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <input
                      type="checkbox"
                      checked={shipment.spreadsheetsUpdated || false}
                      onChange={() =>
                        handleConfirmationToggle(
                          shipment.id,
                          'spreadsheetsUpdated',
                          shipment.spreadsheetsUpdated,
                          shipment.items
                        )
                      }
                      disabled={!canEdit}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    <div className="max-h-20 overflow-y-auto whitespace-pre-wrap">
                      {shipment.notes || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {shipment.items && shipment.items.length > 0 ? (
                      <ul className="list-disc list-inside text-xs max-h-32 overflow-y-auto">
                        {shipment.items.map((item, itemIndex) => (
                          <li key={itemIndex}>
                            {item.sku}: {item.quantity} {item.pushed ? '(Pushed)' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {shipment.trackingNumber && (
                      <button
                        onClick={() =>
                          openTrackingPage(shipment.trackingNumber, shipment.shipmentType)
                        }
                        className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-xs font-medium"
                      >
                        Track
                      </button>
                    )}
                    {canEdit && (
                      <>
                        {shipment.status === 'Complete' &&
                          shipment.items &&
                          shipment.items.some(item => !item.pushed) && (
                            <button
                              onClick={() => pushShipmentToInventory(shipment.id)}
                              disabled={loading}
                              className="text-green-400 hover:text-green-300 px-3 py-1 rounded-lg border border-green-700/30 hover:bg-green-700/20 transition-colors text-xs font-medium"
                            >
                              Push to Inventory
                            </button>
                          )}
                        <button
                          onClick={() => openEditShipmentModal(shipment)}
                          className="text-yellow-400 hover:text-yellow-300 ml-2 px-3 py-1 rounded-lg border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteShipment(shipment.id, shipment.poNumber)}
                          className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-lg border border-red-700/30 hover:bg-red-700/20 transition-colors text-sm font-medium"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <section className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 mx-auto w-full text-slate-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-cyan-400">Inbound Shipments (AIDA)</h2>
        {canEdit && (
          <button
            onClick={() => setShowAddShipmentModal(true)}
            disabled={isAddingShipment}
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingShipment ? 'Adding...' : 'Add New Shipment'}
          </button>
        )}
      </div>

      {renderShipmentTable(inProgressShipments, 'In-Progress')}

      {completedShipments.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            {showCompleted ? 'Hide' : 'Show'} Completed ({completedShipments.length})
          </button>
          {showCompleted && renderShipmentTable(completedShipments, 'Completed')}
        </div>
      )}

      {inboundShipments.length === 0 && (
        <p className="text-slate-400 text-center py-4">
          No inbound shipments yet. Add a new shipment.
        </p>
      )}

      <InboundShipmentModal
        isOpen={showAddShipmentModal}
        onClose={() => setShowAddShipmentModal(false)}
        onSubmit={handleAddShipment}
        isSubmitting={isAddingShipment}
        canEdit={canEdit}
        initialData={null}
        searchSKU={searchSKU}
      />

      {shipmentToEdit && (
        <InboundShipmentModal
          isOpen={showEditShipmentModal}
          onClose={closeEditShipmentModal}
          onSubmit={handleUpdateShipment}
          isSubmitting={isAddingShipment}
          canEdit={canEdit}
          initialData={shipmentToEdit}
          searchSKU={searchSKU}
        />
      )}
    </section>
  );
}

export default InboundShipmentView;
