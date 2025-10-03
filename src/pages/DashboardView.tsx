import { useInventoryContext } from '../context/InventoryContext';
import { useComponentInventory } from '../hooks/useComponentInventory';
import { useAmazonInventory } from '../hooks/useAmazonInventory';
import { useInboundShipments } from '../hooks/useInboundShipments';
import { useRMATracker } from '../hooks/useRMATracker';
import LoadingSpinner from '../components/common/LoadingSpinner';

function DashboardView() {
  const { inventory, loading: loadingInventory, error: inventoryError } = useInventoryContext();
  const {
    componentInventory,
    loading: loadingComponents,
    componentError,
  } = useComponentInventory();
  const { amazonInventory, loading: loadingAmazon, error: amazonError } = useAmazonInventory();
  const {
    inboundShipments,
    loading: loadingInboundShipments,
    error: inboundError,
  } = useInboundShipments();
  const { rmaEntries, loading: loadingRMA, rmaError } = useRMATracker();

  const loading =
    loadingInventory || loadingComponents || loadingInboundShipments || loadingAmazon || loadingRMA;
  const error = inventoryError || componentError || inboundError || amazonError || rmaError;

  // Derived data for the dashboard
  const totalDevices = inventory.length;
  const totalComponents = componentInventory.length;
  const totalFBAOnTheWay = amazonInventory.reduce((total, item) => {
    return (
      total +
      (item.amazonFBA_Base_OnTheWayQuantity || 0) +
      (item.amazonFBA_250_OnTheWayQuantity || 0) +
      (item.amazonFBA_500_OnTheWayQuantity || 0)
    );
  }, 0);
  const inboundInTransitCount = inboundShipments.filter(
    s =>
      s.status === 'In Transit' ||
      s.status === 'Arrived at Customs' ||
      s.status === 'Out for Delivery'
  ).length;
  const rmaIncomingCount = rmaEntries.filter(rma => rma.status === 'Incoming').length;

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-lg shadow text-center">
        <p className="font-semibold mb-2">Error loading dashboard data:</p>
        <p>{error}</p>
        <p className="mt-2 text-sm">
          Please try refreshing the page or check your internet connection.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      <div className="bg-slate-900 rounded-xl shadow-2xl p-8 flex flex-col items-center border border-blue-900">
        <span className="text-4xl font-extrabold text-blue-400 mb-2 drop-shadow">
          {totalDevices}
        </span>
        <span className="text-lg text-slate-200">Devices</span>
      </div>
      <div className="bg-slate-900 rounded-xl shadow-2xl p-8 flex flex-col items-center border border-green-900">
        <span className="text-4xl font-extrabold text-green-400 mb-2 drop-shadow">
          {totalComponents}
        </span>
        <span className="text-lg text-slate-200">Components</span>
      </div>
      <div className="bg-slate-900 rounded-xl shadow-2xl p-8 flex flex-col items-center border border-yellow-900">
        <span className="text-4xl font-extrabold text-yellow-400 mb-2 drop-shadow">
          {totalFBAOnTheWay}
        </span>
        <span className="text-lg text-slate-200">FBA On The Way</span>
      </div>
      <div className="bg-slate-900 rounded-xl shadow-2xl p-8 flex flex-col items-center border border-purple-900">
        <span className="text-4xl font-extrabold text-purple-400 mb-2 drop-shadow">
          {inboundInTransitCount}
        </span>
        <span className="text-lg text-slate-200">Inbound In Transit</span>
      </div>
      <div className="bg-slate-900 rounded-xl shadow-2xl p-8 flex flex-col items-center border border-pink-900">
        <span className="text-4xl font-extrabold text-pink-400 mb-2 drop-shadow">
          {rmaIncomingCount}
        </span>
        <span className="text-lg text-slate-200">RMA Incoming</span>
      </div>
    </div>
  );
}

export default DashboardView;
