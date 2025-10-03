// src/components/InventoryForm.js

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // Import createPortal directly
import { useInventoryContext } from '../context/InventoryContext'; // Access inventory actions
import { useMessageBox } from '../components/MessageBox'; // Updated: Destructure showMessageBox and showToast

/**
 * InventoryForm component for adding new items or editing existing ones.
 * It functions as a modal, controlled by isOpen and onClose props.
 * It dynamically changes its behavior based on the 'itemToEdit' prop.
 * This form handles AIDA's core inventory fields: Woo Stock, Production Stock, Warehouse Stock, Reserve Stock.
 */
const InventoryForm = ({ isOpen, onClose, itemToEdit, onFormSubmitSuccess }) => {
  // Access addItem and updateItem functions from the InventoryContext
  const { addItem, updateItem, loading, error } = useInventoryContext();
  // Access the custom message box function for displaying alerts
  const { showMessageBox, showToast } = useMessageBox();

  // Initial state for the form fields.
  const initialFormState = {
    name: '',
    sku: '',
    wooStock: 0,
    productionStock: 0,
    warehouseStock: 0,
    reserveStock: 0,
  };

  // State to hold the current form data
  const [formData, setFormData] = useState(initialFormState);
  // State to hold validation errors
  const [errors, setErrors] = useState({});
  // State to track if the form has been submitted to enable real-time validation feedback
  const [isSubmitted, setIsSubmitted] = useState(false);
  // State to explicitly manage if the form fields should be disabled (separate from outer loading)
  const [isFormDisabled, setIsFormDisabled] = useState(false); // NEW STATE for form disabling

  // DEBUG: Log key states/props
  useEffect(() => {
    console.log('InventoryForm - isOpen:', isOpen);
    console.log('InventoryForm - itemToEdit:', itemToEdit);
    console.log('InventoryForm - loading (from context):', loading);
    console.log('InventoryForm - isFormDisabled (local):', isFormDisabled);
    console.log('InventoryForm - formData:', formData);
  }, [isOpen, itemToEdit, loading, isFormDisabled, formData]);

  // Effect to update form data when 'itemToEdit' prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      // Only reset when modal is opened
      if (itemToEdit) {
        // Populate form with existing item data, defaulting to 0 or empty string if undefined
        setFormData({
          name: itemToEdit.name || '',
          sku: itemToEdit.sku || '',
          wooStock: itemToEdit.wooStock || 0,
          productionStock: itemToEdit.productionStock || 0,
          warehouseStock: itemToEdit.warehouseStock || 0,
          reserveStock: itemToEdit.reserveStock || 0,
        });
      } else {
        setFormData(initialFormState); // Reset for new item
      }
      setErrors({}); // Clear errors on open/item change
      setIsSubmitted(false); // Reset submission status
      setIsFormDisabled(false); // Ensure form is enabled on open
    }
  }, [isOpen, itemToEdit]);

  // Function to handle changes in form input fields
  const handleChange = e => {
    const { name, value, type } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
    if (isSubmitted) {
      // Re-validate if form was already submitted
      validateField(name, type === 'number' ? parseFloat(value) || 0 : value);
    }
  };

  // Function to validate a specific field
  const validateField = (name, value) => {
    let fieldError = '';
    if (name === 'name' && !value.trim()) {
      fieldError = 'Item Name is required.';
    } else if (name === 'sku' && !value.trim()) {
      fieldError = 'SKU is required.';
    } else if (
      isNaN(value) &&
      (name === 'wooStock' ||
        name === 'productionStock' ||
        name === 'warehouseStock' ||
        name === 'reserveStock')
    ) {
      let fieldLabel = '';
      if (name === 'wooStock') fieldLabel = 'Woo Stock';
      else if (name === 'productionStock') fieldLabel = 'Production Stock';
      else if (name === 'warehouseStock') fieldLabel = 'Warehouse Stock';
      else if (name === 'reserveStock') fieldLabel = 'Reserve Stock';
      fieldError = `${fieldLabel} must be a number.`;
    }
    setErrors(prevErrors => ({ ...prevErrors, [name]: fieldError }));
  };

  // Function to validate the entire form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Item Name is required.';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required.';
    if (isNaN(formData.wooStock)) newErrors.wooStock = 'Woo Stock must be a number.';
    if (isNaN(formData.productionStock))
      newErrors.productionStock = 'Production Stock must be a number.';
    if (isNaN(formData.warehouseStock))
      newErrors.warehouseStock = 'Warehouse Stock must be a number.';
    if (isNaN(formData.reserveStock)) newErrors.reserveStock = 'Reserve Stock must be a number.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitted(true);
    const isValid = validateForm();

    if (isValid) {
      setIsFormDisabled(true); // Disable form fields during submission
      try {
        if (itemToEdit) {
          await updateItem(itemToEdit.id, formData);
        } else {
          await addItem(formData);
        }
        // showToast for success/error are handled by useInventory hook directly now
        if (onFormSubmitSuccess) {
          onFormSubmitSuccess();
        }
        onClose(); // Close the modal on successful submission
      } catch (submitError) {
        // The actual error toast is handled by useInventory hook.
        // We just log it here for local context.
        console.error('Form submission error caught in InventoryForm:', submitError);
      } finally {
        setIsFormDisabled(false); // Re-enable form fields after submission attempt
      }
    } else {
      showMessageBox('Validation Error', 'Please correct the errors in the form.', false);
    }
  };

  if (!isOpen) return null;

  // Determine if the form fields should be disabled.
  // They are disabled if the global context `loading` is true OR if `isFormDisabled` (local submit state) is true.
  const isFieldsDisabled = loading || isFormDisabled;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
          <i className={`fas ${itemToEdit ? 'fa-edit' : 'fa-plus-circle'} text-blue-400 mr-2`}></i>
          {itemToEdit ? 'Edit Inventory Item (AIDA)' : 'Add New Inventory Item (AIDA)'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Core Item Details */}
          <div className="flex flex-col">
            <label htmlFor="name" className="text-sm font-medium text-slate-300 mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isFieldsDisabled} // Use isFieldsDisabled
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.name ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="e.g., Product A"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="flex flex-col">
            <label htmlFor="sku" className="text-sm font-medium text-slate-300 mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              disabled={isFieldsDisabled} // Use isFieldsDisabled
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.sku ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="e.g., PROD-A-SKU"
            />
            {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
          </div>

          {/* AIDA Stock Fields */}
          <div className="col-span-full">
            <h4 className="text-md font-semibold text-slate-300 border-b pb-2 mb-2">
              AIDA Stock Categories
            </h4>
          </div>
          <div>
            <label htmlFor="wooStock" className="text-sm font-medium text-slate-300 mb-1">
              Woo Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="wooStock"
              name="wooStock"
              value={formData.wooStock}
              onChange={handleChange}
              disabled={isFieldsDisabled}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.wooStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.wooStock && <p className="text-red-500 text-xs mt-1">{errors.wooStock}</p>}
          </div>
          <div>
            <label htmlFor="productionStock" className="text-sm font-medium text-slate-300 mb-1">
              Production Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="productionStock"
              name="productionStock"
              value={formData.productionStock}
              onChange={handleChange}
              disabled={isFieldsDisabled}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.productionStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.productionStock && (
              <p className="text-red-500 text-xs mt-1">{errors.productionStock}</p>
            )}
          </div>
          <div>
            <label htmlFor="warehouseStock" className="text-sm font-medium text-slate-300 mb-1">
              Warehouse Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="warehouseStock"
              name="warehouseStock"
              value={formData.warehouseStock}
              onChange={handleChange}
              disabled={isFieldsDisabled}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.warehouseStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.warehouseStock && (
              <p className="text-red-500 text-xs mt-1">{errors.warehouseStock}</p>
            )}
          </div>
          <div>
            <label htmlFor="reserveStock" className="text-sm font-medium text-slate-300 mb-1">
              Reserve Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="reserveStock"
              name="reserveStock"
              value={formData.reserveStock}
              onChange={handleChange}
              disabled={isFieldsDisabled}
              className={`px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-700 text-slate-100 ${
                errors.reserveStock ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {errors.reserveStock && (
              <p className="text-red-500 text-xs mt-1">{errors.reserveStock}</p>
            )}
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
              disabled={isFieldsDisabled} // Use isFieldsDisabled for button
              className="px-6 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFieldsDisabled && <i className="fas fa-spinner fa-spin mr-2"></i>}
              <i className={`fas ${itemToEdit ? 'fa-save' : 'fa-plus'}`}></i>
              {itemToEdit ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
        {error && (
          <div className="text-red-400 bg-red-900/20 p-3 rounded-md mt-4">
            <p className="font-semibold">Operation Error:</p>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default InventoryForm;
