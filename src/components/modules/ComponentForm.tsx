import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentItem } from '../../types/component';

interface ComponentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ComponentItem) => void;
  isSubmitting: boolean;
  initialData: ComponentItem | null;
}

const ComponentForm: React.FC<ComponentFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
}) => {
  const [formData, setFormData] = useState<ComponentItem>(
    initialData || {
      name: '',
      sku: '',
      onlineStock: 0,
      category: '',
      subcategory: '',
      countedStock: 0,
    }
  );

  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData || {
          name: '',
          sku: '',
          onlineStock: 0,
          category: '',
          subcategory: '',
          countedStock: 0,
        }
      );
    }
  }, [isOpen, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'onlineStock' || name === 'countedStock' ? parseInt(value, 10) || 0 : value,
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
          {isEditMode ? 'Edit Component' : 'Add New Component'}
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
              placeholder="Component Name"
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
              placeholder="Component SKU"
              value={formData.sku}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="onlineStock" className="block text-slate-300 text-sm font-bold mb-1">
              Online Stock
            </label>
            <input
              type="number"
              id="onlineStock"
              name="onlineStock"
              value={formData.onlineStock}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="countedStock" className="block text-slate-300 text-sm font-bold mb-1">
              Counted Stock
            </label>
            <input
              type="number"
              id="countedStock"
              name="countedStock"
              value={formData.countedStock}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-slate-300 text-sm font-bold mb-1">
              Category
            </label>
            <input
              type="text"
              id="category"
              name="category"
              placeholder="Category"
              value={formData.category}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="subcategory" className="block text-slate-300 text-sm font-bold mb-1">
              Subcategory
            </label>
            <input
              type="text"
              id="subcategory"
              name="subcategory"
              placeholder="Subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
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
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Component' : 'Add Component'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ComponentForm;
