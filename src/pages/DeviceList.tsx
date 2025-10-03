import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDeviceContext } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/common/MessageBox';
import DeviceStockCountModal from '../components/modules/DeviceStockCountModal';
import type { StockCountUpdate } from '../types/stock';
import type { HistoryRecord } from '../types/history';
import { getSortIndicator, naturalSort } from '../utils/tableHelpers';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DeviceItem } from '../types/device';

// --- DeviceList Component ---
interface DeviceListProps {
  onEditItem: (item: DeviceItem) => void;
  onAddItem: () => void;
}

const DeviceList: React.FC<DeviceListProps> = ({ onEditItem, onAddItem }) => {
  const { devices, deleteDeviceItem, updateDeviceItem } = useDeviceContext();
  const { userRoles } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCountModal, setShowCountModal] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [sortColumn, setSortColumn] = useState('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState<DeviceItem | null>(null);
  const [itemHistoryRecords, setItemHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const canAddDeleteEdit = userRoles?.Inventory === 'Editor';

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const onDragEnd = (result: { destination: { index: number } | null; source: { index: number } }) => {
    if (!result.destination) return;
    // ...drag logic if needed...
  };

  const sortedDevices = useMemo(() => {
    let currentInventory = [...devices];
    currentInventory = currentInventory.filter(
      item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (sortColumn) {
      currentInventory.sort((a, b) => {
        const aValue = a[sortColumn as keyof DeviceItem];
        const bValue = b[sortColumn as keyof DeviceItem];
        if (
          ['onlineStock', 'productionStock', 'warehouseStock', 'reserveStock'].includes(sortColumn)
        ) {
          const numA = parseFloat(aValue as string) || 0;
          const numB = parseFloat(bValue as string) || 0;
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
  }, [devices, searchTerm, sortColumn, sortDirection]);

  const handleDeleteClick = async (itemId: string, itemName: string) => {
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
      await deleteDeviceItem(itemId);
      showToast(`"${itemName}" deleted successfully!`, 'success');
    }
  };

  const handleSaveDeviceCounts = async (updates: StockCountUpdate[]) => {
    if (updates.length === 0) {
      showToast('No changes to save.', 'info');
      setShowCountModal(false);
      return;
    }
    setIsCounting(true);
    try {
      for (const update of updates) {
        await updateDeviceItem(update.id, { countedStock: update.countedStock });
      }
      showToast(`Successfully updated counts for ${updates.length} devices.`, 'success');
    } catch (error) {
      showToast('Failed to save some counts. Please check the logs.', 'error');
      console.error('Error during device count update:', error);
    } finally {
      setIsCounting(false);
      setShowCountModal(false);
    }
  };

  const openHistoryModal = async (item: DeviceItem) => {
    setHistoryLoading(true);
    setSelectedItemHistory(item);
    // Placeholder: initialize history records (fetching not implemented yet)
    setItemHistoryRecords([]);
    setShowHistoryModal(true);
  };

  const closeHistoryModal = () => setShowHistoryModal(false);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="mb-4">
        {canAddDeleteEdit && (
          <div className="flex justify-start mb-6">
            <button
              onClick={() => setShowCountModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              title="Perform a full stock count for all devices"
            >
              <i className="fas fa-clipboard-check mr-2"></i>
              Count Stock
            </button>
          </div>
        )}
        <input
          type="text"
          placeholder="Search by name or SKU..."
          className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
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
                Item Name {getSortIndicator(sortColumn, 'name', sortDirection)}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                onClick={() => handleSort('onlineStock')}
              >
                Online Stock {getSortIndicator(sortColumn, 'onlineStock', sortDirection)}
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
                className="bg-slate-900 divide-y divide-slate-800"
              >
                {sortedDevices.map((item, index) => {
                  const countedStock = (item.productionStock || 0) + (item.warehouseStock || 0);
                  const highlightRow = item.onlineStock > countedStock;
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {provided => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`hover:bg-slate-800 ${
                            highlightRow ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30' : ''
                          } ${index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800'}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {item.sku}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-300 font-bold">
                            {item.onlineStock || 0}
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
                                    className="px-3 py-1 rounded-lg border border-yellow-700/30 bg-yellow-900/20 text-yellow-300 hover:bg-yellow-700/30 hover:text-yellow-100 transition-colors text-xs font-semibold shadow"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(item.id, item.name)}
                                    className="px-3 py-1 rounded-lg border border-red-700/30 bg-red-900/20 text-red-300 hover:bg-red-700/30 hover:text-red-100 transition-colors text-xs font-semibold shadow"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openHistoryModal(item)}
                                className="px-3 py-1 rounded-lg border border-blue-700/30 bg-blue-900/20 text-blue-300 hover:bg-blue-700/30 hover:text-blue-100 transition-colors text-xs font-semibold shadow"
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
      <DeviceStockCountModal
        isOpen={showCountModal}
        onClose={() => setShowCountModal(false)}
        items={sortedDevices}
        onSubmit={handleSaveDeviceCounts}
        itemType="device"
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
      {showHistoryModal &&
        selectedItemHistory &&
        createPortal(
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-screen-lg transform transition-all scale-100 opacity-100 my-8 text-slate-100">
              <h3 className="text-lg font-bold mb-4 text-cyan-400">
                Stock History for "{selectedItemHistory?.name}"
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
    </DragDropContext>
  );
};

export default DeviceList;
