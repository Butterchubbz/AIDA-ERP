import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { RMAEntry } from '../../types/rma';

interface RMAEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RMAEntry) => void;
  isSubmitting: boolean;
  canEdit: boolean;
  initialData: RMAEntry | null;
}

const RMAEntryModal: React.FC<RMAEntryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  canEdit,
  initialData,
}) => {
  const [modalEntryData, setModalEntryData] = useState(
    initialData || {
      customerName: '',
      ticketNumber: '',
      orderNumber: '',
      device: '',
      trackingNumber: '',
    }
  );

  useEffect(() => {
    if (isOpen) {
      setModalEntryData(
        initialData || {
          customerName: '',
          ticketNumber: '',
          orderNumber: '',
          device: '',
          trackingNumber: '',
        }
      );
    }
  }, [isOpen, initialData]);

  const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setModalEntryData(
      prev =>
        ({
          ...prev,
          [name]: value,
        } as RMAEntry)
    );
  };

  const handleSubmit = () => {
    if (!canEdit) return;
    onSubmit(modalEntryData);
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit RMA Entry' : 'New Inbound RMA / Return'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="rma-customer" className="block text-slate-300 text-sm font-bold mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rma-customer"
              name="customerName"
              placeholder="Customer Name"
              value={modalEntryData.customerName}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="rma-order" className="block text-slate-300 text-sm font-bold mb-1">
              Order Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rma-order"
              name="orderNumber"
              placeholder="Order Number"
              value={modalEntryData.orderNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="rma-ticket" className="block text-slate-300 text-sm font-bold mb-1">
              Ticket Number (Optional)
            </label>
            <input
              type="text"
              id="rma-ticket"
              name="ticketNumber"
              placeholder="Ticket Number"
              value={modalEntryData.ticketNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="rma-tracking" className="block text-slate-300 text-sm font-bold mb-1">
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rma-tracking"
              name="trackingNumber"
              placeholder="Tracking Number"
              value={modalEntryData.trackingNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="rma-device" className="block text-slate-300 text-sm font-bold mb-1">
              Device(s) / Items (e.g., V1410 Base, Qty 2)
            </label>
            <textarea
              id="rma-device"
              name="device"
              placeholder="List devices/items being returned, e.g., V1410-Base x1, V1211-250 x1"
              value={modalEntryData.device}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              rows={3}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-y bg-slate-700 text-slate-100"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update RMA' : 'Add RMA Entry'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RMAEntryModal;
