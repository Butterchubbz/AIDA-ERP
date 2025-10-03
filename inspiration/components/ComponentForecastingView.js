// src/components/ComponentForecastingView.js

import React, { useState, useMemo } from 'react'; // Removed useEffect as it's not strictly needed for this component's direct logic
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useComponentInventory } from '../hooks/useComponentInventory'; // To fetch component inventory and history
import { useMessageBox } from './MessageBox';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext'; // For authentication check
import { db } from '../firebaseConfig';
import { simpleLinearRegression } from '../utils/forecasting'; // Import from shared utility

// --- ComponentForecastingView Component ---
function ComponentForecastingView() {
  const { componentInventory, loadingComponents, componentError } = useComponentInventory();
  const { currentUser, loadingAuth, appId } = useAuth();
  const { showToast } = useMessageBox();

  const [selectedForecastComponent, setSelectedForecastComponent] = useState(null);
  const [forecastAnalysis, setForecastAnalysis] = useState(null);
  const [forecastWeeks, setForecastWeeks] = useState(8); // Default to forecast next 8 weeks
  const [historyWeeksForForecast, setHistoryWeeksForForecast] = useState(8); // Default to use past 8 weeks

  // States for re-order point calculation
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(4);
  const [safetyStockWeeks, setSafetyStockWeeks] = useState(2);
  const [reorderMethod, setReorderMethod] = useState('calculated'); // 'calculated' or 'manual'
  const [manualReorderPoint, setManualReorderPoint] = useState(100);
  const [isForecasting, setIsForecasting] = useState(false);

  // Permissions
  const canView = !!currentUser;

  // Memoized list of components for the dropdown
  const componentOptions = useMemo(() => {
    return componentInventory.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      countedStock: item.countedStock, // Use countedStock for forecasting calculation
    }));
  }, [componentInventory]);

  // Forecasting Logic
  const handleForecastComponent = async () => {
    if (!canView) {
      showToast('Permission denied. You must be logged in to use this tool.', 'error');
      return;
    }

    if (!selectedForecastComponent) {
      showToast('Please select a component to forecast.', 'error');
      return;
    }

    setIsForecasting(true);
    setForecastAnalysis(null); // Clear previous analysis

    try {
      // Fetch sales data from the 'salesData' collection
      const salesCollectionRef = collection(db, `artifacts/${appId}/salesData`);
      const q = query(
        salesCollectionRef,
        where('sku', '==', selectedForecastComponent.sku),
        orderBy('year'),
        orderBy('week')
      );
      const querySnapshot = await getDocs(q);

      let salesRecords = querySnapshot.docs.map(doc => doc.data());

      // Use the last N weeks of history for the forecast calculation
      salesRecords = salesRecords.slice(-historyWeeksForForecast);

      if (salesRecords.length < 2) {
        showToast(
          'Not enough sales data to forecast. Need at least 2 weeks of sales records.',
          'error'
        );
        setForecastAnalysis(null);
        return;
      }

      // The data is already sales data.
      const salesData = salesRecords.map((record, index) => ({
        week: index, // Use simple index for regression
        weekLabel: `Y${record.year}-W${record.week}`,
        sales: record.netSales,
      }));

      if (salesData.length < 2) {
        showToast('Not enough sales data to forecast. Need at least 2 sales periods.', 'error');
        setForecastAnalysis(null);
        return;
      }

      const y_values = salesData.map(d => d.sales);
      const x_values = salesData.map(d => d.week);

      const { slope, intercept } = simpleLinearRegression(y_values, x_values);

      const lastHistoricalWeekIndex = salesData[salesData.length - 1].week;
      const combinedChartData = salesData.map(d => ({
        weekLabel: d.weekLabel,
        Sales: d.sales,
      }));

      let cumulativeForecastSales = 0;
      const lastRecord = salesRecords[salesRecords.length - 1];
      let lastYear = lastRecord.year;
      let lastWeek = lastRecord.week;

      for (let i = 1; i <= forecastWeeks; i++) {
        const next_week_index = lastHistoricalWeekIndex + i;
        const predictedSales = Math.max(0, Math.round(slope * next_week_index + intercept));
        cumulativeForecastSales += predictedSales;

        // Calculate the next week's label
        lastWeek++;
        if (lastWeek > 52) {
          lastWeek = 1;
          lastYear++;
        }

        combinedChartData.push({
          weekLabel: `Forecast Y${lastYear}-W${lastWeek}`,
          Forecast: predictedSales,
        });
      }

      const avgWeeklySales = forecastWeeks > 0 ? cumulativeForecastSales / forecastWeeks : 0;

      let reorderPoint;
      if (reorderMethod === 'calculated') {
        reorderPoint = Math.round(
          avgWeeklySales * leadTimeWeeks + avgWeeklySales * safetyStockWeeks
        );
      } else {
        reorderPoint = manualReorderPoint;
      }

      const recommendedOrderQty = Math.max(
        0,
        reorderPoint - (selectedForecastComponent.countedStock || 0)
      );

      setForecastAnalysis({
        product: selectedForecastComponent.name,
        chartData: combinedChartData,
        avgWeeklySales: avgWeeklySales.toFixed(2),
        reorderPoint,
        currentStock: selectedForecastComponent.countedStock || 0,
        recommendedOrderQty,
      });
      showToast('Forecast generated successfully!', 'success');
    } catch (e) {
      console.error('Error generating forecast:', e);
      if (e.code === 'failed-precondition') {
        showToast(
          'A Firestore index is required for this query. Check the browser console for a link to create it.',
          'error',
          10000
        );
      } else {
        showToast('Failed to generate forecast: ' + e.message, 'error');
      }
      setForecastAnalysis(null);
    } finally {
      setIsForecasting(false);
    }
  };

  if (loadingAuth || loadingComponents) {
    return <LoadingSpinner />;
  }

  if (componentError) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p className="font-semibold mb-2">Error loading component data for forecasting:</p>
        <p>{componentError}</p>
        <p className="mt-2 text-sm">
          Please try refreshing the page or check your internet connection.
        </p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-800 rounded-lg shadow-xl text-slate-200 text-lg">
        <i className="fas fa-user-lock text-6xl text-blue-500 mb-4"></i>
        <h2 className="text-2xl font-semibold mb-2">Access Denied (AIDA)</h2>
        <p className="text-center">Please sign in to use the Component Forecasting tool.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-microchip text-blue-400 mr-2"></i>Component Sales Forecasting
      </h2>
      <p className="text-slate-400 mb-4">
        Select a component to view its sales history and forecast future needs.
      </p>

      <div className="mb-6">
        <label
          htmlFor="forecast-component-select"
          className="block text-slate-300 mb-2 font-medium"
        >
          Select Component for Forecast
        </label>
        <select
          id="forecast-component-select"
          value={selectedForecastComponent?.id || ''}
          onChange={e => {
            const item = componentInventory.find(i => i.id === e.target.value);
            setSelectedForecastComponent(item);
            setForecastAnalysis(null); // Clear previous forecast when item changes
          }}
          className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
          aria-label="Select component for forecast"
        >
          <option value="" disabled>
            -- Select a Component --
          </option>
          {componentOptions.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.sku})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="forecast-weeks-input" className="block text-slate-300 mb-2 font-medium">
            Forecast Next (Weeks)
          </label>
          <input
            type="number"
            id="forecast-weeks-input"
            value={forecastWeeks}
            onChange={e => setForecastWeeks(parseInt(e.target.value, 10) || 1)}
            min="1"
            className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
          />
        </div>
        <div>
          <label htmlFor="history-weeks-input" className="block text-slate-300 mb-2 font-medium">
            Use Past (Weeks of History)
          </label>
          <input
            type="number"
            id="history-weeks-input"
            value={historyWeeksForForecast}
            onChange={e => setHistoryWeeksForForecast(parseInt(e.target.value, 10) || 1)}
            min="1"
            className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
          />
        </div>
      </div>

      {/* Re-Order Point Parameters */}
      <div className="mt-6 border-t border-slate-700 pt-6">
        <h3 className="text-lg font-semibold text-slate-300 mb-4">Re-Order Point Parameters</h3>
        <div className="bg-slate-700/50 p-4 rounded-lg">
          <span className="block text-slate-300 mb-3 font-medium">Re-Order Point Method</span>
          <div className="flex space-x-4 mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="reorderMethodComponent"
                value="calculated"
                checked={reorderMethod === 'calculated'}
                onChange={() => setReorderMethod('calculated')}
                className="form-radio bg-slate-600 text-cyan-500"
              />
              <span className="text-slate-200">Calculate Automatically</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="reorderMethodComponent"
                value="manual"
                checked={reorderMethod === 'manual'}
                onChange={() => setReorderMethod('manual')}
                className="form-radio bg-slate-600 text-cyan-500"
              />
              <span className="text-slate-200">Set Manually</span>
            </label>
          </div>

          {reorderMethod === 'calculated' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lead-time-weeks-input-comp"
                  className="block text-slate-300 mb-2 font-medium"
                >
                  Supplier Lead Time (Weeks)
                </label>
                <input
                  type="number"
                  id="lead-time-weeks-input-comp"
                  value={leadTimeWeeks}
                  onChange={e => setLeadTimeWeeks(parseInt(e.target.value, 10) || 0)}
                  min="0"
                  className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="safety-stock-weeks-input-comp"
                  className="block text-slate-300 mb-2 font-medium"
                >
                  Safety Stock (Weeks of Sales)
                </label>
                <input
                  type="number"
                  id="safety-stock-weeks-input-comp"
                  value={safetyStockWeeks}
                  onChange={e => setSafetyStockWeeks(parseInt(e.target.value, 10) || 0)}
                  min="0"
                  className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
                />
              </div>
            </div>
          )}

          {reorderMethod === 'manual' && (
            <div>
              <label
                htmlFor="manual-reorder-point-input-comp"
                className="block text-slate-300 mb-2 font-medium"
              >
                Manual Re-Order Point (Units)
              </label>
              <input
                type="number"
                id="manual-reorder-point-input-comp"
                value={manualReorderPoint}
                onChange={e => setManualReorderPoint(parseInt(e.target.value, 10) || 0)}
                min="0"
                className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
              />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleForecastComponent}
        disabled={!selectedForecastComponent || isForecasting}
        className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/30 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isForecasting ? 'Generating Forecast...' : 'Generate Forecast'}
      </button>

      {forecastAnalysis && (
        <div className="mt-8 bg-slate-700 p-6 rounded-lg shadow-inner">
          <h3 className="text-xl font-semibold text-cyan-400 mb-4 border-b pb-2">
            Forecast for {forecastAnalysis.product}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
            <div className="bg-slate-600/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400">Avg. Weekly Sales (Forecast)</div>
              <div className="text-2xl font-bold text-cyan-400">
                {forecastAnalysis.avgWeeklySales}
              </div>
            </div>
            <div className="bg-slate-600/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400">Current Stock</div>
              <div className="text-2xl font-bold text-white">{forecastAnalysis.currentStock}</div>
            </div>
            <div className="bg-slate-600/50 p-4 rounded-lg">
              <div className="text-sm text-slate-400">Re-Order Point</div>
              <div className="text-2xl font-bold text-white">{forecastAnalysis.reorderPoint}</div>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-500 p-4 rounded-lg">
              <div className="text-sm text-emerald-300">Recommended Order</div>
              <div className="text-2xl font-bold text-emerald-400">
                {forecastAnalysis.recommendedOrderQty}
              </div>
            </div>
          </div>

          <h4 className="text-lg font-semibold mb-3 text-slate-200">
            {forecastAnalysis.product} - Sales History & Forecast
          </h4>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastAnalysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="weekLabel" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    borderColor: '#475569',
                    color: '#cbd5e1',
                  }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                <Line
                  type="monotone"
                  dataKey="Sales"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Forecast"
                  stroke="#67e8f9"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center text-slate-400 text-sm">
            Recommendation: Order{' '}
            <strong className="text-emerald-400">
              {forecastAnalysis.recommendedOrderQty} units
            </strong>{' '}
            of <strong className="text-white">{forecastAnalysis.product}</strong> to meet the
            re-order point of {forecastAnalysis.reorderPoint} units.
          </div>
        </div>
      )}
    </div>
  );
}

export default ComponentForecastingView;
