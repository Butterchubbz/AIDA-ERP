// src/components/RMATrackerView.js

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from './MessageBox'; // Correctly importing useMessageBox
import LoadingSpinner from './LoadingSpinner';
import { useRMATracker } from '../hooks/useRMATracker'; // Import the new hook

// --- RMA Entry Modal Component (Used for both Add and Edit) ---
const RMAEntryModal = ({ isOpen, onClose, onSubmit, isSubmitting, canEdit, initialData }) => {
  const [modalEntryData, setModalEntryData] = useState(
    initialData || {
      customerName: '',
      ticketNumber: '',
      orderNumber: '',
      device: '',
      trackingNumber: '',
    }
  );

  useEffect(() => {
    // Reset or set data when modal opens or initialData changes
    if (isOpen) {
      setModalEntryData(
        initialData || {
          customerName: '',
          ticketNumber: '',
          orderNumber: '',
          device: '',
          trackingNumber: '',
        }
      );
    }
  }, [isOpen, initialData]);

  const handleModalInputChange = e => {
    const { name, value } = e.target;
    setModalEntryData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    if (!canEdit) return;
    onSubmit(modalEntryData);
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id; // Check if we're in edit mode

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit RMA Entry' : 'New Inbound RMA / Return'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="rma-customer" className="block text-slate-300 text-sm font-bold mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rma-customer"
              name="customerName"
              placeholder="Customer Name"
              value={modalEntryData.customerName}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="rma-order" className="block text-slate-300 text-sm font-bold mb-1">
              Order Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rma-order"
              name="orderNumber"
              placeholder="Order Number"
              value={modalEntryData.orderNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="rma-ticket" className="block text-slate-300 text-sm font-bold mb-1">
              Ticket Number (Optional)
            </label>
            <input
              type="text"
              id="rma-ticket"
              name="ticketNumber"
              placeholder="Ticket Number"
              value={modalEntryData.ticketNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="rma-tracking" className="block text-slate-300 text-sm font-bold mb-1">
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rma-tracking"
              name="trackingNumber"
              placeholder="Tracking Number"
              value={modalEntryData.trackingNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="rma-device" className="block text-slate-300 text-sm font-bold mb-1">
              Device(s) / Items (e.g., V1410 Base, Qty 2)
            </label>
            <textarea
              id="rma-device"
              name="device"
              placeholder="List devices/items being returned, e.g., V1410-Base x1, V1211-250 x1"
              value={modalEntryData.device}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              rows="3"
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-y bg-slate-700 text-slate-100"
            ></textarea>
          </div>
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
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update RMA' : 'Add RMA Entry'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

function RMATrackerView() {
  const { currentUser, userRole } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();
  const {
    rmaEntries,
    loadingRMA,
    rmaError,
    addRMAEntry,
    updateRMAEntry,
    updateRMAStatus,
    deleteRMAEntry,
  } = useRMATracker();

  const [showRMAEntryModal, setShowRMAEntryModal] = useState(false);
  const [isAddingRMA, setIsAddingRMA] = useState(false);
  const [rmaToEdit, setRmaToEdit] = useState(null); // NEW: State to hold RMA entry being edited
  const [showEditRMAEntryModal, setShowEditRMAEntryModal] = useState(false); // NEW: State for edit modal visibility
  const [showCompleted, setShowCompleted] = useState(false); // State for completed section

  // Define possible status options for RMA
  const statusOptions = ['Incoming', 'Processing', 'Testing', 'Outgoing', 'Received', 'Completed'];

  // Permissions
  const canEdit = userRole === 'Admin' || userRole === 'Manager' || userRole === 'Collaborator';
  const canDelete = userRole === 'Admin' || userRole === 'Manager';
  const canView = !!currentUser;

  // Split RMAs into active and completed groups
  const { activeRmas, completedRmas } = useMemo(() => {
    const active = [];
    const completed = [];
    rmaEntries.forEach(rma => {
      if (rma.status === 'Completed') {
        completed.push(rma);
      } else {
        active.push(rma);
      }
    });
    // Sort completed by date descending to show the most recent ones first
    completed.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : 0;
      const dateB = b.timestamp ? new Date(b.timestamp) : 0;
      return dateB - dateA;
    });
    return { activeRmas: active, completedRmas: completed };
  }, [rmaEntries]);

  // Handles adding a new RMA entry from the RMAEntryModal
  const handleAddRMAEntry = async entryData => {
    if (!canEdit) {
      showToast('Permission denied. You do not have access to add RMA entries.', 'error');
      return;
    }
    if (!entryData.customerName || !entryData.orderNumber || !entryData.trackingNumber) {
      showToast('Please fill in Customer Name, Order Number, and Tracking Number.', 'error');
      return;
    }

    setIsAddingRMA(true);
    setShowRMAEntryModal(false);
    try {
      await addRMAEntry(entryData);
    } catch (e) {
      console.error('Error adding RMA entry: ', e);
    } finally {
      setIsAddingRMA(false);
    }
  };

  // NEW: Handles updating an existing RMA entry
  const handleUpdateRMAEntry = async updatedData => {
    if (!canEdit) {
      showToast('Permission denied. You do not have access to update RMA entries.', 'error');
      return;
    }
    if (!updatedData.id) {
      showToast('Error: No ID provided for RMA update.', 'error');
      return;
    }
    if (!updatedData.customerName || !updatedData.orderNumber || !updatedData.trackingNumber) {
      showToast('Please fill in Customer Name, Order Number, and Tracking Number.', 'error');
      return;
    }

    setIsAddingRMA(true); // Re-using this for loading state
    setShowEditRMAEntryModal(false); // Close modal immediately
    setRmaToEdit(null); // Clear item being edited
    try {
      // Remove id from the data to be updated
      const { id, ...dataToUpdate } = updatedData;
      await updateRMAEntry(id, dataToUpdate);
    } catch (e) {
      console.error('Error updating RMA entry: ', e);
    } finally {
      setIsAddingRMA(false);
    }
  };

  // Handles changing the status of an existing RMA entry (separate from full edit)
  const handleStatusChange = async (id, newStatus) => {
    if (!canEdit) {
      showToast('Permission denied. You do not have access to change RMA status.', 'error');
      return;
    }
    try {
      await updateRMAStatus(id, newStatus);
    } catch (e) {
      console.error('Error updating RMA status:', e);
    }
  };

  const getStatusRowClass = status => {
    switch (status) {
      case 'Incoming':
        return 'bg-yellow-900/20 hover:bg-yellow-900/30';
      case 'Processing':
        return 'bg-purple-900/20 hover:bg-purple-900/30';
      case 'Testing':
        return 'bg-indigo-900/20 hover:bg-indigo-900/30';
      case 'Outgoing':
        return 'bg-cyan-900/20 hover:bg-cyan-900/30';
      case 'Completed':
        return 'bg-emerald-900/20 hover:bg-emerald-900/30';
      case 'Received':
      default:
        return 'hover:bg-slate-700'; // Default hover for 'Received' and any other status
    }
  };

  // --- Carrier Detection and Tracking Logic ---
  const detectCarrier = trackingNumber => {
    if (/^1Z[0-9A-Z]{16}$/i.test(trackingNumber)) return 'UPS';
    if (/^9[0-9]{20,21}$/.test(trackingNumber) || /^94[0-9]{20}$/.test(trackingNumber))
      return 'USPS';
    if (/^[0-9]{12}$/.test(trackingNumber) || /^[0-9]{15}$/.test(trackingNumber)) return 'FedEx';
    if (/^[0-9]{10}$/.test(trackingNumber)) return 'DHL';
    return 'DHL'; // Default to DHL if no other carrier is detected
  };

  const getCarrierIcon = carrier => {
    switch (carrier) {
      case 'UPS':
        return <i className="fas fa-box-open text-yellow-500 ml-2" title="UPS"></i>;
      case 'FedEx':
        return <i className="fas fa-shipping-fast text-purple-500 ml-2" title="FedEx"></i>;
      case 'USPS':
        return <i className="fas fa-mail-bulk text-blue-500 ml-2" title="USPS"></i>;
      case 'DHL':
        return <i className="fas fa-globe-americas text-red-500 ml-2" title="DHL"></i>;
      default:
        return null;
    }
  };

  const openTrackingPage = trackingNumber => {
    const carrier = detectCarrier(trackingNumber);
    let url;

    switch (carrier) {
      case 'UPS':
        url = `https://www.ups.com/track?tracknum=${trackingNumber}`;
        break;
      case 'FedEx':
        url = `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
        break;
      case 'USPS':
        url = `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
        break;
      case 'DHL':
        url = `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
        break;
      default:
        url = `https://www.google.com/search?q=track+package+${trackingNumber}`;
    }
    window.open(url, '_blank');
  };

  // Handles deleting an RMA entry
  const handleDeleteRMAEntry = async id => {
    if (!canDelete) {
      showToast('Permission denied. You do not have permission to delete RMA entries.', 'error');
      return;
    }
    const confirmed = await showMessageBox(
      'Confirm Delete',
      'Are you sure you want to delete this RMA entry? This action cannot be undone.',
      true
    );
    if (!confirmed) return;

    try {
      await deleteRMAEntry(id);
    } catch (e) {
      console.error('Error deleting RMA entry:', e);
    }
  };

  // Function to open the Edit RMA Modal
  const openEditRMAEntryModal = entry => {
    setRmaToEdit(entry);
    setShowEditRMAEntryModal(true);
  };
  const closeEditRMAEntryModal = () => {
    setShowEditRMAEntryModal(false);
    setRmaToEdit(null);
  };

  // Reusable function to render a single RMA row
  const renderRmaRow = rma => (
    <tr key={rma.id} className={getStatusRowClass(rma.status)}>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">{rma.timestamp}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
        {rma.customerName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{rma.orderNumber}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
        {rma.ticketNumber || 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-pre-wrap text-sm text-slate-400">{rma.device}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 flex items-center">
        {rma.trackingNumber || 'N/A'}
        {rma.trackingNumber && getCarrierIcon(detectCarrier(rma.trackingNumber))}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <select
          value={rma.status}
          onChange={e => handleStatusChange(rma.id, e.target.value)}
          disabled={!canEdit}
          className="block w-full rounded-md border-slate-600 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 text-sm py-1 bg-slate-900 text-slate-100"
        >
          {statusOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {rma.trackingNumber && (
          <button
            onClick={() => openTrackingPage(rma.trackingNumber)}
            className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-sm font-medium"
          >
            Track
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => openEditRMAEntryModal(rma)}
            className="text-yellow-400 hover:text-yellow-300 ml-2 px-3 py-1 rounded-lg border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-sm font-medium"
          >
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => handleDeleteRMAEntry(rma.id)}
            className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-lg border border-red-700/30 hover:bg-red-700/20 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );

  if (loadingRMA) {
    return <LoadingSpinner />;
  }

  return (
    <section className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 mx-auto w-full text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-4">RMA / Return Tracking (AIDA)</h2>
      {canEdit && (
        <button
          onClick={() => setShowRMAEntryModal(true)}
          disabled={isAddingRMA}
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {isAddingRMA ? 'Adding Inbound...' : 'New Inbound (RMA/Return)'}
        </button>
      )}

      <h3 className="text-xl font-semibold text-cyan-300 mb-4">Active RMAs</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Entered
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Order No.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Ticket No.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Device(s)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Tracking No.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {activeRmas.map(renderRmaRow)}
          </tbody>
        </table>
        {activeRmas.length === 0 && (
          <p className="text-slate-400 text-center py-4">No active RMAs.</p>
        )}
      </div>

      {/* Completed RMAs Section */}
      <div className="mt-8 border-t border-slate-700 pt-6">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="w-full flex justify-between items-center text-left p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <h3 className="text-xl font-semibold text-cyan-300">
            Completed RMAs ({completedRmas.length})
          </h3>
          <i
            className={`fas fa-chevron-down transition-transform duration-300 ${
              showCompleted ? 'rotate-180' : ''
            }`}
          ></i>
        </button>
        {showCompleted && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Entered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Customer Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Order No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Ticket No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Device(s)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Tracking No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {completedRmas.map(renderRmaRow)}
              </tbody>
            </table>
            {completedRmas.length === 0 && (
              <p className="text-slate-400 text-center py-4">No completed RMAs.</p>
            )}
          </div>
        )}
      </div>

      {/* Modal for adding new RMA entries */}
      <RMAEntryModal
        isOpen={showRMAEntryModal}
        onClose={() => setShowRMAEntryModal(false)}
        onSubmit={handleAddRMAEntry}
        isSubmitting={isAddingRMA}
        canEdit={canEdit}
        initialData={null} // No initial data for add mode
      />

      {/* Modal for editing existing RMA entries */}
      {rmaToEdit && (
        <RMAEntryModal
          isOpen={showEditRMAEntryModal}
          onClose={closeEditRMAEntryModal}
          onSubmit={handleUpdateRMAEntry}
          isSubmitting={isAddingRMA}
          canEdit={canEdit}
          initialData={rmaToEdit} // Pass the data of the entry being edited
        />
      )}
    </section>
  );
}

export default RMATrackerView;
