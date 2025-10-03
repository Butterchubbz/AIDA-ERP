import { useInventory } from '../hooks/useInventory';
import { useShipments } from '../hooks/useShipments';
import { useRMAs } from '../hooks/useRMAs';

const Dashboard = () => {
  const { inventory, loading: loadingInventory, error: errorInventory } = useInventory();
  const { shipments, loading: loadingShipments, error: errorShipments } = useShipments();
  const { rmas, loading: loadingRMAs, error: errorRMAs } = useRMAs();

  const loading = loadingInventory || loadingShipments || loadingRMAs;
  const error = errorInventory || errorShipments || errorRMAs;

  // Calculate summary statistics
  const totalInventoryItems = inventory.length;
  const totalShipments = shipments.length;
  const inTransitShipments = shipments.filter(
    s =>
      s.status === 'In Transit' ||
      s.status === 'Arrived at Customs' ||
      s.status === 'Out for Delivery'
  ).length;
  const incomingRMAs = rmas.filter(r => r.status === 'Incoming').length;

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-cyan-400 mb-6">Dashboard</h1>
        <p className="text-slate-400 text-center py-8">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-cyan-400 mb-6">Dashboard</h1>
        <p className="text-red-500 text-center py-8">Error loading dashboard data: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-cyan-400 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg text-center">
          <p className="text-sm text-slate-400 uppercase">Total Inventory Items</p>
          <p className="text-4xl font-bold text-white mt-2">{totalInventoryItems}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg text-center">
          <p className="text-sm text-slate-400 uppercase">Total Shipments</p>
          <p className="text-4xl font-bold text-white mt-2">{totalShipments}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg text-center">
          <p className="text-sm text-slate-400 uppercase">In-Transit Shipments</p>
          <p className="text-4xl font-bold text-white mt-2">{inTransitShipments}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg text-center">
          <p className="text-sm text-slate-400 uppercase">Incoming RMAs</p>
          <p className="text-4xl font-bold text-white mt-2">{incomingRMAs}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
