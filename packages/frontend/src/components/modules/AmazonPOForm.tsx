import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AmazonPO, AmazonPOItem } from '@aida/shared';

interface AmazonPOFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AmazonPO) => void;
  isSubmitting: boolean;
  initialData: AmazonPO | null;
}

const defaultNewPO: AmazonPO = {
  poNumber: '',
  poDate: '',
  status: 'Draft',
  items: [],
};

const AmazonPOForm: React.FC<AmazonPOFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
}) => {
  const [formData, setFormData] = useState(initialData || defaultNewPO);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || defaultNewPO);
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item: AmazonPOItem, i: number) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { sku: '', name: '', quantity: 0 }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_: AmazonPOItem, i: number) => i !== index),
    }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit Amazon PO' : 'Add New Amazon PO'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="poNumber" className="block text-slate-300 text-sm font-bold mb-1">
              PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="poNumber"
              name="poNumber"
              placeholder="PO Number"
              value={formData.poNumber}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="poDate" className="block text-slate-300 text-sm font-bold mb-1">
              PO Date
            </label>
            <input
              type="date"
              id="poDate"
              name="poDate"
              value={formData.poDate}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="status" className="block text-slate-300 text-sm font-bold mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            >
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="In Transit">In Transit</option>
              <option value="Receiving">Receiving</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        {/* Items Section */}
        <div className="col-span-full mt-4 border-t border-slate-700 pt-4">
          <h4 className="text-lg font-bold text-slate-300 mb-3">PO Items</h4>
          {formData.items.map((item: AmazonPOItem, index: number) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 p-3 border border-slate-700 rounded-md bg-slate-700/30 relative"
            >
              <div>
                <label
                  htmlFor={`sku-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  SKU
                </label>
                <input
                  type="text"
                  id={`sku-${index}`}
                  name="sku"
                  value={item.sku}
                  onChange={e => handleItemChange(index, 'sku', e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Item SKU"
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`name-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  Name
                </label>
                <input
                  type="text"
                  id={`name-${index}`}
                  name="name"
                  value={item.name}
                  onChange={e => handleItemChange(index, 'name', e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Item Name"
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor={`quantity-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  Quantity
                </label>
                <input
                  type="number"
                  id={`quantity-${index}`}
                  name="quantity"
                  value={item.quantity}
                  onChange={e =>
                    handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)
                  }
                  disabled={isSubmitting}
                  placeholder="Quantity"
                  min="0"
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={isSubmitting || formData.items.length <= 1}
                  className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddItem}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Item
          </button>
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
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update PO' : 'Add PO'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AmazonPOForm;
