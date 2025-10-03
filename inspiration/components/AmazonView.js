// src/components/AmazonView.js

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAmazonInventory } from '../hooks/useAmazonInventory';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import MiniBarGraph from './MiniBarGraph';

const EditAmazonItemModal = ({ isOpen, onClose, onSubmit, isSubmitting, canEdit, itemData }) => {
  const [modalEditedItem, setModalEditedItem] = useState({});

  useEffect(() => {
    if (isOpen && itemData) {
      setModalEditedItem(itemData);
    }
  }, [isOpen, itemData]);

  const handleModalInputChange = e => {
    const { name, value } = e.target;
    setModalEditedItem(prev => ({
      ...prev,
      [name]: parseInt(value, 10) || 0,
    }));
  };

  const handleSubmit = () => {
    if (!canEdit) return;
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
              value={modalEditedItem.amazonFBA_BaseQuantity || 0}
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
              value={modalEditedItem.amazonFBA_Base_OnTheWayQuantity || 0}
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
              value={modalEditedItem.amazonFBA_250Quantity || 0}
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
              value={modalEditedItem.amazonFBA_250_OnTheWayQuantity || 0}
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
              value={modalEditedItem.amazonFBA_500Quantity || 0}
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
              value={modalEditedItem.amazonFBA_500_OnTheWayQuantity || 0}
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
            disabled={isSubmitting}
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

const StockLevelBar = ({ level, inboundLevel, maxLevel }) => {
  const currentPercentage = (level / maxLevel) * 100;
  const inboundPercentage = (inboundLevel / maxLevel) * 100;
  let barColor;

  if (level < 10) {
    barColor = 'bg-red-500';
  } else {
    barColor = 'bg-green-500';
  }

  return (
    <div className="w-full bg-gray-700 rounded-full h-4 my-2 relative">
      <div
        className={`${barColor} h-4 rounded-l-full`}
        style={{ width: `${currentPercentage}%` }}
      ></div>
      <div
        className="absolute top-0 h-4 bg-gray-500 opacity-50 rounded-r-full"
        style={{ left: `${currentPercentage}%`, width: `${inboundPercentage}%` }}
      ></div>
    </div>
  );
};

function AmazonView() {
  const { amazonInventory, loadingAmazon, amazonError, updateAmazonItem, fetchAmazonItemHistory } =
    useAmazonInventory();
  const { currentUser } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyData, setHistoryData] = useState({});
  const [showHistory, setShowHistory] = useState({});

  const canEdit = !!currentUser;

  const handleOpenEditModal = item => {
    setItemToEdit(item);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setItemToEdit(null);
    setShowEditModal(false);
  };

  const handleUpdateStock = async (id, updatedData) => {
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      await updateAmazonItem(id, updatedData);
      handleCloseEditModal();
    } catch (error) {
      console.error('Failed to update stock:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleHistory = async itemId => {
    setShowHistory(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));

    if (!historyData[itemId]) {
      const history = await fetchAmazonItemHistory(itemId);
      setHistoryData(prev => ({
        ...prev,
        [itemId]: history,
      }));
    }
  };

  if (loadingAmazon) {
    return <LoadingSpinner />;
  }

  if (amazonError) {
    return <p className="text-red-500">{amazonError}</p>;
  }

  return (
    <section className="bg-slate-800 p-6 rounded-xl shadow-lg w-full text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6">FBA Stock Levels</h2>
      <div className="grid grid-cols-2 gap-6">
        {amazonInventory.map(item => (
          <div
            key={item.id}
            className="bg-slate-700 p-4 rounded-lg flex flex-col justify-between relative"
          >
            <span className="absolute top-2 right-2 text-xs text-slate-400">
              Data Updated: {item.updatedAt?.toDate().toLocaleDateString()}
            </span>
            <div>
              <h3 className="text-xl font-bold text-cyan-300">{item.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{item.sku}</p>
              <div>
                <div className="mb-4">
                  <p className="font-semibold">FBA Base</p>
                  <p>Current Stock: {item.amazonFBA_BaseQuantity || 0}</p>
                  <p>Inbound: {item.amazonFBA_Base_OnTheWayQuantity || 0}</p>
                  <StockLevelBar
                    level={item.amazonFBA_BaseQuantity || 0}
                    inboundLevel={item.amazonFBA_Base_OnTheWayQuantity || 0}
                    maxLevel={50}
                  />
                </div>
                <div className="mb-4">
                  <p className="font-semibold">FBA 250 Pack</p>
                  <p>Current Stock: {item.amazonFBA_250Quantity || 0}</p>
                  <p>Inbound: {item.amazonFBA_250_OnTheWayQuantity || 0}</p>
                  <StockLevelBar
                    level={item.amazonFBA_250Quantity || 0}
                    inboundLevel={item.amazonFBA_250_OnTheWayQuantity || 0}
                    maxLevel={50}
                  />
                </div>
                <div>
                  <p className="font-semibold">FBA 500 Pack</p>
                  <p>Current Stock: {item.amazonFBA_500Quantity || 0}</p>
                  <p>Inbound: {item.amazonFBA_500_OnTheWayQuantity || 0}</p>
                  <StockLevelBar
                    level={item.amazonFBA_500Quantity || 0}
                    inboundLevel={item.amazonFBA_500_OnTheWayQuantity || 0}
                    maxLevel={50}
                  />
                </div>
              </div>
              {showHistory[item.id] && (
                <div className="mt-4">
                  <h4 className="text-lg font-semibold text-cyan-200 mb-2">Recent Stock History</h4>
                  <MiniBarGraph history={historyData[item.id]} />
                </div>
              )}
            </div>
            <div className="mt-4 flex space-x-2">
              {canEdit && (
                <button
                  onClick={() => handleOpenEditModal(item)}
                  className="w-full px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => toggleHistory(item.id)}
                className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700"
              >
                History
              </button>
            </div>
          </div>
        ))}
      </div>
      {itemToEdit && (
        <EditAmazonItemModal
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          onSubmit={handleUpdateStock}
          isSubmitting={isSubmitting}
          canEdit={canEdit}
          itemData={itemToEdit}
        />
      )}
    </section>
  );
}

export default AmazonView;
