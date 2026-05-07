import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { RefurbishedDevice } from '@aida/shared';

interface RefurbishedDeviceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RefurbishedDevice) => void;
  isSubmitting: boolean;
  initialData: RefurbishedDevice | null;
}

const RefurbishedDeviceForm: React.FC<RefurbishedDeviceFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
}) => {
  const [formData, setFormData] = useState(
    initialData || {
      name: '',
      sku: '',
      refurbishedStock: 0,
      notes: '',
    }
  );

  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData || {
          name: '',
          sku: '',
          refurbishedStock: 0,
          notes: '',
        }
      );
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'refurbishedStock' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit Refurbished Device' : 'Add New Refurbished Device'}
        </h3>
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div>
            <label htmlFor="name" className="block text-slate-300 text-sm font-bold mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Device Name"
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="sku" className="block text-slate-300 text-sm font-bold mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="sku"
              name="sku"
              placeholder="Device SKU"
              value={formData.sku}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="refurbishedStock"
              className="block text-slate-300 text-sm font-bold mb-1"
            >
              Refurbished Stock
            </label>
            <input
              type="number"
              id="refurbishedStock"
              name="refurbishedStock"
              value={formData.refurbishedStock}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-slate-300 text-sm font-bold mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Any notes about the device"
              value={formData.notes}
              onChange={handleChange}
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
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Device' : 'Add Device'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RefurbishedDeviceForm;
