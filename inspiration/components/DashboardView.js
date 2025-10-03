// src/components/DashboardView.js

import React from 'react';
import { useInventoryContext } from '../context/InventoryContext'; // For Vaults inventory data
import { useComponentInventory } from '../hooks/useComponentInventory'; // For Components inventory data
import { useAmazonInventory } from '../hooks/useAmazonInventory'; // For Amazon data
import { useInboundShipments } from '../hooks/useInboundShipments'; // For inbound shipments data
import { useRMATracker } from '../hooks/useRMATracker'; // For RMA data
import { useMessageBox } from './MessageBox'; // For alerts
import LoadingSpinner from './LoadingSpinner'; // For loading indicator
import { useAuth } from '../context/AuthContext'; // For authentication state (canView)

const DashboardView = () => {
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

  const { currentUser } = useAuth();

  const loading =
    loadingInventory || loadingComponents || loadingInboundShipments || loadingAmazon || loadingRMA;
  const error = inventoryError || componentError || inboundError || amazonError || rmaError;

  // Derived data for the dashboard
  const totalVaults = inventory.length;
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
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p className="font-semibold mb-2">Error loading dashboard data:</p>
        <p>{error}</p>
        <p className="mt-2 text-sm">
          Please try refreshing the page or check your internet connection.
        </p>
      </div>
    );
  }

  return (
    <section className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 mx-auto w-full text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-tachometer-alt mr-2 text-emerald-400"></i>AIDA Dashboard
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
        <div className="bg-slate-700 p-5 rounded-lg shadow-md text-center">
          <p className="text-sm text-slate-400 uppercase">Total Vaults</p>
          <p className="text-4xl font-bold text-white mt-2">{totalVaults}</p>
        </div>
        <div className="bg-slate-700 p-5 rounded-lg shadow-md text-center">
          <p className="text-sm text-slate-400 uppercase">Total Components</p>
          <p className="text-4xl font-bold text-white mt-2">{totalComponents}</p>
        </div>
        <div className="bg-slate-700 p-5 rounded-lg shadow-md text-center">
          <p className="text-sm text-slate-400 uppercase">Amazon FBA On The Way</p>
          <p className="text-4xl font-bold text-white mt-2">{totalFBAOnTheWay}</p>
        </div>
        <div className="bg-slate-700 p-5 rounded-lg shadow-md text-center">
          <p className="text-sm text-slate-400 uppercase">Inbound Shipments (In Transit)</p>
          <p className="text-4xl font-bold text-white mt-2">{inboundInTransitCount}</p>
        </div>
        <div className="bg-slate-700 p-5 rounded-lg shadow-md text-center">
          <p className="text-sm text-slate-400 uppercase">RMA Incoming</p>
          <p className="text-4xl font-bold text-white mt-2">{rmaIncomingCount}</p>
        </div>
      </div>
    </section>
  );
};

export default DashboardView;
