import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Shipment, ShipmentItem } from '@aida/shared';

interface ShipmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Shipment>) => void;
  isSubmitting: boolean;
  initialData?: Shipment | null;
}

const ShipmentForm = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
}: ShipmentFormProps) => {
  const [formData, setFormData] = useState<Partial<Shipment>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData || {
          po_number: '',
          tracking_number: '',
          vendor: '',
          status: 'In Transit',
          items: [{ sku: '', quantity: 1 }],
          notes: '',
        }
      );
    } else {
      setFormData({});
    }
  }, [isOpen, initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<Shipment>) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index: number, field: 'sku' | 'quantity', value: string | number) => {
    const items = [...(formData.items || [])];
    items[index] = { ...items[index], [field]: value };
    setFormData((prev: Partial<Shipment>) => ({ ...prev, items }));
  };

  const addItem = () => {
    const items = [...(formData.items || []), { sku: '', quantity: 1 }];
    setFormData((prev: Partial<Shipment>) => ({ ...prev, items }));
  };

  const removeItem = (index: number) => {
    const items = (formData.items || []).filter((_: ShipmentItem, i: number) => i !== index);
    setFormData((prev: Partial<Shipment>) => ({ ...prev, items }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const isEditMode = !!initialData;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-3xl text-slate-100 max-h-full overflow-y-auto">
        <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b border-slate-700 pb-3">
          {isEditMode ? 'Edit Shipment' : 'Add New Shipment'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="po_number"
              placeholder="PO Number *"
              value={formData.po_number || ''}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            />
            <input
              type="text"
              name="tracking_number"
              placeholder="Tracking Number *"
              value={formData.tracking_number || ''}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            />
            <input
              type="text"
              name="vendor"
              placeholder="Vendor *"
              value={formData.vendor || ''}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            />
            <select
              name="status"
              value={formData.status || 'In Transit'}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            >
              <option>In Transit</option>
              <option>Arrived at Customs</option>
              <option>Customs Cleared</option>
              <option>Out for Delivery</option>
              <option>Complete</option>
            </select>
          </div>
          <textarea
            name="notes"
            placeholder="Notes"
            value={formData.notes || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 min-h-[80px]"
          ></textarea>

          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-lg font-semibold text-slate-300 mb-2">Items</h3>
            {(formData.items || []).map((item: ShipmentItem, index: number) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="SKU *"
                  value={item.sku}
                  onChange={e => handleItemChange(index, 'sku', e.target.value)}
                  required
                  className="col-span-7 px-3 py-1 border rounded-md bg-slate-600 border-slate-500"
                />
                <input
                  type="number"
                  placeholder="Qty *"
                  value={item.quantity}
                  onChange={e =>
                    handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)
                  }
                  required
                  className="col-span-3 px-3 py-1 border rounded-md bg-slate-600 border-slate-500"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="col-span-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="mt-2 px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              + Add Item
            </button>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 rounded-md border border-slate-600 text-slate-300 font-semibold hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-md bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition-colors disabled:bg-slate-600"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Shipment' : 'Add Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ShipmentForm;
