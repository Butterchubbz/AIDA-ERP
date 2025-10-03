// src/components/StockCountModal.js
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const StockCountModal = ({ isOpen, onClose, items, onSubmit, itemType, isSubmitting }) => {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (isOpen) {
      const initialCounts = {};
      // Flatten the list to initialize state, regardless of whether the input is grouped or not.
      const allItems =
        itemType === 'component' && Array.isArray(items)
          ? items.flatMap(cat => cat.subcategories.flatMap(sub => sub.items))
          : items;

      allItems.forEach(item => {
        if (itemType === 'vault') {
          initialCounts[item.id] = {
            productionStock: item.productionStock || 0,
            warehouseStock: item.warehouseStock || 0,
          };
        } else if (itemType === 'component') {
          initialCounts[item.id] = {
            wooStock: item.wooStock || 0,
            countedStock: item.countedStock || 0,
          };
        }
      });
      setCounts(initialCounts);
    }
  }, [isOpen, items, itemType]);

  const handleCountChange = (itemId, field, value) => {
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue)) return;

    setCounts(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: numericValue,
      },
    }));
  };

  const handleSubmit = () => {
    const updates = [];
    const allItems =
      itemType === 'component' && Array.isArray(items)
        ? items.flatMap(cat => cat.subcategories.flatMap(sub => sub.items))
        : items;

    for (const item of allItems) {
      const currentCounts = counts[item.id];
      if (!currentCounts) continue;

      const updatedFields = {};
      let hasChanged = false;

      if (itemType === 'vault') {
        if (currentCounts.productionStock !== (item.productionStock || 0)) {
          updatedFields.productionStock = currentCounts.productionStock;
          hasChanged = true;
        }
        if (currentCounts.warehouseStock !== (item.warehouseStock || 0)) {
          updatedFields.warehouseStock = currentCounts.warehouseStock;
          hasChanged = true;
        }
      } else if (itemType === 'component') {
        if (currentCounts.wooStock !== (item.wooStock || 0)) {
          updatedFields.wooStock = currentCounts.wooStock;
          hasChanged = true;
        }
        if (currentCounts.countedStock !== (item.countedStock || 0)) {
          updatedFields.countedStock = currentCounts.countedStock;
          hasChanged = true;
        }
      }

      if (hasChanged) {
        updates.push({ id: item.id, updatedFields });
      }
    }
    onSubmit(updates);
  };

  if (!isOpen) return null;

  const renderVaultRow = item => (
    <tr key={item.id} className="hover:bg-slate-700">
      <td className="px-4 py-2 text-sm text-slate-300">{item.sku}</td>
      <td className="px-4 py-2 text-sm font-medium text-slate-100">{item.name}</td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={counts[item.id]?.productionStock ?? ''}
          onChange={e => handleCountChange(item.id, 'productionStock', e.target.value)}
          className="w-24 px-2 py-1 border rounded-md bg-slate-900 text-slate-100 border-slate-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={counts[item.id]?.warehouseStock ?? ''}
          onChange={e => handleCountChange(item.id, 'warehouseStock', e.target.value)}
          className="w-24 px-2 py-1 border rounded-md bg-slate-900 text-slate-100 border-slate-600"
        />
      </td>
    </tr>
  );

  const renderComponentRow = item => (
    <tr key={item.id} className="hover:bg-slate-700">
      <td className="px-4 py-2 text-sm text-slate-300">{item.sku}</td>
      <td className="px-4 py-2 text-sm font-medium text-slate-100">{item.name}</td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={counts[item.id]?.wooStock ?? ''}
          onChange={e => handleCountChange(item.id, 'wooStock', e.target.value)}
          className="w-24 px-2 py-1 border rounded-md bg-slate-900 text-slate-100 border-slate-600"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          value={counts[item.id]?.countedStock ?? ''}
          onChange={e => handleCountChange(item.id, 'countedStock', e.target.value)}
          className="w-24 px-2 py-1 border rounded-md bg-slate-900 text-slate-100 border-slate-600"
        />
      </td>
    </tr>
  );

  const renderGroupedComponents = () =>
    items.map(({ categoryName, subcategories }) => (
      <React.Fragment key={categoryName}>
        <tr className="bg-slate-900/70 sticky top-0">
          <td colSpan="4" className="px-4 py-2 text-lg font-bold text-cyan-300">
            {categoryName}
          </td>
        </tr>
        {subcategories.map(({ subcategoryName, items: subItems }) => (
          <React.Fragment key={subcategoryName}>
            <tr className="bg-slate-800/50 sticky top-10">
              <td colSpan="4" className="px-8 py-1 text-md font-semibold text-blue-300">
                {subcategoryName}
              </td>
            </tr>
            {subItems.map(item => renderComponentRow(item))}
          </React.Fragment>
        ))}
      </React.Fragment>
    ));

  const renderFlatList = renderRow => items.map(item => renderRow(item));

  const headers =
    itemType === 'vault'
      ? ['SKU', 'Name', 'Production Stock', 'Warehouse Stock']
      : ['SKU', 'Name', 'Woo Stock', 'Counted Stock'];

  return createPortal(
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-4xl transform transition-all scale-100 opacity-100 my-8 text-slate-100 flex flex-col">
        <h2 className="text-2xl font-semibold text-cyan-400 mb-4 flex-shrink-0">
          <i className="fas fa-clipboard-check mr-2"></i>
          Bulk Stock Count - {itemType === 'vault' ? 'Vaults' : 'Components'}
        </h2>
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700 sticky top-0 z-10">
              <tr>
                {headers.map(header => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {itemType === 'component'
                ? renderGroupedComponents()
                : renderFlatList(renderVaultRow)}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-slate-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-md border border-slate-600 text-slate-300 font-semibold hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Counts'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StockCountModal;
