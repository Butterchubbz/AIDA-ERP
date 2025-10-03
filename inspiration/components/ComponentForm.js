// src/components/ComponentForm.js

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMessageBox } from './MessageBox'; // For custom alerts

/**
 * ComponentForm component for adding new component items or editing existing ones.
 * It functions as a modal, controlled by isOpen and onClose props.
 * It dynamically changes its behavior based on the 'initialData' prop.
 * This form handles component-specific fields: Name, SKU, Woo Stock, Counted Stock.
 */
const ComponentForm = ({ isOpen, onClose, onSubmit, isSubmitting, initialData }) => {
  const { showMessageBox } = useMessageBox();

  const initialFormState = {
    name: '',
    sku: '',
    wooStock: 0, // Woo Stock for components
    category: '', // NEW: For grouping
    subcategory: '', // NEW: For sub-grouping
    countedStock: 0, // NEW: Counted Stock for components
  };

  const categoryOptions = {
    'Memory Modules': ['DDR3L', 'DDR4', 'DDR5'],
    Storage: ['2.5" SSD', 'M.2 SATA SSD', 'mSATA SSD', 'M.2 NVMe SSD'],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Populate form with existing item data, merging with the initial state
      // to ensure all fields (including new ones like category) are present.
      setFormData({ ...initialFormState, ...initialData });
      setErrors({}); // Clear errors on open/item change
      setIsSubmitted(false); // Reset submission status
    }
  }, [isOpen, initialData]);

  const handleChange = e => {
    const { name, value, type } = e.target;

    const newFormData = {
      ...formData,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    };

    // If the category is changing, reset the subcategory
    if (name === 'category') {
      newFormData.subcategory = '';
    }

    setFormData(newFormData);

    if (isSubmitted) {
      validateField(name, type === 'number' ? parseFloat(value) || 0 : value);
      if (name === 'category') {
        validateField('subcategory', '');
      }
    }
  };

  const validateField = (name, value) => {
    let fieldError = '';
    if (name === 'name' && !value.trim()) {
      fieldError = 'Component Name is required.';
    } else if (name === 'sku' && !value.trim()) {
      fieldError = 'SKU is required.';
    } else if (name === 'category' && !value.trim()) {
      fieldError = 'Category is required.';
    } else if (name === 'subcategory' && !value.trim()) {
      fieldError = 'Subcategory is required.';
    } else if (isNaN(value) && (name === 'wooStock' || name === 'countedStock')) {
      let fieldLabel = '';
      if (name === 'wooStock') fieldLabel = 'Woo Stock';
      else if (name === 'countedStock') fieldLabel = 'Counted Stock';
      fieldError = `${fieldLabel} must be a number.`;
    }
    setErrors(prevErrors => ({ ...prevErrors, [name]: fieldError }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Component Name is required.';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required.';
    if (!formData.category.trim()) newErrors.category = 'Category is required.';
    if (!formData.subcategory.trim()) newErrors.subcategory = 'Subcategory is required.';
    if (isNaN(formData.wooStock)) newErrors.wooStock = 'Woo Stock must be a number.';
    if (isNaN(formData.countedStock)) newErrors.countedStock = 'Counted Stock must be a number.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitted(true);
    const isValid = validateForm();

    if (isValid) {
      onSubmit(formData); // Pass data to parent handler
    } else {
      showMessageBox('Validation Error', 'Please correct the errors in the form.', false);
    }
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
          <i className={`fas ${isEditMode ? 'fa-edit' : 'fa-plus-circle'} text-blue-400 mr-2`}></i>
          {isEditMode ? 'Edit Component (AIDA)' : 'Add New Component (AIDA)'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Core Component Details */}
          <div className="flex flex-col">
            <label htmlFor="name" className="block text-slate-300 text-sm font-bold mb-1">
              Component Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.name ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="e.g., Component X"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="sku" className="block text-slate-300 text-sm font-bold mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.sku ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="e.g., COMP-X-SKU"
            />
            {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
          </div>

          {/* Category and Subcategory */}
          <div className="col-span-full">
            <h4 className="text-md font-semibold text-slate-300 border-b pb-2 mb-2">
              Categorization
            </h4>
          </div>
          <div className="flex flex-col">
            <label htmlFor="category" className="block text-slate-300 text-sm font-bold mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.category ? 'border-red-500' : 'border-slate-600'
              }`}
            >
              <option value="">Select a Category</option>
              {Object.keys(categoryOptions).map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>
          <div className="flex flex-col">
            <label htmlFor="subcategory" className="block text-slate-300 text-sm font-bold mb-1">
              Subcategory <span className="text-red-500">*</span>
            </label>
            <select
              id="subcategory"
              name="subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              disabled={isSubmitting || !formData.category}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.subcategory ? 'border-red-500' : 'border-slate-600'
              }`}
            >
              <option value="">Select a Subcategory</option>
              {formData.category &&
                categoryOptions[formData.category] &&
                categoryOptions[formData.category].map(sub => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
            </select>
            {errors.subcategory && (
              <p className="text-red-500 text-xs mt-1">{errors.subcategory}</p>
            )}
          </div>

          {/* Stock Fields */}
          <div className="col-span-full">
            <h4 className="text-md font-semibold text-slate-300 border-b pb-2 mb-2">
              Stock Quantities
            </h4>
          </div>
          <div>
            <label htmlFor="wooStock" className="block text-slate-300 text-sm font-bold mb-1">
              Woo Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="wooStock"
              name="wooStock"
              value={formData.wooStock}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.wooStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.wooStock && <p className="text-red-500 text-xs mt-1">{errors.wooStock}</p>}
          </div>
          <div>
            <label htmlFor="countedStock" className="block text-slate-300 text-sm font-bold mb-1">
              Counted Stock <span className="text-red-500">*</span>
            </label>{' '}
            {/* NEW: Counted Stock field */}
            <input
              type="number"
              id="countedStock"
              name="countedStock"
              placeholder="Counted Stock"
              value={formData.countedStock}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.countedStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.countedStock && (
              <p className="text-red-500 text-xs mt-1">{errors.countedStock}</p>
            )}
          </div>

          {/* Removed Min Order Quantity, Lead Time, Notes fields */}

          {/* Form Actions */}
          <div className="col-span-1 md:col-span-2 flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-md border border-slate-600 text-slate-300 font-semibold hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2"
            >
              <i className="fas fa-times"></i> Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <i className="fas fa-spinner fa-spin mr-2"></i>}
              <i className={`fas ${isEditMode ? 'fa-save' : 'fa-plus'}`}></i>
              {isEditMode ? 'Update Component' : 'Add Component'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ComponentForm;
