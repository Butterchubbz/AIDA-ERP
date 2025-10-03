// src/components/QuoteApprovedView.js

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuoteApproved } from '../hooks/useQuoteApproved';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from './MessageBox';
import LoadingSpinner from './LoadingSpinner';

// --- Order Modal Component (for Add/Edit) ---
const OrderModal = ({ isOpen, onClose, onSubmit, isSubmitting, canEdit, initialData }) => {
  const [modalData, setModalData] = useState(
    initialData || {
      orderNumber: '',
      sku: '',
      amount: '',
      status: 'Initiated',
    }
  );

  useState(() => {
    if (isOpen) {
      setModalData(initialData || { orderNumber: '', sku: '', amount: '', status: 'Initiated' });
    }
  }, [isOpen, initialData]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setModalData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!canEdit) return;
    onSubmit(modalData);
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit Order' : 'New Quote Approved Order'}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <input
            type="text"
            name="orderNumber"
            placeholder="Order Number"
            value={modalData.orderNumber}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className="p-3 bg-slate-700 rounded-lg"
          />
          <input
            type="text"
            name="sku"
            placeholder="SKU Number"
            value={modalData.sku}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className="p-3 bg-slate-700 rounded-lg"
          />
          <input
            type="number"
            name="amount"
            placeholder="Amount"
            value={modalData.amount}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className="p-3 bg-slate-700 rounded-lg"
          />
          <select
            name="status"
            value={modalData.status}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className="p-3 bg-slate-700 rounded-lg"
          >
            <option value="Initiated">Initiated</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Order' : 'Add Order'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Main QuoteApprovedView Component ---
function QuoteApprovedView() {
  const { orders, loading, error, addOrder, updateOrder, deleteOrder } = useQuoteApproved();
  const { currentUser } = useAuth();
  const { showMessageBox, showToast } = useMessageBox();

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const canEdit = !!currentUser;

  const handleAddOrder = async orderData => {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      await addOrder(orderData);
      showToast('Order added successfully!', 'success');
      setShowModal(false);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateOrder = async updatedData => {
    if (!canEdit || !orderToEdit) return;
    setIsSubmitting(true);
    try {
      await updateOrder(orderToEdit.id, updatedData);
      showToast('Order updated successfully!', 'success');
      setShowModal(false);
      setOrderToEdit(null);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrder = async (orderId, orderNumber) => {
    if (!canEdit) return;
    const confirmed = await showMessageBox('Confirm Delete', `Delete order "${orderNumber}"?`);
    if (!confirmed) return;

    try {
      await deleteOrder(orderId);
      showToast('Order deleted successfully!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const openEditModal = order => {
    setOrderToEdit(order);
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-500">{error}</p>;

  const inProgressOrders = orders.filter(o => o.status !== 'Completed');
  const completedOrders = orders.filter(o => o.status === 'Completed');

  const renderOrderTable = (orders, title) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-cyan-300 mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                Order Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                  {order.orderNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{order.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {order.amount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {order.status}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
    <section className="bg-slate-800 p-6 rounded-xl shadow-lg w-full text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-cyan-400">Quote Approved Orders</h2>
        {canEdit && (
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
      </div>

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

      <OrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={orderToEdit ? handleUpdateOrder : handleAddOrder}
        isSubmitting={isSubmitting}
        canEdit={canEdit}
        initialData={orderToEdit}
      />
    </section>
  );
}

export default QuoteApprovedView;
