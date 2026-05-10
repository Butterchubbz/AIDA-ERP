import React, { useState, useMemo } from 'react';
import DeviceForm from '../components/modules/DeviceForm';
import MoveSkuModal from '../components/modules/MoveSkuModal';
import type { AccessoryItem } from '@aida/shared';
import { useAccessoryContext } from '../context/AccessoryContext';
import { useDeviceContext } from '../context/DeviceContext';
import { useComponentInventory } from '../hooks/useInventoryModules';
import { useMessageBox } from '../components/common/MessageBox';
import PageContainer from '../components/common/PageContainer';
import { useAuth } from '../context/AuthContext';
import { getSortIndicator, naturalSort } from '../utils/tableHelpers';
import { apiClient } from '../lib/apiClient';

const InventoryAccessoriesView: React.FC = () => {
  const { accessories, addAccessoryItem, updateAccessoryItem, deleteAccessoryItem, refetch: refetchAccessories } = useAccessoryContext();
  const { refetch: refetchDevices } = useDeviceContext();
  const { refetch: refetchComponents } = useComponentInventory();
  const { userRoles } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<AccessoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<AccessoryItem | null>(null);
  const [isMoveLoading, setIsMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState('');

  const canAddDeleteEdit = userRoles?.Inventory === 'Editor';

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleAddItem = () => {
    setItemToEdit(null);
    setShowAddItemModal(true);
  };

  const handleEditItem = (item: AccessoryItem) => {
    setItemToEdit(item);
    setShowEditItemModal(true);
  };

  const handleCloseModal = () => {
    setShowAddItemModal(false);
    setShowEditItemModal(false);
    setItemToEdit(null);
  };

  const handleSubmitForm = async (item: Partial<AccessoryItem>) => {
    setIsSubmitting(true);
    try {
      if (itemToEdit && itemToEdit.id) {
        // Editing existing item
        await updateAccessoryItem(itemToEdit.id, item);
        showToast('Item updated successfully!', 'success');
      } else {
        // Adding new item
        await addAccessoryItem(item);
        showToast('Item added successfully!', 'success');
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error submitting inventory item:', error);
      showToast('Failed to save item.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      await deleteAccessoryItem(itemId);
      showToast(`"${itemName}" deleted successfully!`, 'success');
    }
  };

  const handleMoveClick = (item: AccessoryItem) => {
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
        fromCollection: 'inventoryAccessory',
        toCollection,
        itemId: itemToMove.id,
        sku: itemToMove.sku,
      });

      showToast(`SKU "${itemToMove.sku}" moved successfully!`, 'success');
      setShowMoveModal(false);
      setItemToMove(null);

      // Refresh the accessories list and the target collection
      await refetchAccessories();
      if (toCollection === 'inventoryDevice') {
        await refetchDevices();
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

  const displayAccessories = useMemo(() => {
    const filtered = accessories.filter(
      item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const aValue = a[sortColumn as keyof AccessoryItem];
      const bValue = b[sortColumn as keyof AccessoryItem];
      if (['onlineStock', 'warehouseStock', 'countedStock', 'reserveStock', 'productionStock'].includes(sortColumn)) {
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
  }, [accessories, searchTerm, sortColumn, sortDirection]);

  return (
    <>
      <PageContainer title="Accessories List" icon="fas fa-tag">
        <div className="mb-4">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Search by name or SKU..."
              className="flex-1 px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
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
                  Name {getSortIndicator(sortColumn, 'name', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('onlineStock')}
                >
                  Online Stock {getSortIndicator(sortColumn, 'onlineStock', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('countedStock')}
                >
                  Counted Stock {getSortIndicator(sortColumn, 'countedStock', sortDirection)}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-600 group"
                  onClick={() => handleSort('warehouseStock')}
                >
                  Warehouse Stock {getSortIndicator(sortColumn, 'warehouseStock', sortDirection)}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {displayAccessories.map((item, index) => (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-800 ${index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800'}`}
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
                    {item.countedStock || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-bold">
                    {item.warehouseStock || 0}
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
                            onClick={() => handleEditItem(item)}
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageContainer>

      {(showAddItemModal || showEditItemModal) && (
        <DeviceForm
          isOpen={showAddItemModal || showEditItemModal}
          onClose={handleCloseModal}
          onSubmit={handleSubmitForm}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialData={itemToEdit as any}
          isSubmitting={isSubmitting}
        />
      )}

      {showMoveModal && (
        <MoveSkuModal
          isOpen={showMoveModal}
          item={itemToMove}
          currentSection="inventoryAccessory"
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

      {canAddDeleteEdit && (
        <button
          onClick={handleAddItem}
          className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform duration-300 transform hover:scale-110"
          title="Add New Item"
        >
          <i className="fas fa-plus text-2xl"></i>
        </button>
      )}
    </>
  );
};

export default InventoryAccessoriesView;
