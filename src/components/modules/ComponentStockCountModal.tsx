import { useState } from 'react';
import type { StockCountUpdate } from '../../types/stock';

interface BaseItem {
  id: string;
  name: string;
}

interface ComponentStockCountModalProps<T extends BaseItem> {
  isOpen: boolean;
  onClose: () => void;
  items: T[];
  onSubmit: (updates: StockCountUpdate[]) => void;
  itemType: string;
  isSubmitting: boolean;
}

const ComponentStockCountModal = <T extends BaseItem>({
  isOpen,
  onClose,
  items,
  onSubmit,
  itemType,
  isSubmitting,
}: ComponentStockCountModalProps<T>) => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const handleCountChange = (itemId: string, value: string) => {
    setCounts(prev => ({ ...prev, [itemId]: parseInt(value, 10) || 0 }));
  };

  const handleSubmit = () => {
    const updates: StockCountUpdate[] = Object.entries(counts).map(([id, countedStock]) => ({
      id,
      countedStock,
    }));
    onSubmit(updates);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md text-slate-100">
        <h2 className="text-xl font-bold text-cyan-400 mb-4">Stock Count for {itemType}</h2>
        <div className="max-h-96 overflow-y-auto">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-b border-slate-700"
            >
              <span>{item.name}</span>
              <input
                type="number"
                className="p-2 bg-slate-700 rounded-lg w-24"
                onChange={e => handleCountChange(item.id, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 rounded">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 rounded"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComponentStockCountModal;
