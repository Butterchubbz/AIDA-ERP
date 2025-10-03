// src/components/RefurbishedDeviceView.js
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRefurbishedDevices } from '../hooks/useRefurbishedDevices'; // New hook
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { useMessageBox } from './MessageBox';
import LoadingSpinner from './LoadingSpinner';
import { getSortIndicator, naturalSort } from './tableHelpers';
import RefurbishedDeviceForm from './RefurbishedDeviceForm'; // The form we created earlier

function RefurbishedDeviceView() {
  const { devices, loading, error, addDevice, updateDevice, deleteDevice, fetchDeviceHistory } =
    useRefurbishedDevices();
  const { userRole } = useAuth(); // Get user role
  const { showMessageBox, showToast } = useMessageBox();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState(null);

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState(null);
  const [itemHistoryRecords, setItemHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine permissions based on role
  const canEdit = userRole === 'Admin' || userRole === 'Manager';

  const handleSearchChange = e => {
    setSearchTerm(e.target.value);
  };

  const handleSort = column => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedDevices = useMemo(() => {
    let currentDevices = [...devices];

    const filteredItems = currentDevices.filter(
      item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredItems.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Use numeric sort for stock columns
      if (['refurbishedStock'].includes(sortColumn)) {
        const numA = parseFloat(aValue) || 0;
        const numB = parseFloat(bValue) || 0;
        if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
        if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
      }

      // Use natural sort for everything else
      const result = naturalSort(aValue, bValue, sortDirection);
      if (result !== 0) return result;

      if (sortColumn !== 'sku') return naturalSort(a.sku, b.sku, 'asc');
      return 0;
    });

    return filteredItems;
  }, [devices, searchTerm, sortColumn, sortDirection]);

  const handleAddOrUpdateDevice = async data => {
    setIsSubmitting(true);
    try {
      if (deviceToEdit) {
        await updateDevice(deviceToEdit.id, data);
      } else {
        await addDevice(data);
      }
      setShowAddModal(false);
      setShowEditModal(false);
      setDeviceToEdit(null);
    } catch (e) {
      // Toast is handled by the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDevice = async device => {
    if (!canEdit) {
      showToast('You do not have permission to delete devices.', 'error');
      return;
    }
    if (!device) return;
    const confirmed = await showMessageBox(
      'Confirm Deletion',
      `Are you sure you want to delete refurbished device "${device.name}"? This action cannot be undone.`,
      true
    );
    if (confirmed) {
      await deleteDevice(device.id);
    }
  };

  const openEditModal = item => {
    if (!canEdit) {
      showToast('You do not have permission to edit devices.', 'error');
      return;
    }
    setDeviceToEdit(item);
    setShowEditModal(true);
  };

  const openHistoryModal = async item => {
    setHistoryLoading(true);
    setSelectedItemHistory(item);
    setItemHistoryRecords([]);
    setShowHistoryModal(true);
    try {
      const history = await fetchDeviceHistory(item.id);
      setItemHistoryRecords(history);
    } catch (e) {
      console.error('Error fetching device history:', e);
      showToast('Failed to load device history.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedItemHistory(null);
    setItemHistoryRecords([]);
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p className="font-semibold mb-2">Error loading Refurbished Devices:</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-tools text-orange-400 mr-2"></i>Refurbished/RMA Devices
      </h2>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search refurbished devices"
        />
      </div>

      {sortedDevices.length === 0 && !loading ? (
        <div className="text-center text-slate-400 p-8 border-2 border-dashed border-slate-700 rounded-lg">
          <p className="text-xl font-medium mb-2">No refurbished devices found.</p>
          <p>Add a new device to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('name')}
                >
                  Device Name {getSortIndicator(sortColumn, 'name', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('sku')}
                >
                  SKU {getSortIndicator(sortColumn, 'sku', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('refurbishedStock')}
                >
                  Refurbished Stock{' '}
                  {getSortIndicator(sortColumn, 'refurbishedStock', sortDirection)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {sortedDevices.map(device => (
                <tr key={device.id} className="hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                    {device.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {device.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-300 font-bold">
                    {device.refurbishedStock || 0}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 max-w-xs truncate"
                    title={device.notes}
                  >
                    {device.notes}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end items-center space-x-2">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => openEditModal(device)}
                            className="text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded-md border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(device)}
                            className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-md border border-red-700/30 hover:bg-red-700/20 transition-colors text-xs font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openHistoryModal(device)}
                        className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded-md border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-xs font-medium"
                      >
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <button
          onClick={() => {
            setShowAddModal(true);
            setDeviceToEdit(null);
          }}
          className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform duration-300 transform hover:scale-110"
          title="Add New Refurbished Device"
        >
          <i className="fas fa-plus text-2xl"></i>
        </button>
      )}

      <RefurbishedDeviceForm
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setDeviceToEdit(null);
        }}
        onSubmit={handleAddOrUpdateDevice}
        isSubmitting={isSubmitting}
        initialData={deviceToEdit}
      />

      {/* History Modal */}
      {showHistoryModal &&
        selectedItemHistory &&
        createPortal(
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-screen-lg transform transition-all scale-100 opacity-100 my-8 text-slate-100">
              <h3 className="text-lg font-bold mb-4 text-cyan-400">
                Stock History for "{selectedItemHistory.name}"
              </h3>
              {historyLoading ? (
                <p className="text-center py-4 text-slate-400">Loading history...</p>
              ) : itemHistoryRecords.length === 0 ? (
                <p className="text-center py-4 text-slate-400">
                  No history records found for this item.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Field
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Old Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          New Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Change
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Changed By
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                      {itemHistoryRecords.map(record => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                            {record.timestamp}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {record.field}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {record.oldValue}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {record.newValue}
                          </td>
                          <td
                            className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                              record.change < 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {record.change > 0 ? '+' : ''}
                            {record.change}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {record.changedByEmail}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end mt-6">
                <button
                  onClick={closeHistoryModal}
                  className="px-4 py-2 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default RefurbishedDeviceView;
