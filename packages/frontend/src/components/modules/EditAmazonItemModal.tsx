import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AmazonItem } from '@aida/shared';

interface EditAmazonItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: AmazonItem) => void;
  isSubmitting: boolean;
  canEdit: boolean;
  itemData: AmazonItem | null;
}

const EditAmazonItemModal: React.FC<EditAmazonItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  canEdit,
  itemData,
}) => {
  const [modalEditedItem, setModalEditedItem] = useState<AmazonItem | null>(null);

  useEffect(() => {
    if (isOpen && itemData) {
      setModalEditedItem(itemData);
    }
  }, [isOpen, itemData]);

  const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setModalEditedItem(
      prev =>
        ({
          ...prev,
          [name]: parseInt(value, 10) || 0,
        } as AmazonItem)
    );
  };

  const handleSubmit = () => {
    if (!canEdit || !modalEditedItem) return;
    onSubmit(modalEditedItem.id, modalEditedItem);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">Edit FBA Stock: {itemData?.name}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1">FBA (Base)</label>
            <input
              type="number"
              name="amazonFBA_BaseQuantity"
              value={modalEditedItem?.amazonFBA_BaseQuantity || 0}
              onChange={handleModalInputChange}
              disabled={isSubmitting || !canEdit}
              className="p-3 bg-slate-700 rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1">
              FBA (Base) On the Way
            </label>
            <input
              type="number"
              name="amazonFBA_Base_OnTheWayQuantity"
              value={modalEditedItem?.amazonFBA_Base_OnTheWayQuantity || 0}
              onChange={handleModalInputChange}
              disabled={isSubmitting || !canEdit}
              className="p-3 bg-slate-700 rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1">FBA (250 Pack)</label>
            <input
              type="number"
              name="amazonFBA_250Quantity"
              value={modalEditedItem?.amazonFBA_250Quantity || 0}
              onChange={handleModalInputChange}
              disabled={isSubmitting || !canEdit}
              className="p-3 bg-slate-700 rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1">
              FBA (250) On the Way
            </label>
            <input
              type="number"
              name="amazonFBA_250_OnTheWayQuantity"
              value={modalEditedItem?.amazonFBA_250_OnTheWayQuantity || 0}
              onChange={handleModalInputChange}
              disabled={isSubmitting || !canEdit}
              className="p-3 bg-slate-700 rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1">FBA (500 Pack)</label>
            <input
              type="number"
              name="amazonFBA_500Quantity"
              value={modalEditedItem?.amazonFBA_500Quantity || 0}
              onChange={handleModalInputChange}
              disabled={isSubmitting || !canEdit}
              className="p-3 bg-slate-700 rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1">
              FBA (500) On the Way
            </label>
            <input
              type="number"
              name="amazonFBA_500_OnTheWayQuantity"
              value={modalEditedItem?.amazonFBA_500_OnTheWayQuantity || 0}
              onChange={handleModalInputChange}
              disabled={isSubmitting || !canEdit}
              className="p-3 bg-slate-700 rounded-lg w-full"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canEdit}
            className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700"
          >
            {isSubmitting ? 'Updating...' : 'Update Stock'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditAmazonItemModal;
