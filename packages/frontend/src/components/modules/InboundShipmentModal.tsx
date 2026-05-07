import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InboundShipmentItem {
  sku: string;
  quantity: number;
}

interface InboundShipmentData {
  id?: string;
  poNumber: string;
  trackingNumber: string;
  vendor: string;
  shipmentType: 'Air Shipment' | 'Sea Shipment';
  status: string;
  notes: string;
  items: InboundShipmentItem[];
}

interface InboundShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InboundShipmentData) => Promise<void>;
  isSubmitting: boolean;
  canEdit: boolean;
  initialData: InboundShipmentData | null;
  searchSKU: (searchString: string) => Promise<{ sku: string; name: string }[]>;
}

const InboundShipmentModal: React.FC<InboundShipmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  canEdit,
  initialData,
  searchSKU,
}) => {
  const [modalEntryData, setModalEntryData] = useState<InboundShipmentData>(
    initialData || {
      poNumber: '',
      trackingNumber: '',
      vendor: '',
      shipmentType: 'Air Shipment',
      status: 'In Transit',
      notes: '',
      items: [],
    }
  );

  const [modalEntryItems, setModalEntryItems] = useState<InboundShipmentItem[]>(
    initialData?.items || [{ sku: '', quantity: 0 }]
  );
  const [skuSearchResults, setSkuSearchResults] = useState<{ sku: string; name: string }[]>([]);
  const [activeSkuSearch, setActiveSkuSearch] = useState<number>(-1);

  useEffect(() => {
    if (isOpen) {
      setModalEntryData(
        initialData || {
          poNumber: '',
          trackingNumber: '',
          vendor: '',
          shipmentType: 'Air Shipment',
          status: 'In Transit',
          notes: '',
          items: [],
        }
      );
      setModalEntryItems(initialData?.items || [{ sku: '', quantity: 0 }]);
    }
  }, [isOpen, initialData]);

  const handleModalInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setModalEntryData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddItem = () => {
    setModalEntryItems(prev => [...prev, { sku: '', quantity: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setModalEntryItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof InboundShipmentItem,
    value: string | number
  ) => {
    setModalEntryItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSkuSearch = async (index: number, searchString: string) => {
    handleItemChange(index, 'sku', searchString);
    if (searchString.length >= 2) {
      const results = await searchSKU(searchString);
      setSkuSearchResults(results);
      setActiveSkuSearch(index);
    } else {
      setSkuSearchResults([]);
      setActiveSkuSearch(-1);
    }
  };

  const selectSku = (index: number, sku: string) => {
    handleItemChange(index, 'sku', sku);
    setSkuSearchResults([]);
    setActiveSkuSearch(-1);
  };

  const handleSubmit = async () => {
    if (!canEdit) return;
    await onSubmit({ ...modalEntryData, items: modalEntryItems });
  };

  if (!isOpen) return null;

  const isEditMode = initialData && initialData.id;

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all scale-100 opacity-100 my-8 text-slate-100">
        <h3 className="text-2xl font-bold mb-4 text-cyan-400">
          {isEditMode ? 'Edit Inbound Shipment' : 'New Inbound Shipment'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="po-number" className="block text-slate-300 text-sm font-bold mb-1">
              PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="po-number"
              name="poNumber"
              placeholder="Purchase Order Number"
              value={modalEntryData.poNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="tracking-number"
              className="block text-slate-300 text-sm font-bold mb-1"
            >
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="tracking-number"
              name="trackingNumber"
              placeholder="Shipment Tracking Number"
              value={modalEntryData.trackingNumber}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="vendor" className="block text-slate-300 text-sm font-bold mb-1">
              Vendor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vendor"
              name="vendor"
              placeholder="Vendor Name"
              value={modalEntryData.vendor}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            />
          </div>
          <div className="col-span-full">
            <label htmlFor="shipment-type" className="block text-slate-300 text-sm font-bold mb-1">
              Shipment Type
            </label>
            <select
              id="shipment-type"
              name="shipmentType"
              value={modalEntryData.shipmentType}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
            >
              <option value="Air Shipment">Air Shipment</option>
              <option value="Sea Shipment">Sea Shipment</option>
            </select>
          </div>
          {isEditMode && (
            <div className="col-span-full">
              <label htmlFor="status" className="block text-slate-300 text-sm font-bold mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={modalEntryData.status}
                onChange={handleModalInputChange}
                disabled={isSubmitting}
                className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-700 text-slate-100"
              >
                {[
                  'In Transit',
                  'Arrived at Customs',
                  'Customs Cleared',
                  'Out for Delivery',
                  'Complete',
                ].map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-full">
            <label htmlFor="notes" className="block text-slate-300 text-sm font-bold mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Any additional notes about the shipment"
              value={modalEntryData.notes}
              onChange={handleModalInputChange}
              disabled={isSubmitting}
              rows={3}
              className="p-3 border border-slate-600 rounded-lg w-full focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-y bg-slate-700 text-slate-100"
            ></textarea>
          </div>
        </div>
        {/* Items Section */}
        <div className="col-span-full mt-4 border-t border-slate-700 pt-4">
          <h4 className="text-lg font-bold text-slate-300 mb-3">Shipment Items</h4>
          {modalEntryItems.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 p-3 border border-slate-700 rounded-md bg-slate-700/30 relative"
            >
              <div className="md:col-span-2">
                <label
                  htmlFor={`sku-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  SKU
                </label>
                <input
                  type="text"
                  id={`sku-${index}`}
                  value={item.sku}
                  onChange={e => handleSkuSearch(index, e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Item SKU"
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
                {activeSkuSearch === index && skuSearchResults.length > 0 && (
                  <ul className="absolute z-10 w-full bg-slate-900 border border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto">
                    {skuSearchResults.map((result, resultIndex) => (
                      <li
                        key={resultIndex}
                        onClick={() => selectSku(index, result.sku)}
                        className="p-2 hover:bg-slate-700 cursor-pointer"
                      >
                        <span className="font-mono text-cyan-400">{result.sku}</span>
                        <span className="text-slate-400 ml-2 text-sm">{result.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label
                  htmlFor={`quantity-${index}`}
                  className="block text-slate-400 text-xs font-bold mb-1"
                >
                  Quantity
                </label>
                <input
                  type="number"
                  id={`quantity-${index}`}
                  value={item.quantity}
                  onChange={e =>
                    handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 0)
                  }
                  disabled={isSubmitting}
                  placeholder="Quantity"
                  min={0}
                  className="p-2 border border-slate-600 rounded-lg w-full focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 bg-slate-800 text-slate-100 text-sm"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={isSubmitting || modalEntryItems.length === 1}
                  className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddItem}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Item
          </button>
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
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Shipment' : 'Add Shipment'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InboundShipmentModal;
