// src/components/ComponentInventoryView.js

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useComponentInventory } from '../hooks/useComponentInventory';
import { useMessageBox } from './MessageBox';
import LoadingSpinner from './LoadingSpinner';
import { getSortIndicator, naturalSort } from './tableHelpers';
import ComponentForm from './ComponentForm'; // Import the reusable form
import StockCountModal from './StockCountModal'; // Import the new modal

// --- ComponentInventoryView Component ---
function ComponentInventoryView() {
  const {
    componentInventory,
    loadingComponents,
    componentError,
    addComponent,
    updateComponent,
    deleteComponent,
    batchUpdateComponents,
    fetchComponentHistory,
  } = useComponentInventory();
  const { userRole } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('sku');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modals
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [showEditComponentModal, setShowEditComponentModal] = useState(false);
  const [componentToEdit, setComponentToEdit] = useState(null);
  const [showCountModal, setShowCountModal] = useState(false);
  const [isCounting, setIsCounting] = useState(false);

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState(null);
  const [itemHistoryRecords, setItemHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Role-based permissions
  const canAddDeleteEdit = userRole === 'Admin' || userRole === 'Manager';
  const canCount = userRole === 'Admin' || userRole === 'Manager' || userRole === 'Collaborator';

  // DEBUG: Log modal visibility state
  useEffect(() => {
    console.log('ComponentInventoryView - showAddComponentModal:', showAddComponentModal);
    console.log('ComponentInventoryView - showEditComponentModal:', showEditComponentModal);
    console.log('ComponentInventoryView - componentToEdit:', componentToEdit);
  }, [showAddComponentModal, showEditComponentModal, componentToEdit]);

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

  // Filter and Sort component inventory
  const groupedAndSortedInventory = useMemo(() => {
    let currentInventory = [...componentInventory];

    const filteredItems = currentInventory.filter(
      item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group items by category and subcategory
    const grouped = filteredItems.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      const subcategory = item.subcategory || 'General';

      if (!acc[category]) {
        acc[category] = {};
      }
      if (!acc[category][subcategory]) {
        acc[category][subcategory] = [];
      }
      acc[category][subcategory].push(item);
      return acc;
    }, {});

    // Convert the grouped object into a sorted array for rendering
    return Object.keys(grouped)
      .sort()
      .map(categoryName => {
        const subcategories = grouped[categoryName];
        const sortedSubcategories = Object.keys(subcategories)
          .sort()
          .map(subcategoryName => {
            const items = subcategories[subcategoryName];
            // Sort items within the subcategory by the user-selected column
            items.sort((a, b) => {
              const aValue = a[sortColumn];
              const bValue = b[sortColumn];

              // Use numeric sort for stock columns
              if (['wooStock', 'countedStock'].includes(sortColumn)) {
                const numA = parseFloat(aValue) || 0;
                const numB = parseFloat(bValue) || 0;
                if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
                if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
              }

              // Use natural sort for everything else (name, sku)
              const result = naturalSort(aValue, bValue, sortDirection);
              if (result !== 0) return result;
              return naturalSort(a.sku, b.sku, 'asc'); // Secondary sort by SKU
            });
            return { subcategoryName, items };
          });
        return { categoryName, subcategories: sortedSubcategories };
      });
  }, [componentInventory, searchTerm, sortColumn, sortDirection]);

  // --- Component CRUD Handlers ---
  const handleAddOrUpdateComponent = async data => {
    // Validation for required fields
    if (!data.name || !data.sku) {
      showToast('Component Name and SKU are required.', 'error');
      return;
    }

    // Construct the payload with the correct fields
    const payload = {
      name: data.name,
      sku: data.sku,
      wooStock: parseFloat(data.wooStock) || 0,
      category: data.category,
      subcategory: data.subcategory,
      countedStock: parseFloat(data.countedStock) || 0,
    };

    if (componentToEdit) {
      await updateComponent(componentToEdit.id, payload);
    } else {
      await addComponent(payload);
    }
    // showToast is handled by the hook now
    setShowAddComponentModal(false); // Close add modal
    setShowEditComponentModal(false); // Close edit modal
    setComponentToEdit(null); // Clear item to edit
  };

  const handleDeleteComponent = async component => {
    if (!canAddDeleteEdit) {
      showToast('You do not have permission to delete components.', 'error');
      return;
    }
    if (!component) return;
    const confirmed = await showMessageBox(
      'Confirm Deletion',
      `Are you sure you want to delete component "${component.name}"? This action cannot be undone.`,
      true
    );
    if (confirmed) {
      await deleteComponent(component.id);
    }
  };

  const openEditModal = item => {
    setComponentToEdit(item);
    setShowEditComponentModal(true);
  };

  const handleSaveComponentCounts = async updates => {
    if (updates.length === 0) {
      showToast('No changes to save.', 'info');
      setShowCountModal(false);
      return;
    }
    setIsCounting(true);
    try {
      await batchUpdateComponents(updates);
      showToast(`Successfully updated counts for ${updates.length} components.`, 'success');
    } catch (error) {
      showToast('Failed to save some counts. Please check the logs.', 'error');
      console.error('Error during batch component count update:', error);
    } finally {
      setIsCounting(false);
      setShowCountModal(false);
    }
  };

  // --- History Modal Logic ---
  const openHistoryModal = async item => {
    setHistoryLoading(true);
    setSelectedItemHistory(item);
    setItemHistoryRecords([]);
    setShowHistoryModal(true);
    try {
      const history = await fetchComponentHistory(item.id);
      setItemHistoryRecords(history);
    } catch (e) {
      console.error('Error fetching component history:', e);
      showToast('Failed to load component history.', 'error');
      setItemHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedItemHistory(null);
    setItemHistoryRecords([]);
  };

  if (loadingComponents) {
    return <LoadingSpinner />;
  }

  if (componentError) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p className="font-semibold mb-2">Error loading Components inventory:</p>
        <p>{componentError}</p>
        <p className="mt-2 text-sm">
          Please try refreshing the page or check your internet connection.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-microchip text-blue-400 mr-2"></i>Component List
      </h2>

      {canCount && (
        <div className="flex justify-start mb-6">
          <button
            onClick={() => setShowCountModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Perform a full stock count for all components"
          >
            <i className="fas fa-clipboard-check mr-2"></i>
            Count Stock
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
          aria-label="Search component items"
        />
      </div>

      {groupedAndSortedInventory.length === 0 && !loadingComponents ? (
        <div className="text-center text-slate-400 p-8 border-2 border-dashed border-slate-700 rounded-lg">
          <p className="text-xl font-medium mb-2">No components found.</p>
          <p>Add a new component to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('sku')}
                >
                  SKU {getSortIndicator(sortColumn, 'sku', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('name')}
                >
                  Component Name {getSortIndicator(sortColumn, 'name', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('wooStock')}
                >
                  Woo Stock {getSortIndicator(sortColumn, 'wooStock', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('countedStock')}
                >
                  Counted Stock {getSortIndicator(sortColumn, 'countedStock', sortDirection)}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            {groupedAndSortedInventory.map(({ categoryName, subcategories }) => (
              <tbody key={categoryName} className="bg-slate-800 divide-y divide-slate-700">
                <tr className="bg-slate-900/70">
                  <td colSpan="5" className="px-4 py-2 text-lg font-bold text-cyan-300">
                    {categoryName}
                  </td>
                </tr>
                {subcategories.map(({ subcategoryName, items }) => (
                  <React.Fragment key={subcategoryName}>
                    <tr className="bg-slate-800/50">
                      <td colSpan="5" className="px-8 py-1 text-md font-semibold text-blue-300">
                        {subcategoryName}
                      </td>
                    </tr>
                    {items.map(item => {
                      const highlightRow = item.wooStock > item.countedStock;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-700 ${
                            highlightRow ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {item.sku}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-300 font-bold">
                            {item.wooStock || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-300 font-bold">
                            {item.countedStock || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              {canAddDeleteEdit && (
                                <>
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded-md border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-xs font-medium"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComponent(item)}
                                    className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-md border border-red-700/30 hover:bg-red-700/20 transition-colors text-xs font-medium"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openHistoryModal(item)}
                                className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded-md border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-xs font-medium"
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {canAddDeleteEdit && (
        <button
          onClick={() => {
            setShowAddComponentModal(true);
            setComponentToEdit(null);
          }}
          className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform duration-300 transform hover:scale-110"
          title="Add New Component"
        >
          <i className="fas fa-plus text-2xl"></i>
        </button>
      )}

      {/* Reusable Component Add/Edit Form */}
      <ComponentForm
        isOpen={showAddComponentModal || showEditComponentModal} // Use OR to show for both add/edit
        onClose={() => {
          setShowAddComponentModal(false);
          setShowEditComponentModal(false);
          setComponentToEdit(null);
        }}
        onSubmit={handleAddOrUpdateComponent}
        isSubmitting={loadingComponents} // Pass the loading state from the hook
        initialData={componentToEdit} // Pass data for editing
      />

      {/* Stock Count Modal */}
      <StockCountModal
        isOpen={showCountModal}
        onClose={() => setShowCountModal(false)}
        items={groupedAndSortedInventory}
        onSubmit={handleSaveComponentCounts}
        itemType="component"
        isSubmitting={isCounting}
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
          </div>, // First argument of createPortal ends here.
          document.body // Second argument of createPortal
        )}
    </div>
  );
}

export default ComponentInventoryView;
