import { useState, useMemo } from 'react';
import { formatLocalDateTime } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useRMATracker } from '../hooks/useRMATracker';
import RMAEntryModal from '../components/modules/RMAEntryModal';
import RefurbishedPromotionModal from '../components/inventory/RefurbishedPromotionModal';
import type { RMAEntry } from '../types/rma';

function RMATrackerView() {
  // Get user roles for permission checks
  const { userRoles } = useAuth();
  // Message box and toast for user feedback
  const { showMessageBox, showToast } = useMessageBox();
  // RMA tracker hook for data and actions
  const {
    rmaEntries,
    loading: loadingRMA,
    addRMAEntry,
    updateRMAEntry,
    updateRMAStatus,
    deleteRMAEntry,
  } = useRMATracker();

  // Modal and state management
  const [showRMAEntryModal, setShowRMAEntryModal] = useState(false);
  const [isAddingRMA, setIsAddingRMA] = useState(false);
  const [rmaToEdit, setRmaToEdit] = useState<RMAEntry | null>(null);
  const [showEditRMAEntryModal, setShowEditRMAEntryModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const [entryToPromote, setEntryToPromote] = useState<RMAEntry | null>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof RMAEntry>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  /**
   * Status options for RMA entries
   */
  const statusOptions = ['Incoming', 'Processing', 'Testing', 'Outgoing', 'Received', 'Completed'];

  /**
   * Permission checks for editing and deleting
   */
  const canEdit = userRoles?.['RMA Tracker'] === 'Editor';
  const canDelete = userRoles?.['RMA Tracker'] === 'Editor';

  /**
   * Sort all entries based on sortColumn / sortDirection
   */
  const sortedEntries = useMemo(() => {
    return [...rmaEntries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [rmaEntries, sortColumn, sortDirection]);

  /**
   * Split RMAs into active and completed groups
   */
  const { activeRmas, completedRmas } = useMemo(() => {
    const active: RMAEntry[] = [];
    const completed: RMAEntry[] = [];
    sortedEntries.forEach((rma: RMAEntry) => {
      if (rma.status === 'Completed') {
        completed.push(rma);
      } else {
        active.push(rma);
      }
    });
    return { activeRmas: active, completedRmas: completed };
  }, [sortedEntries]);

  // Handles adding a new RMA entry from the RMAEntryModal
  const handleAddRMAEntry = async (entryData: Partial<RMAEntry>) => {
    /**
     * Handles adding a new RMA entry from the modal
     */
    if (!canEdit) {
      showToast('Permission denied. You do not have access to add RMA entries.', 'error');
      return;
    }
    if (!entryData.customerName || !entryData.orderNumber || !entryData.trackingNumber) {
      showToast('Please fill in Customer Name, Order Number, and Tracking Number.', 'error');
      return;
    }

    setIsAddingRMA(true);
    setShowRMAEntryModal(false);
    try {
      await addRMAEntry(entryData);
      showToast('RMA entry added successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error adding RMA entry: ', e);
      const msg = (e as { message?: string }).message ?? 'Failed to add RMA entry.';
      showToast(msg, 'error');
    } finally {
      setIsAddingRMA(false);
    }
  };

  // NEW: Handles updating an existing RMA entry
  const handleUpdateRMAEntry = async (updatedData: Partial<RMAEntry>) => {
    /**
     * Handles updating an existing RMA entry
     */
    if (!canEdit) {
      showToast('Permission denied. You do not have access to update RMA entries.', 'error');
      return;
    }
    if (!updatedData.id) {
      showToast('Error: No ID provided for RMA update.', 'error');
      return;
    }
    if (!updatedData.customerName || !updatedData.orderNumber || !updatedData.trackingNumber) {
      showToast('Please fill in Customer Name, Order Number, and Tracking Number.', 'error');
      return;
    }

    setIsAddingRMA(true); // Re-using this for loading state
    setShowEditRMAEntryModal(false); // Close modal immediately
    setRmaToEdit(null); // Clear item being edited
    try {
      // Remove id from the data to be updated
      const { id, ...dataToUpdate } = updatedData;
      if (!id) {
        showToast('Missing RMA id; cannot update.', 'error');
        return;
      }
      await updateRMAEntry(id, dataToUpdate);
      showToast('RMA entry updated successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error updating RMA entry: ', e);
      const msg = (e as { message?: string }).message ?? 'Failed to update RMA entry.';
      showToast(msg, 'error');
    } finally {
      setIsAddingRMA(false);
    }
  };

  // Handles changing the status of an existing RMA entry (separate from full edit)
  const handleStatusChange = async (id: string, newStatus: string) => {
    /**
     * Handles changing the status of an RMA entry
     */
    if (!canEdit) {
      showToast('Permission denied. You do not have access to change RMA status.', 'error');
      return;
    }

    if (newStatus === 'Completed') {
      const entry = rmaEntries.find(e => e.id === id);
      if (entry) {
        setEntryToPromote({ ...entry, status: 'Completed' });
        setPendingCompleteId(id);
        setShowPromoteModal(true);
      }
      return;
    }

    try {
      await updateRMAStatus(id, newStatus);
      showToast('RMA status updated!', 'success');
    } catch (e) {
      console.error('Error updating RMA status:', e);
      showToast('Failed to update RMA status.', 'error');
    }
  };

  const getStatusRowClass = (status?: string) => {
    /**
     * Returns Tailwind classes for row background based on RMA status
     */
    switch (status) {
      case 'Incoming':
        return 'bg-yellow-900/20 hover:bg-yellow-900/30';
      case 'Processing':
        return 'bg-purple-900/20 hover:bg-purple-900/30';
      case 'Testing':
        return 'bg-indigo-900/20 hover:bg-indigo-900/30';
      case 'Outgoing':
        return 'bg-cyan-900/20 hover:bg-cyan-900/30';
      case 'Completed':
        return 'bg-emerald-900/20 hover:bg-emerald-900/30';
      case 'Received':
      default:
        return 'hover:bg-slate-700'; // Default hover for 'Received' and any other status
    }
  };

  // --- Carrier Detection and Tracking Logic ---
  const detectCarrier = (trackingNumber: string) => {
    /**
     * Detects carrier from tracking number
     */
    if (/^1Z[0-9A-Z]{16}$/i.test(trackingNumber)) return 'UPS';
    if (/^9[0-9]{20,21}$/.test(trackingNumber) || /^94[0-9]{20}$/.test(trackingNumber))
      return 'USPS';
    if (/^[0-9]{12}$/.test(trackingNumber) || /^[0-9]{15}$/.test(trackingNumber)) return 'FedEx';
    if (/^[0-9]{10}$/.test(trackingNumber)) return 'DHL';
    return 'DHL'; // Default to DHL if no other carrier is detected
  };

  const getCarrierIcon = (carrier: string) => {
    /**
     * Returns FontAwesome icon for carrier
     */
    switch (carrier) {
      case 'UPS':
        return <i className="fas fa-box-open text-yellow-500 ml-2" title="UPS"></i>;
      case 'FedEx':
        return <i className="fas fa-shipping-fast text-purple-500 ml-2" title="FedEx"></i>;
      case 'USPS':
        return <i className="fas fa-mail-bulk text-blue-500 ml-2" title="USPS"></i>;
      case 'DHL':
        return <i className="fas fa-globe-americas text-red-500 ml-2" title="DHL"></i>;
      default:
        return null;
    }
  };

  const openTrackingPage = (trackingNumber: string) => {
    /**
     * Opens carrier tracking page in a new tab
     */
    const carrier = detectCarrier(trackingNumber);
    let url;

    switch (carrier) {
      case 'UPS':
        url = `https://www.ups.com/track?tracknum=${trackingNumber}`;
        break;
      case 'FedEx':
        url = `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`;
        break;
      case 'USPS':
        url = `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
        break;
      case 'DHL':
        url = `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
        break;
      default:
        url = `https://www.google.com/search?q=track+package+${trackingNumber}`;
    }
    window.open(url, '_blank');
  };

  // Handles deleting an RMA entry
  const handleDeleteRMAEntry = async (id: string) => {
    /**
     * Handles deleting an RMA entry
     */
    if (!canDelete) {
      showToast('Permission denied. You do not have permission to delete RMA entries.', 'error');
      return;
    }
    const confirmed = await showMessageBox(
      'Confirm Delete',
      'Are you sure you want to delete this RMA entry? This action cannot be undone.',
      true
    );
    if (!confirmed) return;

    try {
      await deleteRMAEntry(id);
      showToast('RMA entry deleted successfully!', 'success');
    } catch (e) {
      console.error('Error deleting RMA entry:', e);
      showToast('Failed to delete RMA entry.', 'error');
    }
  };

  // Function to open the Edit RMA Modal
  const openEditRMAEntryModal = (entry: RMAEntry) => {
    /**
     * Opens the Edit RMA modal
     */
    setRmaToEdit(entry);
    setShowEditRMAEntryModal(true);
  };
  const closeEditRMAEntryModal = () => {
    /**
     * Closes the Edit RMA modal
     */
    setShowEditRMAEntryModal(false);
    setRmaToEdit(null);
  };

  // Reusable function to render a single RMA row
  const renderRmaRow = (rma: RMAEntry) => (
    /**
     * Renders a single RMA table row
     */
    <>
      <td
        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200 cursor-help"
        title={`Entered: ${rma.created ? formatLocalDateTime(rma.created) : 'N/A'}`}
      >
        {rma.ticketNumber || 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-200">
        {rma.customerName}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{rma.orderNumber}</td>
      <td className="px-6 py-4 whitespace-pre-wrap text-sm text-slate-400">{rma.device}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 flex items-center">
        {rma.trackingNumber || 'N/A'}
        {rma.trackingNumber && getCarrierIcon(detectCarrier(rma.trackingNumber))}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <select
          value={rma.status}
          onChange={e => {
            if (rma.id) handleStatusChange(rma.id, e.target.value);
          }}
          disabled={!canEdit}
          className="block w-full rounded-md border-slate-600 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 text-sm py-1 bg-slate-900 text-slate-100"
        >
          {statusOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {rma.trackingNumber && (
          <button
            onClick={() => openTrackingPage(rma.trackingNumber)}
            className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded-lg border border-blue-700/30 hover:bg-blue-700/20 transition-colors text-sm font-medium"
          >
            Track
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => openEditRMAEntryModal(rma)}
            className="text-yellow-400 hover:text-yellow-300 ml-2 px-3 py-1 rounded-lg border border-yellow-700/30 hover:bg-yellow-700/20 transition-colors text-sm font-medium"
          >
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => {
              if (rma.id) handleDeleteRMAEntry(rma.id);
            }}
            className="text-red-400 hover:text-red-300 ml-2 px-3 py-1 rounded-lg border border-red-700/30 hover:bg-red-700/20 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        )}
      </td>
    </>
  );

  if (loadingRMA) {
    return <LoadingSpinner />;
  }

  return (
    <section className="bg-slate-900 p-8 rounded-2xl shadow-2xl mb-10 mx-auto w-full text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-4">RMA / Return Tracking (AIDA)</h2>
      {canEdit && (
        <button
          onClick={() => setShowRMAEntryModal(true)}
          disabled={isAddingRMA}
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-bold rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {isAddingRMA ? 'Adding Inbound...' : 'New Inbound (RMA/Return)'}
        </button>
      )}

      <h3 className="text-xl font-semibold text-cyan-300 mb-4">Active RMAs</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700 rounded-xl overflow-hidden">
          <thead className="bg-slate-700">
            <tr className="rounded-t-xl">
              {(
                [
                  { label: 'RMA No.', col: 'ticketNumber' },
                  { label: 'Customer Name', col: 'customerName' },
                  { label: 'Order No.', col: 'orderNumber' },
                  { label: 'Device(s)', col: 'device' },
                  { label: 'Tracking No.', col: 'trackingNumber' },
                  { label: 'Status', col: 'status' },
                ] as { label: string; col: keyof RMAEntry }[]
              ).map(({ label, col }) => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200"
                  onClick={() => {
                    if (sortColumn === col) {
                      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    } else {
                      setSortColumn(col);
                      setSortDirection('asc');
                    }
                  }}
                >
                  {label}
                  {sortColumn === col ? (
                    <span className="text-cyan-400 ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  ) : (
                    <span className="text-slate-600 ml-1">↕</span>
                  )}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {activeRmas.map((rma, idx) => (
              <tr
                key={rma.id}
                className={
                  getStatusRowClass(rma.status) +
                  (idx % 2 === 0 ? ' bg-slate-800' : ' bg-slate-700') +
                  ' transition-colors'
                }
              >
                {renderRmaRow(rma)}
              </tr>
            ))}
          </tbody>
        </table>
        {activeRmas.length === 0 && (
          <p className="text-slate-400 text-center py-4">No active RMAs.</p>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl shadow-2xl border border-blue-900 bg-slate-900 mt-8">
        {/* Table and modal rendering code here */}
      </div>

      {/* Completed RMAs Section */}
      <div className="mt-8 border-t border-slate-700 pt-6">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="w-full flex justify-between items-center text-left p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <h3 className="text-xl font-semibold text-cyan-300">
            Completed RMAs ({completedRmas.length})
          </h3>
          <i
            className={`fas fa-chevron-down transition-transform duration-300 ${
              showCompleted ? 'rotate-180' : ''
            }`}
          ></i>
        </button>
        {showCompleted && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  {(
                    [
                      { label: 'RMA No.', col: 'ticketNumber' },
                      { label: 'Customer Name', col: 'customerName' },
                      { label: 'Order No.', col: 'orderNumber' },
                      { label: 'Device(s)', col: 'device' },
                      { label: 'Tracking No.', col: 'trackingNumber' },
                      { label: 'Status', col: 'status' },
                    ] as { label: string; col: keyof RMAEntry }[]
                  ).map(({ label, col }) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200"
                      onClick={() => {
                        if (sortColumn === col) {
                          setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setSortColumn(col);
                          setSortDirection('asc');
                        }
                      }}
                    >
                      {label}
                      {sortColumn === col ? (
                        <span className="text-cyan-400 ml-1">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : (
                        <span className="text-slate-600 ml-1">↕</span>
                      )}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {completedRmas.map((rma, idx) => (
                  <tr
                    key={rma.id}
                    className={
                      getStatusRowClass(rma.status) +
                      (idx % 2 === 0 ? ' bg-slate-800' : ' bg-slate-700') +
                      ' transition-colors'
                    }
                  >
                    {renderRmaRow(rma)}
                  </tr>
                ))}
              </tbody>
            </table>
            {completedRmas.length === 0 && (
              <p className="text-slate-400 text-center py-4">No completed RMAs.</p>
            )}
          </div>
        )}
      </div>

      {/* Modal for adding new RMA entries */}
      <RMAEntryModal
        isOpen={showRMAEntryModal}
        onClose={() => setShowRMAEntryModal(false)}
        onSubmit={handleAddRMAEntry}
        isSubmitting={isAddingRMA}
        canEdit={canEdit}
        initialData={null} // No initial data for add mode
      />

      {/* Modal for editing existing RMA entries */}
      {rmaToEdit && (
        <RMAEntryModal
          isOpen={showEditRMAEntryModal}
          onClose={closeEditRMAEntryModal}
          onSubmit={handleUpdateRMAEntry}
          isSubmitting={isAddingRMA}
          canEdit={canEdit}
          initialData={rmaToEdit} // Pass the data of the entry being edited
        />
      )}

      <RefurbishedPromotionModal
        isOpen={showPromoteModal}
        onClose={() => {
          setPendingCompleteId(null);
          setShowPromoteModal(false);
          setEntryToPromote(null);
          showToast('Promotion cancelled — status unchanged.', 'info');
        }}
        onSuccess={async () => {
          if (pendingCompleteId) {
            try {
              await updateRMAStatus(pendingCompleteId, 'Completed');
              showToast('RMA marked as Completed.', 'success');
            } catch (e) {
              console.error('Error completing RMA:', e);
            }
            setPendingCompleteId(null);
          }
          setShowPromoteModal(false);
          setEntryToPromote(null);
        }}
        rmaEntry={entryToPromote}
      />
    </section>
  );
}

export default RMATrackerView;
