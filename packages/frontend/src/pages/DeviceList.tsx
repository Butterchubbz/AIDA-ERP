import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDeviceContext } from '../context/DeviceContext';
import { useAccessoryContext } from '../context/AccessoryContext';
import { useComponentInventory } from '../hooks/useInventoryModules';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/common/MessageBox';
import MoveSkuModal from '../components/modules/MoveSkuModal';
import DeviceStockCountModal from '../components/modules/DeviceStockCountModal';
import CameraScannerModal from '../components/modules/CameraScannerModal';
import type { StockCountUpdate } from '@aida/shared';
import { getSortIndicator, naturalSort } from '../utils/tableHelpers';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type { DeviceItem } from '@aida/shared';
import InventoryEventLog from '../components/inventory/InventoryEventLog';
import { apiClient } from '../lib/apiClient';

// --- DeviceList Component ---
interface DeviceListProps {
  onEditItem: (item: DeviceItem) => void;
  onAddItem: () => void;
}

const DeviceList: React.FC<DeviceListProps> = ({ onEditItem, onAddItem }) => {
  const { devices, deleteDeviceItem, updateDeviceItem, refetch: refetchDevices } = useDeviceContext();
  const { refetch: refetchAccessories } = useAccessoryContext();
  const { refetch: refetchComponents } = useComponentInventory();
  const { userRoles } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const DEVICE_ORDER_KEY = 'aida_device_order';

  const [searchTerm, setSearchTerm] = useState('');
  const [showCountModal, setShowCountModal] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [sortColumn, setSortColumn] = useState('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState<DeviceItem | null>(null);
  const [orderedDevices, setOrderedDevices] = useState<DeviceItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [userHasSorted, setUserHasSorted] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<DeviceItem | null>(null);
  const [isMoveLoading, setIsMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState('');
  const justDragged = React.useRef(false);
  const canAddDeleteEdit = userRoles?.Inventory === 'Editor';

  useEffect(() => {
    if (devices.length === 0) return;
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    const savedOrder: string[] = JSON.parse(localStorage.getItem(DEVICE_ORDER_KEY) || '[]');
    if (savedOrder.length > 0) {
      const orderMap = new Map(savedOrder.map((id, idx) => [id, idx]));
      const sorted = [...devices].sort(
        (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
      );
      setOrderedDevices(sorted);
    } else {
      setOrderedDevices([...devices]);
    }
    setIsDirty(false);
  }, [devices]);

  const handleSort = (column: string) => {
    setUserHasSorted(true);
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const onDragStart = useCallback(() => {
    justDragged.current = true;
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination || result.destination.index === result.source.index) {
        justDragged.current = false;
        return;
      }
      const reordered = [...orderedDevices];
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      setOrderedDevices(reordered);
      setIsDirty(true);
      if (userHasSorted) setUserHasSorted(false);
      justDragged.current = false;
    },
    [orderedDevices, userHasSorted]
  );

  const handleSaveOrder = useCallback(() => {
    localStorage.setItem(DEVICE_ORDER_KEY, JSON.stringify(orderedDevices.map(i => i.id)));
    setIsDirty(false);
    showToast('Order saved', 'success');
  }, [orderedDevices, showToast]);

  const handleResetOrder = useCallback(() => {
    localStorage.removeItem(DEVICE_ORDER_KEY);
    setOrderedDevices([...devices]);
    setIsDirty(false);
    setUserHasSorted(false);
  }, [devices]);

  const displayDevices = useMemo(() => {
    const filtered = orderedDevices.filter(
      item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!userHasSorted) return filtered;
    return [...filtered].sort((a, b) => {
      const aValue = a[sortColumn as keyof DeviceItem];
      const bValue = b[sortColumn as keyof DeviceItem];
      if (['onlineStock', 'productionStock', 'warehouseStock', 'reserveStock'].includes(sortColumn)) {
        const numA = parseFloat(String(aValue)) || 0;
        const numB = parseFloat(String(bValue)) || 0;
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
  }, [orderedDevices, searchTerm, sortColumn, sortDirection, userHasSorted]);

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

  const handleMoveClick = (item: DeviceItem) => {
    if (!canAddDeleteEdit) {
      showToast('You do not have permission to move items.', 'error');
      return;
    }
    setItemToMove(item);
    setShowMoveModal(true);
    setMoveError('');
  };

  const handleMoveConfirm = async (toCollection: 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory') => {
    if (!itemToMove) {
      return;
    }
    setIsMoveLoading(true);
    setMoveError('');
    try {
      await apiClient.post('/api/inventory/sku/move', {
        fromCollection: 'inventoryDevice',
        toCollection,
        itemId: itemToMove.id,
        sku: itemToMove.sku,
      });

      showToast(`SKU "${itemToMove.sku}" moved successfully!`, 'success');
      setShowMoveModal(false);
      setItemToMove(null);

      // Refresh the devices list and the target collection
      await refetchDevices();
      if (toCollection === 'inventoryAccessory') {
        await refetchAccessories();
      } else if (toCollection === 'inventoryComponent') {
        await refetchComponents();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move SKU';
      setMoveError(message);
      showToast(message, 'error');
    } finally {
      setIsMoveLoading(false);
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

  const openHistoryModal = (item: DeviceItem) => {
    setSelectedItemHistory(item);
    setShowHistoryModal(true);
  };

  const closeHistoryModal = () => setShowHistoryModal(false);

  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
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
            <button
              onClick={handleSaveOrder}
              disabled={!isDirty}
              className="px-3 py-1.5 rounded-md text-sm bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-3"
            >
              Save Order
            </button>
            <button
              onClick={handleResetOrder}
              className="inline-flex items-center px-4 py-2 ml-3 border border-slate-500 text-base font-bold rounded-md shadow-sm text-slate-100 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              title="Reset custom drag order"
            >
              <i className="fas fa-rotate-left mr-2"></i>
              Reset Order
            </button>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search by name or SKU..."
            className="flex-1 px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => setShowScannerModal(true)}
            className="inline-flex items-center px-3 py-2 border border-slate-500 text-sm font-medium rounded-md text-slate-100 bg-slate-700 hover:bg-slate-600"
            title="Scan barcode to search"
          >
            <i className="fas fa-barcode mr-2"></i>
            Scan
          </button>
        </div>
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
                {displayDevices.map((item, index) => {
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
                                    onClick={() => handleMoveClick(item)}
                                    className="px-3 py-1 rounded-lg border border-blue-700/30 bg-blue-900/20 text-blue-300 hover:bg-blue-700/30 hover:text-blue-100 transition-colors text-xs font-semibold shadow"
                                    title="Move SKU to another section"
                                  >
                                    <i className="fas fa-exchange-alt mr-1"></i>
                                    Move
                                  </button>
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
        items={displayDevices}
        onSubmit={handleSaveDeviceCounts}
        itemType="device"
        isSubmitting={isCounting}
      />
      <CameraScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScan={(barcode) => {
          setSearchTerm(barcode)
          setShowScannerModal(false)
        }}
        title="Scan Device Barcode"
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
      {showMoveModal && (
        <MoveSkuModal
          isOpen={showMoveModal}
          item={itemToMove}
          currentSection="inventoryDevice"
          onClose={() => {
            setShowMoveModal(false);
            setItemToMove(null);
            setMoveError('');
          }}
          onConfirm={handleMoveConfirm}
          isLoading={isMoveLoading}
          error={moveError}
        />
      )}
      {showHistoryModal && selectedItemHistory && (
        <InventoryEventLog
          itemId={selectedItemHistory.id}
          itemName={selectedItemHistory.name}
          onClose={closeHistoryModal}
        />
      )}
    </DragDropContext>
  );
};

export default DeviceList;
