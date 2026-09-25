import { useState, useEffect } from 'react';
import { formatLocalDateTime } from '../utils/date';
import { useInboundShipments } from '../hooks/useShippingModules';
import { useComponentInventory } from '../hooks/useInventoryModules';
import { useAuth } from '../context/AuthContext';
import { useDeviceContext } from '../context/DeviceContext';
import type { InboundShipment as InboundShipmentType, InboundShipmentItem } from '@aida/shared';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import InboundShipmentModal from '../components/modules/InboundShipmentModal';

type ChecklistField = 'customsDocsDownloaded' | 'importAgentEmailed' | 'spreadsheetsUpdated';
type ChecklistColor = 'blue' | 'purple' | 'green';

interface ChecklistItemDef {
  field: ChecklistField;
  label: string;
  icon: string;
  color: ChecklistColor;
}

function getChecklistItemClass(
  checked: boolean,
  color: ChecklistColor
): { card: string; check: string; iconColor: string } {
  const colorMap: Record<ChecklistColor, { card: string; check: string; iconColor: string }> = {
    blue: {
      card: 'bg-blue-900/30 border-blue-700/40',
      check: 'bg-blue-600',
      iconColor: 'text-blue-400',
    },
    purple: {
      card: 'bg-purple-900/30 border-purple-700/40',
      check: 'bg-purple-600',
      iconColor: 'text-purple-400',
    },
    green: {
      card: 'bg-green-900/30 border-green-700/40',
      check: 'bg-green-600',
      iconColor: 'text-green-400',
    },
  };
  const colors = colorMap[color];
  return {
    card: checked
      ? `${colors.card} border`
      : 'bg-slate-800 border border-slate-700 hover:border-slate-600',
    check: checked ? colors.check : 'bg-slate-700 border border-slate-600',
    iconColor: checked ? colors.iconColor : 'text-slate-400',
  };
}

const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  {
    field: 'customsDocsDownloaded',
    label: 'Customs Documents Downloaded',
    icon: 'fas fa-file-download',
    color: 'blue',
  },
  {
    field: 'importAgentEmailed',
    label: 'Import Agent Notified',
    icon: 'fas fa-envelope',
    color: 'purple',
  },
  {
    field: 'spreadsheetsUpdated',
    label: 'Records Updated',
    icon: 'fas fa-table',
    color: 'green',
  },
];

const LOCAL_SUPPLIER_EXCLUDED_CHECKLIST = new Set<ChecklistField>([
  'customsDocsDownloaded',
  'importAgentEmailed',
]);

