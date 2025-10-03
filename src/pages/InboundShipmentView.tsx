import { useState, useEffect } from 'react';
import { useInboundShipments } from '../hooks/useInboundShipments';
import { useAuth } from '../context/AuthContext';
import type { InboundShipment as InboundShipmentType, InboundShipmentItem } from '../types/inbound';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import InboundShipmentModal from '../components/modules/InboundShipmentModal';

// --- Main InboundShipmentView Component ---
function InboundShipmentView() {
  const {
    inboundShipments,
    loading,
    addInboundShipment,
    updateInboundShipment,
    deleteInboundShipment,
    searchSKU,
  } = useInboundShipments();
  const { user } = useAuth(); // Changed from currentUser to user
  const { showMessageBox, showToast } = useMessageBox();

  const [showAddShipmentModal, setShowAddShipmentModal] = useState(false);
  const [isAddingShipment, setIsAddingShipment] = useState(false);
  const [shipmentToEdit, setShipmentToEdit] = useState<InboundShipmentType | null>(null);
  const [showEditShipmentModal, setShowEditShipmentModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const statusOptions = [
    'In Transit',
    'Arrived at Customs',
    'Customs Cleared',
    'Out for Delivery',
    'Complete',
  ];
  const canEdit = !!user; // Changed from currentUser to user

  useEffect(() => {
    inboundShipments.forEach((shipment: InboundShipmentType) => {
      if (
        shipment.status === 'Complete' &&
        shipment.items &&
        shipment.items.some((item: InboundShipmentItem) => !item.pushed)
      ) {
        // pushShipmentToInventory(shipment.id); // Uncomment when implemented
      }
    });
  }, [inboundShipments]); // Removed pushShipmentToInventory from dependencies as it's not used directly in useEffect

  // Add shipment
  const handleAddShipment = async (shipmentData: Partial<InboundShipmentType>) => {
    if (!user || !canEdit) {
      showToast('Permission denied. You must be authenticated to add shipments.', 'error');
      return;
    }
    if (!shipmentData.poNumber || !shipmentData.trackingNumber || !shipmentData.vendor) {
      showToast('Please fill in PO Number, Tracking Number, and Vendor.', 'error');
      return;
    }
    setIsAddingShipment(true);
    setShowAddShipmentModal(false);
    try {
      await addInboundShipment(shipmentData);
      showToast('Inbound shipment added successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error adding inbound shipment: ', e);
      showToast('Failed to add inbound shipment. Please try again.', 'error');
    } finally {
      setIsAddingShipment(false);
    }
  };

  // Update shipment
  const handleUpdateShipment = async (updatedData: Partial<InboundShipmentType> & { id?: string }) => {
    if (!user || !canEdit) {
      showToast('Permission denied. You must be authenticated to update shipments.', 'error');
      return;
    }
    if (!updatedData.id) {
      showToast('Error: No ID provided for shipment update.', 'error');
      return;
    }
    if (!updatedData.poNumber || !updatedData.trackingNumber || !updatedData.vendor) {
      showToast('Please fill in PO Number, Tracking Number, and Vendor.', 'error');
      return;
    }
    setIsAddingShipment(true);
    setShowEditShipmentModal(false);
    setShipmentToEdit(null);
    try {
      await updateInboundShipment(updatedData.id, updatedData);
      if (updatedData.status === 'Complete') {
        // await pushShipmentToInventory(updatedData.id); // Uncomment when implemented
      }
      showToast('Inbound shipment updated successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error updating inbound shipment: ', e);
      showToast('Failed to update inbound shipment. Please try again.', 'error');
    } finally {
      setIsAddingShipment(false);
    }
  };

  // Status change
  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!user || !canEdit) {
      showToast('Permission denied. You do not have access to change shipment status.', 'error');
      return;
    }
    try {
      await updateInboundShipment(id, {
        status: newStatus,
        // lastUpdatedBy: user.email || user.id, // Uncomment when user object has email/id
        // lastUpdatedAt: new Date() // Replace serverTimestamp with new Date()
      });
      if (newStatus === 'Complete') {
        // await pushShipmentToInventory(id); // Uncomment when implemented
      }
      showToast('Shipment status updated!', 'success');
    } catch (e: unknown) {
      console.error('Error updating shipment status:', e);
      showToast('Failed to update shipment status. Please try again.', 'error');
    }
  };

  // Confirmation toggle (always pass items)
  const handleConfirmationToggle = async (
    shipmentId: string,
    field: string,
    currentValue: boolean,
    items: InboundShipmentItem[]
  ) => {
    if (!user || !canEdit) {
      showToast('Permission denied. You do not have access to confirm actions.', 'error');
      return;
    }
    try {
      await updateInboundShipment(shipmentId, {
        [field]: !currentValue,
        items: items,
        // lastUpdatedBy: user.email || user.id, // Uncomment when user object has email/id
        // lastUpdatedAt: new Date() // Replace serverTimestamp with new Date()
      });
      showToast(`${field} ${!currentValue ? 'confirmed' : 'unconfirmed'}!`, 'success');
    } catch (e: unknown) {
      console.error(`Error toggling ${field}:`, e);
      showToast(`Failed to toggle ${field}.`, 'error');
    }
  };

  // Tracking page
  const openTrackingPage = (trackingNumber: string, shipmentType: string) => {
    let url;
    if (shipmentType === 'Sea Shipment') {
      url = `https://nvogo.nvoconsolidation.com/tracker;trackingnr=${trackingNumber}`;
    } else {
      url = `https://www.google.com/search?q=track+package+${trackingNumber}`;
    }
    if (url) {
      window.open(url, '_blank');
    } else {
      showToast('Tracking URL could not be determined.', 'error');
    }
  };

  // Delete shipment
  const handleDeleteShipment = async (id: string, poNumber: string) => {
    if (!user || !canEdit) {
      showToast('Permission denied. You do not have access to delete shipments.', 'error');
      return;
    }
    const confirmed = await showMessageBox(
      'Confirm Delete',
      `Are you sure you want to delete shipment "${poNumber}"? This action cannot be undone.`,
      true
    );
    if (!confirmed) return;
    try {
      await deleteInboundShipment(id);
      showToast('Inbound shipment deleted successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error deleting inbound shipment:', e);
      showToast('Failed to delete inbound shipment.', 'error');
    }
  };

  // Edit modal
  const openEditShipmentModal = (shipment: InboundShipmentType) => {
    setShipmentToEdit(shipment);
    setShowEditShipmentModal(true);
  };
  const closeEditShipmentModal = () => {
    setShowEditShipmentModal(false);
    setShipmentToEdit(null);
  };

  if (loading) return <LoadingSpinner />;

  const inProgressShipments = inboundShipments.filter(s => s.status !== 'Complete');
  const completedShipments = inboundShipments.filter(s => s.status === 'Complete');

  const renderShipmentTable = (shipments: InboundShipmentType[], title: string) => (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-cyan-300 mb-3">{title}</h3>
      {shipments.length === 0 ? (
        <p className="text-slate-400 text-center py-4">No shipments in this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Entered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Tracking No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customs Docs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Agent Emailed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Spreadsheets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {shipments.map((shipment: InboundShipmentType) => (
                <tr key={shipment.id} className="hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                    {shipment.timestamp}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
                    {shipment.poNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {shipment.trackingNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {shipment.vendor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {shipment.shipmentType || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select
                      value={shipment.status}
                      onChange={e => handleStatusChange(String(shipment.id ?? ''), e.target.value)}
                      disabled={!canEdit}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 text-sm py-1 bg-slate-900 text-slate-100"
                    >
                      {statusOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <input
                      type="checkbox"
                      checked={shipment.customsDocsDownloaded || false}
                      onChange={() =>
                        handleConfirmationToggle(
                          String(shipment.id ?? ''),
                          'customsDocsDownloaded',
                          Boolean(shipment.customsDocsDownloaded),
                          shipment.items || []
                        )
                      }
                      disabled={!canEdit}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <input
                      type="checkbox"
                      checked={shipment.importAgentEmailed || false}
                      onChange={() =>
                        handleConfirmationToggle(
                          String(shipment.id ?? ''),
                          'importAgentEmailed',
                          Boolean(shipment.importAgentEmailed),
                          shipment.items || []
                        )
                      }
                      disabled={!canEdit}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <input
                      type="checkbox"
                      checked={shipment.spreadsheetsUpdated || false}
                      onChange={() =>
                        handleConfirmationToggle(
                          String(shipment.id ?? ''),
                          'spreadsheetsUpdated',
                          Boolean(shipment.spreadsheetsUpdated),
                          shipment.items || []
                        )
                      }
                      disabled={!canEdit}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    <div className="max-h-20 overflow-y-auto whitespace-pre-wrap">
                      {shipment.notes || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                        {shipment.items && shipment.items.length > 0 ? (
                      <ul className="list-disc list-inside text-xs max-h-32 overflow-y-auto">
                        {shipment.items.map((item: InboundShipmentItem, itemIndex: number) => (
                          <li key={itemIndex}>
                            {item.sku}: {item.quantity} {item.pushed ? '(Pushed)' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {shipment.trackingNumber && (
                      <button
                        onClick={() =>
                            openTrackingPage(String(shipment.trackingNumber ?? ''), String(shipment.shipmentType ?? ''))
                          }
                        className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-xs font-medium"
                      >
                        Track
                      </button>
                    )}
                    {canEdit && (
                      <>
                        {shipment.status === 'Complete' &&
                          shipment.items &&
                          shipment.items.some((item: InboundShipmentItem) => !item.pushed) && (
                            <button
                              // onClick={() => pushShipmentToInventory(shipment.id)} // Uncomment when implemented
                              disabled={loading}
                              className="text-green-400 hover:text-green-300 px-3 py-1 rounded-lg border border-green-700/30 hover:bg-green-700/20 transition-colors text-xs font-medium"
                            >
                              Push to Inventory
                            </button>
                          )}
                        <button
                          onClick={() => openEditShipmentModal(shipment)}
                          className="text-yellow-400 hover:text-yellow-300 ml-2 px-3 py-1 rounded-lg border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteShipment(String(shipment.id ?? ''), String(shipment.poNumber ?? ''))}
                          className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-lg border border-red-700/30 hover:bg-red-700/20 transition-colors text-xs font-medium"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-cyan-400">Inbound Shipments (AIDA)</h2>
        {canEdit && (
          <button
            onClick={() => setShowAddShipmentModal(true)}
            disabled={isAddingShipment}
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingShipment ? 'Adding...' : 'Add New Shipment'}
          </button>
        )}
      </div>

      {renderShipmentTable(inProgressShipments, 'In-Progress')}

      {completedShipments.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            {showCompleted ? 'Hide' : 'Show'} Completed ({completedShipments.length})
          </button>
          {showCompleted && renderShipmentTable(completedShipments, 'Completed')}
        </div>
      )}

      {inboundShipments.length === 0 && (
        <p className="text-slate-400 text-center py-4">
          No inbound shipments yet. Add a new shipment.
        </p>
      )}

      <InboundShipmentModal
        isOpen={showAddShipmentModal}
        onClose={() => setShowAddShipmentModal(false)}
        onSubmit={async data => await handleAddShipment(data as unknown as Partial<InboundShipmentType>)}
        isSubmitting={isAddingShipment}
        canEdit={canEdit}
        initialData={null}
        searchSKU={searchSKU}
      />

      {shipmentToEdit && (
        <InboundShipmentModal
          isOpen={showEditShipmentModal}
          onClose={closeEditShipmentModal}
          onSubmit={async data =>
            await handleUpdateShipment({ ...(data as unknown as Partial<InboundShipmentType>), id: shipmentToEdit?.id })
          }
          isSubmitting={isAddingShipment}
          canEdit={canEdit}
          initialData={
            shipmentToEdit
              ? {
                  id: shipmentToEdit.id,
                  poNumber: shipmentToEdit.poNumber ?? '',
                  trackingNumber: shipmentToEdit.trackingNumber ?? '',
                  vendor: shipmentToEdit.vendor ?? '',
                  shipmentType: (shipmentToEdit.shipmentType as 'Air Shipment' | 'Sea Shipment') ?? 'Air Shipment',
                  status: shipmentToEdit.status ?? 'In Transit',
                  notes: shipmentToEdit.notes ?? '',
                  items: (shipmentToEdit.items || []).map(i => ({ sku: i.sku, quantity: i.quantity })),
                }
              : null
          }
          searchSKU={searchSKU}
        />
      )}
    </>
  );
}

export default InboundShipmentView;
