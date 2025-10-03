import { useState } from 'react';
import { useAmazonInventory } from '../hooks/useAmazonInventory';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import MiniBarGraph from '../components/modules/MiniBarGraph';
import EditAmazonItemModal from '../components/modules/EditAmazonItemModal';
import type { AmazonItem } from '../types/amazon';
import type { HistoryEntry } from '../types/history';

const StockLevelBar = ({
  level,
  inboundLevel,
  maxLevel,
}: {
  level: number;
  inboundLevel: number;
  maxLevel: number;
}) => {
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
  const {
    amazonInventory,
    loading: loadingAmazon,
    error: amazonError,
    updateAmazonItem,
    fetchAmazonItemHistory,
  } = useAmazonInventory();
  const { user } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<AmazonItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyData, setHistoryData] = useState<{ [key: string]: HistoryEntry[] }>({});
  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({});

  const canEdit = !!user; // Assuming any logged-in user can edit for now

  const handleOpenEditModal = (item: AmazonItem) => {
    setItemToEdit(item);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setItemToEdit(null);
    setShowEditModal(false);
  };

  const handleUpdateStock = async (id: string, updatedData: Partial<AmazonItem>) => {
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

  const toggleHistory = async (itemId: string) => {
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
        {amazonInventory.map((item: AmazonItem) => (
          <div
            key={item.id}
            className="bg-slate-700 p-4 rounded-lg flex flex-col justify-between relative"
          >
            <div>
              <span className="absolute top-2 right-2 text-xs text-slate-400">
                Data Updated:{' '}
                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}
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
                    <h4 className="text-lg font-semibold text-cyan-200 mb-2">
                      Recent Stock History
                    </h4>
                    <MiniBarGraph history={historyData[item.id]} />
                  </div>
                )}
              </div>
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
