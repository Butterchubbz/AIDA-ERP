import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Order } from '@aida/shared';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Order) => void;
  isSubmitting: boolean;
  canEdit: boolean;
  initialData: Order | null;
}

const defaultNewOrder: Order = {
  orderNumber: '',
  sku: '',
  amount: '',
  status: 'Initiated',
};

const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  canEdit,
  initialData,
}) => {
  const [modalData, setModalData] = useState(initialData || defaultNewOrder);

  useEffect(() => {
    if (isOpen) {
      setModalData(initialData || defaultNewOrder);
    }
  }, [isOpen, initialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

export default OrderModal;
