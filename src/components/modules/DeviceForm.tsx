import React, { useState, useEffect } from 'react';
import type { DeviceItem } from '../../types/device';

interface DeviceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<DeviceItem>) => void;
  isSubmitting: boolean;
  initialData: DeviceItem | null;
}

const DeviceForm: React.FC<DeviceFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
}) => {
  const [formData, setFormData] = useState<Partial<DeviceItem>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || {});
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md text-slate-100"
      >
        <h2 className="text-xl font-bold text-cyan-400 mb-4">
          {initialData ? 'Edit Item' : 'Add New Item'}
        </h2>

        <div className="space-y-4">
          <input
            type="text"
            name="sku"
            placeholder="SKU"
            value={formData.sku || ''}
            onChange={handleChange}
            className="w-full p-2 rounded bg-slate-700"
          />
          <input
            type="text"
            name="name"
            placeholder="Name"
            value={formData.name || ''}
            onChange={handleChange}
            className="w-full p-2 rounded bg-slate-700"
          />
          <input
            type="number"
            name="quantity"
            placeholder="Quantity"
            value={formData.quantity || 0}
            onChange={handleChange}
            className="w-full p-2 rounded bg-slate-700"
          />
          <input
            type="text"
            name="location"
            placeholder="Location"
            value={formData.location || ''}
            onChange={handleChange}
            className="w-full p-2 rounded bg-slate-700"
          />
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeviceForm;
