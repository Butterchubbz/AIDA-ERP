import { useState } from 'react';
import { useAmazonPOs } from '../hooks/useShippingModules';
import { useAuth } from '../context/AuthContext';
import AmazonPOForm from '../components/modules/AmazonPOForm';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useMessageBox } from '../components/common/MessageBox';
import type { AmazonPO, AmazonPOItem } from '../types/amazon';
import amazonLogo from '../assets/logos/generic-amazon.svg';

const AmazonProcessingView = () => {
  const {
    purchaseOrders,
    loading,
    error,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  } = useAmazonPOs();
  const { userRoles } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [poToEdit, setPoToEdit] = useState<AmazonPO | null>(null);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  // Role-based permissions
  const canEdit = userRoles?.Amazon === 'Editor';

  const handleAddOrUpdatePO = async (data: AmazonPO) => {
    setIsSubmitting(true);
    try {
      if (poToEdit) {
        await updatePurchaseOrder(poToEdit.id!, data);
        showToast('Purchase Order updated successfully!', 'success');
      } else {
        await addPurchaseOrder(data);
        showToast('Purchase Order added successfully!', 'success');
      }
      setShowPOModal(false);
      setPoToEdit(null);
    } catch (e) {
      showToast('Failed to save Purchase Order.', 'error');
      console.error('Error saving PO:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (po: AmazonPO) => {
    setPoToEdit(po);
    setShowPOModal(true);
  };

  const handleDeletePO = async (po: AmazonPO) => {
    if (!canEdit) {
      showToast('You do not have permission to delete Purchase Orders.', 'error');
      return;
    }
    const confirmed = await showMessageBox(
      'Confirm Deletion',
      `Are you sure you want to delete Purchase Order "${po.poNumber}"? This action cannot be undone.`,
      true
    );
    if (confirmed) {
      await deletePurchaseOrder(po.id!);
      showToast('Purchase Order deleted successfully!', 'success');
    }
  };

  const toggleExpandPO = (id: string) => {
    setExpandedPO(expandedPO === id ? null : id);
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'text-slate-400';
      case 'Submitted':
        return 'text-blue-400';
      case 'In Transit':
        return 'text-purple-400';
      case 'Receiving':
        return 'text-yellow-400';
      case 'Completed':
        return 'text-emerald-400';
      case 'Cancelled':
        return 'text-red-400';
      default:
        return 'text-slate-200';
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p className="font-semibold mb-2">Error loading Amazon POs:</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <div className="flex justify-between items-center mb-6 border-b pb-3">
        <h2 className="text-2xl font-semibold text-cyan-400 flex items-center gap-2">
          <img src={amazonLogo} alt="Amazon logo" className="w-7 h-7 object-contain" />
          Amazon - Processing POs
        </h2>
        {canEdit && (
          <button
            onClick={() => {
              setPoToEdit(null);
              setShowPOModal(true);
            }}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> Add New PO
          </button>
        )}
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="text-center text-slate-400 p-8 border-2 border-dashed border-slate-700 rounded-lg">
          <p className="text-xl font-medium mb-2">No Purchase Orders Found</p>
          <p>Add a new Purchase Order to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {purchaseOrders.map((po: AmazonPO) => (
            <div key={po.id} className="bg-slate-700 rounded-lg shadow-md">
              <div
                className="p-4 flex justify-between items-center cursor-pointer"
                onClick={() => toggleExpandPO(po.id!)}
              >
                <div>
                  <p className="text-lg font-bold text-cyan-300">{po.poNumber}</p>
                  <p className="text-sm text-slate-400">
                    Date: {po.poDate} | Status:{' '}
                    <span className={`font-semibold ${getStatusClass(po.status)}`}>
                      {po.status || 'N/A'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {canEdit && (
                    <div className="flex space-x-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openEditModal(po);
                        }}
                        className="text-yellow-400 hover:text-yellow-300 p-2 rounded-md hover:bg-yellow-700/20"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeletePO(po);
                        }}
                        className="text-red-400 hover:text-red-300 p-2 rounded-md hover:bg-red-700/20"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  )}
                  <i
                    className={`fas fa-chevron-down transition-transform ${
                      expandedPO === po.id ? 'rotate-180' : ''
                    }`}
                  ></i>
                </div>
              </div>
              {expandedPO === po.id && (
                <div className="border-t border-slate-600 p-4">
                  <h4 className="font-semibold mb-2 text-slate-300">Items in this PO:</h4>
                  <table className="min-w-full divide-y divide-slate-600">
                    <thead className="bg-slate-600/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600">
                      {po.items.map((item: AmazonPOItem, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-300">
                            {item.sku}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-200">
                            {item.name}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-bold text-cyan-300">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AmazonPOForm
        isOpen={showPOModal}
        onClose={() => {
          setShowPOModal(false);
          setPoToEdit(null);
        }}
        onSubmit={handleAddOrUpdatePO}
        isSubmitting={isSubmitting}
        initialData={poToEdit}
      />
    </div>
  );
};

export default AmazonProcessingView;
