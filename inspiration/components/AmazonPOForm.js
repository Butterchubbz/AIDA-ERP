// src/components/AmazonPOForm.js

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMessageBox } from './MessageBox';

const AmazonPOForm = ({ isOpen, onClose, onSubmit, isSubmitting, initialData }) => {
  const { showMessageBox } = useMessageBox();

  const getInitialFormState = () => ({
    poNumber: '',
    poDate: new Date().toISOString().split('T')[0], // Default to today
    items: [{ sku: '', name: '', quantity: 0 }],
    status: 'Draft',
  });

  const [formData, setFormData] = useState(getInitialFormState());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // If editing, format the date correctly for the input[type=date]
        const date = initialData.poDate
          ? new Date(initialData.poDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        setFormData({ ...initialData, poDate: date, status: initialData.status || 'Draft' });
      } else {
        setFormData(getInitialFormState());
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    const items = [...formData.items];
    items[index][name] = name === 'quantity' ? parseInt(value, 10) || 0 : value;
    setFormData(prev => ({ ...prev, items }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { sku: '', name: '', quantity: 0 }],
    }));
  };

  const removeItem = index => {
    if (formData.items.length <= 1) {
      showMessageBox('Action Denied', 'A Purchase Order must have at least one item.', false);
      return;
    }
    const items = [...formData.items];
    items.splice(index, 1);
    setFormData(prev => ({ ...prev, items }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.poNumber.trim()) newErrors.poNumber = 'PO Number is required.';
    if (!formData.poDate) newErrors.poDate = 'PO Date is required.';
    if (!formData.status) newErrors.status = 'Status is required.';

    const itemErrors = [];
    formData.items.forEach((item, index) => {
      const error = {};
      if (!item.sku.trim()) error.sku = 'SKU is required.';
      if (!item.name.trim()) error.name = 'Name is required.';
      if (isNaN(item.quantity) || item.quantity < 0)
        error.quantity = 'Quantity must be a non-negative number.';
      if (Object.keys(error).length > 0) itemErrors[index] = error;
    });

    if (itemErrors.length > 0) newErrors.items = itemErrors;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    } else {
      showMessageBox('Validation Error', 'Please correct the errors in the form.', false);
    }
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-4xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
          <i className={`fas ${isEditMode ? 'fa-edit' : 'fa-plus-circle'} text-blue-400 mr-2`}></i>
          {isEditMode ? 'Edit Amazon Purchase Order' : 'Add New Amazon Purchase Order'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="poNumber" className="block text-slate-300 text-sm font-bold mb-1">
                PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="poNumber"
                name="poNumber"
                value={formData.poNumber}
                onChange={handleChange}
                disabled={isSubmitting}
                className={`w-full px-4 py-2 border rounded-md bg-slate-700 text-slate-100 ${
                  errors.poNumber ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="e.g., FBA STA PO0701"
              />
              {errors.poNumber && <p className="text-red-500 text-xs mt-1">{errors.poNumber}</p>}
            </div>
            <div>
              <label htmlFor="poDate" className="block text-slate-300 text-sm font-bold mb-1">
                PO Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="poDate"
                name="poDate"
                value={formData.poDate}
                onChange={handleChange}
                disabled={isSubmitting}
                className={`w-full px-4 py-2 border rounded-md bg-slate-700 text-slate-100 ${
                  errors.poDate ? 'border-red-500' : 'border-slate-600'
                }`}
              />
              {errors.poDate && <p className="text-red-500 text-xs mt-1">{errors.poDate}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-slate-300 text-sm font-bold mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`w-full px-4 py-2 border rounded-md bg-slate-700 text-slate-100 ${
                errors.status ? 'border-red-500' : 'border-slate-600'
              }`}
            >
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="In Transit">In Transit</option>
              <option value="Receiving">Receiving</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            {errors.status && <p className="text-red-500 text-xs mt-1">{errors.status}</p>}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-300 border-b pb-2 mb-4">Items</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {formData.items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-4 items-start bg-slate-700/50 p-3 rounded-md"
                >
                  <div className="col-span-4">
                    <label className="block text-slate-400 text-xs font-bold mb-1">SKU</label>
                    <input
                      type="text"
                      name="sku"
                      value={item.sku}
                      onChange={e => handleItemChange(index, e)}
                      className={`w-full px-3 py-1 border rounded-md bg-slate-700 text-slate-100 ${
                        errors.items?.[index]?.sku ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="Item SKU"
                    />
                  </div>
                  <div className="col-span-5">
                    <label className="block text-slate-400 text-xs font-bold mb-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={item.name}
                      onChange={e => handleItemChange(index, e)}
                      className={`w-full px-3 py-1 border rounded-md bg-slate-700 text-slate-100 ${
                        errors.items?.[index]?.name ? 'border-red-500' : 'border-slate-600'
                      }`}
                      placeholder="Item Name"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-400 text-xs font-bold mb-1">Quantity</label>
                    <input
                      type="number"
                      name="quantity"
                      value={item.quantity}
                      onChange={e => handleItemChange(index, e)}
                      className={`w-full px-3 py-1 border rounded-md bg-slate-700 text-slate-100 ${
                        errors.items?.[index]?.quantity ? 'border-red-500' : 'border-slate-600'
                      }`}
                    />
                  </div>
                  <div className="col-span-1 flex items-end h-full">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-300 p-2 rounded-md hover:bg-red-700/20 transition-colors"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-4 px-4 py-2 text-sm rounded-md border border-dashed border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i> Add Item
            </button>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-md border border-slate-600 text-slate-300 font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update PO' : 'Add PO'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AmazonPOForm;
