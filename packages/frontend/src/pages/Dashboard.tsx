import { useMemo } from 'react';
import { useDeviceInventory } from '../hooks/useInventoryModules';
import { useShipments } from '../hooks/useShippingModules';
import { useRMAs } from '../hooks/useRMAs';
import { useForecasting } from '../hooks/useForecasting';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { baseTooltipStyle, chartPalette } from '../components/common/chartConfig';

const Dashboard = () => {
  const { devices: inventory, loading: loadingInventory, error: errorInventory } = useDeviceInventory();
  const { shipments, loading: loadingShipments, error: errorShipments } = useShipments();
  const { rmas, loading: loadingRMAs, error: errorRMAs } = useRMAs();
  const { forecastItems: deviceForecast, loading: loadingDeviceForecast } = useForecasting({ mode: 'device' });
  const { forecastItems: componentForecast, loading: loadingComponentForecast } = useForecasting({ mode: 'component' });

  const loading =
    loadingInventory ||
    loadingShipments ||
    loadingRMAs ||
    loadingDeviceForecast ||
    loadingComponentForecast;
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

  const forecastMerged = useMemo(() => [...deviceForecast, ...componentForecast], [componentForecast, deviceForecast]);
  const criticalForecast = useMemo(
    () => forecastMerged.filter(item => item.status === 'CRITICAL').length,
    [forecastMerged]
  );
  const warningForecast = useMemo(
    () => forecastMerged.filter(item => item.status === 'WARNING').length,
    [forecastMerged]
  );
  const avgVelocity = useMemo(
    () =>
      forecastMerged.length > 0
        ? forecastMerged.reduce((sum, item) => sum + item.velocityPerWeek, 0) / forecastMerged.length
        : 0,
    [forecastMerged]
  );

  const sparklineData = useMemo(
    () =>
      forecastMerged
        .slice(0, 12)
        .map(item => ({
          sku: item.sku,
          velocity: Number(item.velocityPerWeek.toFixed(2)),
        }))
        .sort((a, b) => b.velocity - a.velocity),
    [forecastMerged]
  );

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

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-semibold text-cyan-300">Forecast Summary</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>Total forecasted SKUs: <span className="text-white font-semibold">{forecastMerged.length}</span></p>
            <p>Critical reorder now: <span className="text-red-300 font-semibold">{criticalForecast}</span></p>
            <p>Warning within 2 weeks: <span className="text-amber-300 font-semibold">{warningForecast}</span></p>
            <p>Average velocity/week: <span className="text-cyan-300 font-semibold">{avgVelocity.toFixed(1)}</span></p>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-semibold text-cyan-300 mb-3">Velocity Sparkline</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Tooltip
                  contentStyle={baseTooltipStyle}
                  formatter={(value: number) => [`${value}`, 'Velocity']}
                />
                <Line type="monotone" dataKey="velocity" stroke={chartPalette.primary} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
