// src/components/RefurbishedDeviceForm.js

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMessageBox } from './MessageBox'; // For custom alerts

/**
 * RefurbishedDeviceForm component for adding new refurbished device items or editing existing ones.
 * It functions as a modal, controlled by isOpen and onClose props.
 * It dynamically changes its behavior based on the 'initialData' prop.
 * This form handles device-specific fields: Name, SKU, and Refurbished Stock.
 */
const RefurbishedDeviceForm = ({ isOpen, onClose, onSubmit, isSubmitting, initialData }) => {
  const { showMessageBox } = useMessageBox();

  const initialFormState = {
    name: '',
    sku: '',
    refurbishedStock: 0,
    notes: '', // Added a notes field for details about the device/refurbishment
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Populate form with existing item data, merging with the initial state
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

    setFormData(newFormData);

    if (isSubmitted) {
      validateField(name, type === 'number' ? parseFloat(value) || 0 : value);
    }
  };

  const validateField = (name, value) => {
    let fieldError = '';
    if (name === 'name' && !value.trim()) {
      fieldError = 'Device Name is required.';
    } else if (name === 'sku' && !value.trim()) {
      fieldError = 'SKU is required.';
    } else if (name === 'refurbishedStock' && isNaN(value)) {
      fieldError = 'Refurbished Stock must be a number.';
    }
    setErrors(prevErrors => ({ ...prevErrors, [name]: fieldError }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Device Name is required.';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required.';
    if (isNaN(formData.refurbishedStock))
      newErrors.refurbishedStock = 'Refurbished Stock must be a number.';
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
          {isEditMode ? 'Edit Refurbished Device' : 'Add New Refurbished Device'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Core Device Details */}
          <div className="flex flex-col">
            <label htmlFor="name" className="block text-slate-300 text-sm font-bold mb-1">
              Device Name <span className="text-red-500">*</span>
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
              placeholder="e.g., Refurbished Vault Pro"
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
              placeholder="e.g., VP-REFURB-SKU"
            />
            {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
          </div>

          {/* Stock and Notes */}
          <div className="col-span-full">
            <h4 className="text-md font-semibold text-slate-300 border-b pb-2 mb-2">
              Inventory Details
            </h4>
          </div>
          <div>
            <label
              htmlFor="refurbishedStock"
              className="block text-slate-300 text-sm font-bold mb-1"
            >
              Refurbished Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="refurbishedStock"
              name="refurbishedStock"
              value={formData.refurbishedStock}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.refurbishedStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.refurbishedStock && (
              <p className="text-red-500 text-xs mt-1">{errors.refurbishedStock}</p>
            )}
          </div>

          <div className="col-span-full">
            <label htmlFor="notes" className="block text-slate-300 text-sm font-bold mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              disabled={isSubmitting}
              rows="3"
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 border-slate-600"
              placeholder="e.g., Replaced SSD, minor cosmetic scratches."
            ></textarea>
          </div>

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
              {isEditMode ? 'Update Device' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default RefurbishedDeviceForm;
