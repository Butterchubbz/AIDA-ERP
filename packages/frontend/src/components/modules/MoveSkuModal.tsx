import React, { useState } from 'react';
import type { DeviceItem, AccessoryItem, ComponentItem } from '@aida/shared';

interface MoveSkuModalProps {
  isOpen: boolean;
  item: DeviceItem | AccessoryItem | ComponentItem | null;
  currentSection: 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory';
  onClose: () => void;
  onConfirm: (toCollection: 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory') => Promise<void>;
  isLoading: boolean;
  error?: string;
}

const sectionNames: Record<string, string> = {
  inventoryDevice: 'Devices',
  inventoryComponent: 'Components',
  inventoryAccessory: 'Accessories',
};

const MoveSkuModal: React.FC<MoveSkuModalProps> = ({
  isOpen,
  item,
  currentSection,
  onClose,
  onConfirm,
  isLoading,
  error,
}) => {
  const [selectedSection, setSelectedSection] = useState<'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory' | ''>('');

  const handleConfirm = async () => {
    if (!selectedSection) {
      return;
    }
    await onConfirm(selectedSection as 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory');
    setSelectedSection('');
  };

  if (!isOpen || !item) {
    return null;
  }

  const otherSections = Object.keys(sectionNames).filter(
    section => section !== currentSection
  ) as Array<'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory'>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-slate-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            <i className="fas fa-exchange-alt mr-2 text-blue-400"></i>
            Move SKU
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div className="bg-slate-900 rounded p-3 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase mb-1">Current Item</p>
            <p className="text-sm font-semibold text-slate-100">SKU: {item.sku}</p>
            <p className="text-sm text-slate-300">Name: {item.name}</p>
            <p className="text-xs text-slate-400 mt-2">Current Section: {sectionNames[currentSection]}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Move to Section:</label>
            <select
              value={selectedSection}
              onChange={e =>
                setSelectedSection(
                  e.target.value as 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory' | ''
                )
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a section...</option>
              {otherSections.map(section => (
                <option key={section} value={section}>
                  {sectionNames[section]}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded border border-red-700/30">{error}</div>}

          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded p-3">
            <p className="text-xs text-yellow-300">
              <i className="fas fa-exclamation-triangle mr-1"></i>
              This will move the item from {sectionNames[currentSection]} to the selected section.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSection || isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Moving...
              </>
            ) : (
              <>
                <i className="fas fa-arrow-right mr-2"></i>
                Move SKU
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveSkuModal;
