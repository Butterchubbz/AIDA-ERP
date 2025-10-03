// src/components/InventoryList.js

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useInventoryContext } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/MessageBox';
import StockCountModal from './StockCountModal';
import LoadingSpinner from './LoadingSpinner';
import { getSortIndicator, naturalSort } from './tableHelpers';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// --- InventoryList Component ---
const InventoryList = ({ onEditItem, onAddItem }) => {
  const { inventory, loading, error, deleteItem, updateItem, fetchItemHistory } =
    useInventoryContext();
  const { userRoles, inventorySortOrder, updateInventorySortOrder } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCountModal, setShowCountModal] = useState(false);
  const [isCounting, setIsCounting] = useState(false);

  // Sorting states
  const [sortColumn, setSortColumn] = useState('sku');
  const [sortDirection, setSortDirection] = useState('asc');

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState(null);
  const [itemHistoryRecords, setItemHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Role-based permissions
  const canAddDeleteEdit = userRoles.Inventory === 'Editor';
  const canCount = userRoles.Inventory === 'Editor' || userRoles.Inventory === 'Viewer';

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

  const onDragEnd = result => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(sortedInventory);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const newSortOrder = items.map(item => item.id);
    updateInventorySortOrder(newSortOrder);
  };

  // Filter and Sort inventory
  const sortedInventory = useMemo(() => {
    let currentInventory = [...inventory];

    currentInventory = currentInventory.filter(
      item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (inventorySortOrder && inventorySortOrder.length > 0) {
      currentInventory.sort((a, b) => {
        const aIndex = inventorySortOrder.indexOf(a.id);
        const bIndex = inventorySortOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    } else if (sortColumn) {
      currentInventory.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (
          ['wooStock', 'productionStock', 'warehouseStock', 'reserveStock'].includes(sortColumn)
        ) {
          const numA = parseFloat(aValue) || 0;
          const numB = parseFloat(bValue) || 0;
          if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
          if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
        }

        const result = naturalSort(aValue, bValue, sortDirection);
        if (result !== 0) return result;

        if (sortColumn !== 'name') {
          return naturalSort(a.name, b.name, 'asc');
        }
        return 0;
      });
    }
    return currentInventory;
  }, [inventory, searchTerm, sortColumn, sortDirection, inventorySortOrder]);

  const handleDeleteClick = async (itemId, itemName) => {
    if (!canAddDeleteEdit) {
      showToast('You do not have permission to delete items.', 'error');
      return;
    }

    const confirmed = await showMessageBox(
      'Confirm Deletion',
      `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      true
    );

    if (confirmed) {
      await deleteItem(itemId);
      showToast('Success', `"${itemName}" deleted successfully!`, 'success');
    }
  };

  const handleSaveVaultCounts = async updates => {
    if (updates.length === 0) {
      showToast('No changes to save.', 'info');
      setShowCountModal(false);
      return;
    }
    setIsCounting(true);
    try {
      for (const update of updates) {
        await updateItem(update.id, update.updatedFields);
      }
      showToast(`Successfully updated counts for ${updates.length} vaults.`, 'success');
    } catch (error) {
      showToast('Failed to save some counts. Please check the logs.', 'error');
      console.error('Error during vault count update:', error);
    } finally {
      setIsCounting(false);
      setShowCountModal(false);
    }
  };

  const openHistoryModal = async item => {
    setHistoryLoading(true);
    setSelectedItemHistory(item);
    setItemHistoryRecords([]);
    setShowHistoryModal(true);
    try {
      const history = await fetchItemHistory(item.id);
      setItemHistoryRecords(history);
    } catch (e) {
      console.error('Error fetching item history:', e);
      showToast('Failed to load item history.', 'error');
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

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100 pb-24">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-cubes text-purple-400 mr-2"></i>Vaults
      </h2>
      {canCount && (
        <div className="flex justify-start mb-6">
          <button
            onClick={() => setShowCountModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Perform a full stock count for all vaults"
          >
            <i className="fas fa-clipboard-check mr-2"></i>
            Count Stock
          </button>
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
          aria-label="Search inventory items"
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
          <p className="font-semibold mb-2">Error loading Vaults:</p>
          <p>{error}</p>
          <p className="mt-2 text-sm">
            Please try refreshing the page or check your internet connection.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 shadow-md rounded-lg overflow-hidden">
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
                    Item Name {getSortIndicator(sortColumn, 'name', sortDirection)}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                    onClick={() => handleSort('wooStock')}
                  >
                    Woo Stock {getSortIndicator(sortColumn, 'wooStock', sortDirection)}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Counted Stock
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                    onClick={() => handleSort('reserveStock')}
                  >
                    Reserve Stock {getSortIndicator(sortColumn, 'reserveStock', sortDirection)}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <Droppable droppableId="inventory">
                {provided => (
                  <tbody
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="bg-slate-800 divide-y divide-slate-700"
                  >
                    {sortedInventory.map((item, index) => {
                      const countedStock = (item.productionStock || 0) + (item.warehouseStock || 0);
                      const highlightRow = item.wooStock > countedStock;

                      return (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {provided => (
                            <tr
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
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
                                {countedStock}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-bold">
                                {item.reserveStock || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-2">
                                  {canAddDeleteEdit && (
                                    <>
                                      <button
                                        onClick={() => onEditItem(item)}
                                        className="text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded-md border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-xs font-medium"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteClick(item.id, item.name)}
                                        className="text-red-400 hover:text-red-300 px-3 py-1 rounded-md border border-red-700/30 hover:bg-red-700/20 transition-colors text-xs font-medium"
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
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </tbody>
                )}
              </Droppable>
            </table>
          </div>
        </DragDropContext>
      )}

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

      <StockCountModal
        isOpen={showCountModal}
        onClose={() => setShowCountModal(false)}
        items={sortedInventory}
        onSubmit={handleSaveVaultCounts}
        itemType="vault"
        isSubmitting={isCounting}
      />

      {canAddDeleteEdit && (
        <button
          onClick={onAddItem}
          className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform duration-300 transform hover:scale-110"
          title="Add New Item"
        >
          <i className="fas fa-plus text-2xl"></i>
        </button>
      )}
    </div>
  );
};

export default InventoryList;
