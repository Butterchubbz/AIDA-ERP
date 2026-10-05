import { useState } from 'react';
import { useQuoteApproved } from '../hooks/useQuoteApproved';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import OrderModal from '../components/modules/OrderModal';
import PageContainer from '../components/common/PageContainer';
import type { Order } from '@aida/shared';

// --- Main QuoteApprovedView Component ---
function QuoteApprovedView() {
  const { orders, loading, error, addOrder, updateOrder, deleteOrder } = useQuoteApproved();
  const { user } = useAuth(); // Changed from currentUser to user
  const { showMessageBox, showToast } = useMessageBox();

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const canEdit = !!user; // Assuming any logged-in user can edit for now

  const handleAddOrder = async (orderData: Partial<Order>) => {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      await addOrder(orderData);
      showToast('Order added successfully!', 'success');
      setShowModal(false);
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Failed to add order';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrder = async (updatedData: Partial<Order>) => {
    if (!canEdit || !orderToEdit) return;
    setIsSubmitting(true);
    try {
      if (!orderToEdit.id) {
        showToast('Order ID is missing; cannot update.', 'error');
        return;
      }
      await updateOrder(orderToEdit.id, updatedData);
      showToast('Order updated successfully!', 'success');
      setShowModal(false);
      setOrderToEdit(null);
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Failed to update order';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrder = async (orderId?: string, orderNumber?: string) => {
    if (!canEdit) return;
    if (!orderId) {
      showToast('Order ID is missing; cannot delete.', 'error');
      return;
    }
    const confirmed = await showMessageBox('Confirm Delete', `Delete order "${orderNumber ?? ''}"?`);
    if (!confirmed) return;

    try {
      await deleteOrder(orderId);
      showToast('Order deleted successfully!', 'success');
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? 'Failed to delete order';
      showToast(msg, 'error');
    }
  };

  const openEditModal = (order: Order) => {
    setOrderToEdit(order);
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-500">{error}</p>;

  const inProgressOrders = orders.filter(o => o.status !== 'Completed');
  const completedOrders = orders.filter(o => o.status === 'Completed');

  const renderOrderTable = (orders: Order[], title: string) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-cyan-300 mb-3">{title}</h3>
      <div className="max-h-[calc(100vh-22rem)] overflow-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="sticky top-0 z-10 bg-slate-700">
            <tr>
              <th className="p-card text-left text-xs font-medium text-slate-400 uppercase">
                Order Number
              </th>
              <th className="p-card text-left text-xs font-medium text-slate-400 uppercase">
                SKU
              </th>
              <th className="p-card text-left text-xs font-medium text-slate-400 uppercase">
                Amount
              </th>
              <th className="p-card text-left text-xs font-medium text-slate-400 uppercase">
                Status
              </th>
              <th className="p-card text-right text-xs font-medium text-slate-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {orders.map((order: Order, index) => (
              <tr key={order.id} className={`${index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-700/30'} hover:bg-slate-700`}>
                <td className="p-card whitespace-nowrap text-sm font-medium text-slate-200">
                  {order.orderNumber}
                </td>
                <td className="p-card whitespace-nowrap text-sm text-slate-400">{order.sku}</td>
                <td className="p-card whitespace-nowrap text-sm text-slate-400">
                  {order.amount}
                </td>
                <td className="p-card whitespace-nowrap text-sm text-slate-400">
                  {order.status}
                </td>
                <td className="p-card whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEditModal(order)}
                    className="text-yellow-400 hover:text-yellow-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                    className="text-red-400 hover:text-red-300 ml-4"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <PageContainer
        title="Quote Approved Orders"
        variant="plain"
        actions={canEdit && (
          <button
            onClick={() => {
              setOrderToEdit(null);
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700"
          >
            Add New Order
          </button>
        )}
      >

      {renderOrderTable(inProgressOrders, 'In-Progress')}

      {completedOrders.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            {showCompleted ? 'Hide' : 'Show'} Completed ({completedOrders.length})
          </button>
          {showCompleted && renderOrderTable(completedOrders, 'Completed')}
        </div>
      )}
      </PageContainer>

      <OrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={orderToEdit ? handleUpdateOrder : handleAddOrder}
        isSubmitting={isSubmitting}
        canEdit={canEdit}
        initialData={orderToEdit}
      />
    </>
  );
}

export default QuoteApprovedView;
