import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import type { RMAItem } from '../../types/rma';

interface RMAFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<RMAItem>) => void;
  isSubmitting: boolean;
  initialData?: RMAItem | null;
}

const RMAForm = ({ isOpen, onClose, onSubmit, isSubmitting, initialData }: RMAFormProps) => {
  const [formData, setFormData] = useState<Partial<RMAItem>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData || {
          customer_name: '',
          order_number: '',
          status: 'Incoming',
          items_returned: '',
        }
      );
    } else {
      setFormData({});
    }
  }, [isOpen, initialData]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<RMAItem>) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const isEditMode = !!initialData;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl text-slate-100">
        <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b border-slate-700 pb-3">
          {isEditMode ? 'Edit RMA' : 'Create New RMA'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="customer_name"
              placeholder="Customer Name *"
              value={formData.customer_name || ''}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            />
            <input
              type="text"
              name="order_number"
              placeholder="Order Number *"
              value={formData.order_number || ''}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            />
            <input
              type="text"
              name="tracking_number"
              placeholder="Tracking Number"
              value={formData.tracking_number || ''}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            />
            <select
              name="status"
              value={formData.status || 'Incoming'}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600"
            >
              <option>Incoming</option>
              <option>Processing</option>
              <option>Testing</option>
              <option>Outgoing</option>
              <option>Completed</option>
            </select>
          </div>
          <textarea
            name="items_returned"
            placeholder="Items Returned (e.g., SKU, Serial #, reason)"
            value={formData.items_returned || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 min-h-[100px]"
          ></textarea>

          <div className="flex justify-end space-x-3 pt-4">
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
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update RMA' : 'Create RMA'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default RMAForm;