// --- Main InboundShipmentView Component ---
function InboundShipmentView() {
  const {
    inboundShipments,
    loading,
    addInboundShipment,
    updateInboundShipment,
    deleteInboundShipment,
    pushShipmentToInventory,
    searchSKU,
  } = useInboundShipments();
  const { user, userRoles } = useAuth();
  const { refetch: refetchDevices } = useDeviceContext();
  const { refetch: refetchComponents } = useComponentInventory();
  const { showMessageBox, showToast } = useMessageBox();

  const [showAddShipmentModal, setShowAddShipmentModal] = useState(false);
  const [isAddingShipment, setIsAddingShipment] = useState(false);
  const [shipmentToEdit, setShipmentToEdit] = useState<InboundShipmentType | null>(null);
  const [showEditShipmentModal, setShowEditShipmentModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const statusOptions = [
    'In Transit',
    'Arrived at Customs',
    'Customs Cleared',
    'Out for Delivery',
    'Complete',
  ];
  const canEdit =
    userRoles?.['Inbound Shipments'] === 'Editor' ||
    userRoles?.Inventory === 'Editor' ||
    !!user;

  useEffect(() => {}, [inboundShipments]);

  // Add shipment
  const handleAddShipment = async (shipmentData: Partial<InboundShipmentType>) => {
    if (!user || !canEdit) {
      showToast('Permission denied. You must be authenticated to add shipments.', 'error');
      return;
    }
    const requiresTracking = shipmentData.shipmentType !== 'Local Supplier';
    if (!shipmentData.poNumber || !shipmentData.vendor || (requiresTracking && !shipmentData.trackingNumber)) {
      showToast(
        requiresTracking
          ? 'Please fill in PO Number, Tracking Number, and Vendor.'
          : 'Please fill in PO Number and Vendor.',
        'error'
      );
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
    const requiresTracking = updatedData.shipmentType !== 'Local Supplier';
    if (!updatedData.poNumber || !updatedData.vendor || (requiresTracking && !updatedData.trackingNumber)) {
      showToast(
        requiresTracking
          ? 'Please fill in PO Number, Tracking Number, and Vendor.'
          : 'Please fill in PO Number and Vendor.',
        'error'
      );
      return;
    }
    setIsAddingShipment(true);
    setShowEditShipmentModal(false);
    setShipmentToEdit(null);
    try {
      await updateInboundShipment(updatedData.id, updatedData);
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
      showToast('Shipment status updated!', 'success');
    } catch (e: unknown) {
      console.error('Error updating shipment status:', e);
      showToast('Failed to update shipment status. Please try again.', 'error');
    }
  };

  const handleReceiveShipment = async (shipmentId: string, itemCount: number) => {
    if (!canEdit) {
      showToast('Permission denied. You do not have access to receive shipments.', 'error');
      return;
    }

    const confirmed = await showMessageBox(
      'Receive Shipment',
      `Receive this shipment and push ${itemCount} item(s) to inventory?`,
      true
    );
    if (!confirmed) return;

    try {
      const result = await pushShipmentToInventory(shipmentId);
      await Promise.all([
        refetchDevices().catch(console.error),
        refetchComponents().catch(console.error),
      ]);

      if (result && result.toLowerCase().startsWith('warning')) {
        showToast(result, 'info');
      } else {
        showToast('Shipment received and inventory updated.', 'success');
      }
    } catch (e) {
      console.error('Error receiving shipment:', e);
      showToast('Failed to receive shipment.', 'error');
    }
  };

  const handleCopyTracking = async (trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      showToast(`Tracking number copied: ${trackingNumber}`, 'success');
    } catch (e) {
      console.error('Failed to copy tracking number:', e);
      showToast('Failed to copy tracking number.', 'error');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
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
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"></th>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {shipments.map((shipment: InboundShipmentType) => (
                <>
                  <tr key={shipment.id} className="hover:bg-slate-700">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                      <button
                        onClick={() => toggleExpanded(String(shipment.id ?? ''))}
                        className="px-2 py-1 rounded border border-slate-600 hover:bg-slate-600"
                        title="Toggle details"
                      >
                        <i
                          className={`fas ${expandedRows[String(shipment.id ?? '')] ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                        ></i>
                      </button>
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
                        onChange={e => handleStatusChange(String(shipment.id), e.target.value)}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {shipment.status !== 'Complete' && canEdit && (
                        <button
                          onClick={() => handleReceiveShipment(String(shipment.id), shipment.items?.length ?? 0)}
                          className="text-green-400 hover:text-green-300 px-3 py-1 rounded-lg border border-green-700/30 hover:bg-green-700/20 transition-colors text-xs font-medium"
                        >
                          Receive
                        </button>
                      )}
                      {shipment.trackingNumber && (
                        <button
                          onClick={() => handleCopyTracking(String(shipment.trackingNumber))}
                          className="text-blue-400 hover:text-blue-300 ml-2 px-3 py-1 rounded-lg border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-xs font-medium"
                        >
                          Track
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => openEditShipmentModal(shipment)}
                            className="text-yellow-400 hover:text-yellow-300 ml-2 px-3 py-1 rounded-lg border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteShipment(String(shipment.id), String(shipment.poNumber ?? ''))}
                            className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-lg border border-red-700/30 hover:bg-red-700/20 transition-colors text-xs font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expandedRows[String(shipment.id ?? '')] && (
                    <tr className="bg-slate-900/40">
                      <td className="px-4 py-4"></td>
                      <td colSpan={6} className="px-6 py-4 text-sm text-slate-300">
                        <p className="text-xs text-slate-500 mb-3">
                          Added:{' '}
                          {shipment.created
                            ? formatLocalDateTime(shipment.created)
                            : 'N/A'}
                        </p>
                        <div className="mb-3">
                          <p className="font-semibold text-cyan-300 mb-1">Items</p>
                          {shipment.items && shipment.items.length > 0 ? (
                            <ul className="list-disc list-inside text-xs max-h-32 overflow-y-auto">
                              {shipment.items.map((item: InboundShipmentItem, itemIndex: number) => (
                                <li key={itemIndex}>
                                  {item.sku}: {item.quantity} {item.pushed ? '(Pushed)' : ''}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400">No items.</span>
                          )}
                        </div>

                        <div className="mb-3">
                          <p className="font-semibold text-cyan-300 mb-2">Checklist</p>
                          <div className="grid grid-cols-1 gap-2">
                            {CHECKLIST_ITEMS.filter(item => {
                              if (shipment.shipmentType !== 'Local Supplier') return true;
                              return !LOCAL_SUPPLIER_EXCLUDED_CHECKLIST.has(item.field);
                            }).map(item => {
                              const checked = Boolean(
                                shipment[item.field as keyof typeof shipment]
                              );
                              const cls = getChecklistItemClass(checked, item.color);
                              return (
                                <label
                                  key={item.field}
                                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${cls.card}${!canEdit ? ' opacity-50 pointer-events-none' : ' cursor-pointer'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      handleConfirmationToggle(
                                        String(shipment.id),
                                        item.field,
                                        checked,
                                        shipment.items || []
                                      )
                                    }
                                    className="hidden"
                                  />
                                  <div
                                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${cls.check}`}
                                  >
                                    {checked && (
                                      <i className="fas fa-check text-white text-xs" />
                                    )}
                                  </div>
                                  <i className={`${item.icon} ${cls.iconColor} w-4`} />
                                  <span
                                    className={`text-sm ${checked ? 'text-slate-200' : 'text-slate-400'}`}
                                  >
                                    {item.label}
                                  </span>
                                  {checked && (
                                    <i
                                      className={`fas fa-check-circle text-xs ml-auto ${cls.iconColor}`}
                                    />
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="font-semibold text-cyan-300 mb-1">Notes</p>
                          <p className="text-slate-400 whitespace-pre-wrap">
                            {shipment.notes || 'N/A'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
                  shipmentType: shipmentToEdit.shipmentType ?? 'Air Shipment',
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
