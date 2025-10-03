// src/components/VaultForecastingView.js

import React, { useState, useMemo, useEffect } from 'react';
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
import { useInventoryContext } from '../context/InventoryContext'; // To fetch main inventory and history
import { useMessageBox } from './MessageBox';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import { simpleLinearRegression } from '../utils/forecasting'; // Import from shared utility

// --- VaultForecastingView Component ---
function VaultForecastingView() {
  const { inventory, loading, error } = useInventoryContext();
  const { currentUser, loadingAuth, appId } = useAuth();
  const { showToast } = useMessageBox();

  const [selectedForecastItem, setSelectedForecastItem] = useState(null);
  const [forecastAnalysis, setForecastAnalysis] = useState(null);
  const [forecastWeeks, setForecastWeeks] = useState(12); // Default to forecast next 12 weeks
  const [historyWeeksForForecast, setHistoryWeeksForForecast] = useState(12); // Default to use past 12 weeks

  // States for re-order point calculation
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(9);
  const [safetyStockPercentage, setSafetyStockPercentage] = useState(0.15); // Default to 15% safety stock
  const [reorderMethod, setReorderMethod] = useState('calculated'); // 'calculated' or 'manual'
  const [manualReorderPoint, setManualReorderPoint] = useState(100);
  const [isForecasting, setIsForecasting] = useState(false);

  useEffect(() => {
    handleForecastItem();
  }, []); // Empty dependency array means this runs once on mount

  // Permissions
  const canView = !!currentUser;

  // Memoized list of inventory items for the dropdown
  const inventoryOptions = useMemo(() => {
    return inventory.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      wooStock: item.wooStock, // Need wooStock for forecasting calculation
    }));
  }, [inventory]);

  const colors = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300',
    '#0088fe',
    '#00c49f',
    '#ffbb28',
    '#a4de6c',
    '#d0ed57',
    '#83a6ed',
    '#8dd1e1',
    '#82ca9d',
    '#a4de6c',
    '#d0ed57',
    '#ffc658',
    '#ff7300',
    '#0088fe',
    '#00c49f',
    '#ffbb28',
    '#a4de6c',
  ];

  // Forecasting Logic
  const handleForecastItem = async () => {
    if (!canView) {
      showToast('Permission denied. You must be logged in to use this tool.', 'error');
      return;
    }

    setIsForecasting(true);
    setForecastAnalysis(null); // Clear previous analysis

    try {
      const salesCollectionRef = collection(db, `artifacts/${appId}/salesData`);
      let allSalesRecords = [];

      // Fetch all sales data for all SKUs
      const qAll = query(
        salesCollectionRef,
        orderBy('sku'), // Order by SKU first to group sales records
        orderBy('year'),
        orderBy('week')
      );
      const querySnapshotAll = await getDocs(qAll);
      allSalesRecords = querySnapshotAll.docs.map(doc => doc.data());

      const skusToForecast = selectedForecastItem
        ? [selectedForecastItem.sku]
        : inventory.map(item => item.sku);
      const forecastResults = {};
      let combinedChartData = [];
      let maxWeekIndex = 0;

      // Determine the latest week in the sales data to establish a consistent historical period
      let latestYear = 0;
      let latestWeek = 0;
      if (allSalesRecords.length > 0) {
        const lastRecord = allSalesRecords[allSalesRecords.length - 1];
        latestYear = lastRecord.year;
        latestWeek = lastRecord.week;
      } else {
        // If no sales data, use current date as a fallback for generating weeks
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        latestYear = now.getFullYear();
        latestWeek = Math.ceil((now - startOfYear) / 86400000 / 7); // Rough week number
      }

      for (const sku of skusToForecast) {
        const item = inventory.find(i => i.sku === sku);
        if (!item) continue; // Skip if SKU not found in inventory

        const salesRecordsForSku = allSalesRecords.filter(record => record.sku === sku);

        // Generate a complete set of weeks for the history period
        const historicalSalesMap = new Map();
        salesRecordsForSku.forEach(record => {
          historicalSalesMap.set(`${record.year}-${record.week}`, record.netSales);
        });

        const completeSalesData = [];
        let currentYear = latestYear;
        let currentWeek = latestWeek;

        for (let i = 0; i < historyWeeksForForecast; i++) {
          const weekKey = `${currentYear}-${currentWeek}`;
          const sales = historicalSalesMap.get(weekKey) || 0; // Use 0 for weeks with no sales data
          completeSalesData.unshift({ year: currentYear, week: currentWeek, netSales: sales });

          currentWeek--;
          if (currentWeek < 1) {
            currentWeek = 52;
            currentYear--;
          }
        }
        completeSalesData.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.week - b.week;
        });

        if (completeSalesData.length < 2) {
          console.warn(
            `Not enough sales data for SKU: ${sku} even after filling zero-sales weeks. Skipping forecast.`
          );
          continue;
        }

        const salesDataForRegression = completeSalesData.map((record, index) => ({
          week: index,
          weekLabel: `Y${record.year}-W${record.week}`,
          sales: record.netSales,
        }));

        const y_values = salesDataForRegression.map(d => d.sales);
        const x_values = salesDataForRegression.map(d => d.week);

        const { slope, intercept } = simpleLinearRegression(y_values, x_values);

        const lastHistoricalWeekIndex =
          salesDataForRegression[salesDataForRegression.length - 1].week;
        maxWeekIndex = Math.max(maxWeekIndex, lastHistoricalWeekIndex + forecastWeeks);

        let cumulativeForecastSales = 0;
        const lastRecord = completeSalesData[completeSalesData.length - 1];
        let lastYear = lastRecord.year;
        let lastWeek = lastRecord.week;

        const forecastDataForSku = [];
        for (let i = 1; i <= forecastWeeks; i++) {
          const next_week_index = lastHistoricalWeekIndex + i;
          const predictedSales = Math.max(0, Math.round(slope * next_week_index + intercept));
          cumulativeForecastSales += predictedSales;

          lastWeek++;
          if (lastWeek > 52) {
            lastWeek = 1;
            lastYear++;
          }
          forecastDataForSku.push({
            week: next_week_index,
            weekLabel: `Forecast Y${lastYear}-W${lastWeek}`,
            Forecast: predictedSales,
          });
        }

        const avgWeeklySales = forecastWeeks > 0 ? cumulativeForecastSales / forecastWeeks : 0;

        let reorderPoint;
        if (reorderMethod === 'calculated') {
          // Reorder Point = (Avg Weekly Sales * Lead Time) * (1 + Safety Stock Percentage)
          reorderPoint = Math.round(avgWeeklySales * leadTimeWeeks * (1 + safetyStockPercentage));
        } else {
          reorderPoint = manualReorderPoint;
        }

        const recommendedOrderQty = Math.max(0, reorderPoint - (item.wooStock || 0));

        forecastResults[sku] = {
          productName: item.name,
          sku: item.sku,
          salesData: salesDataForRegression,
          forecastData: forecastDataForSku,
          avgWeeklySales: avgWeeklySales.toFixed(2),
          reorderPoint,
          currentStock: item.wooStock || 0,
          recommendedOrderQty,
        };
      }

      // Combine chart data from all SKUs
      for (let i = 0; i <= maxWeekIndex; i++) {
        const weekData = { week: i };
        let weekLabel = '';

        for (const sku of skusToForecast) {
          const result = forecastResults[sku];
          if (result) {
            const salesRecord = result.salesData.find(d => d.week === i);
            const forecastRecord = result.forecastData.find(d => d.week === i);

            if (salesRecord) {
              weekData[`${sku} Sales`] = salesRecord.sales;
              weekLabel = salesRecord.weekLabel;
            }
            if (forecastRecord) {
              weekData[`${sku} Forecast`] = forecastRecord.Forecast;
              weekLabel = forecastRecord.weekLabel;
            }
          }
        }
        if (weekLabel) {
          // Ensure we only add weeks that have data
          weekData.weekLabel = weekLabel;
          combinedChartData.push(weekData);
        }
      }
      combinedChartData.sort((a, b) => a.week - b.week); // Ensure chronological order

      setForecastAnalysis({
        product: selectedForecastItem ? selectedForecastItem.name : 'All Vault SKUs',
        chartData: combinedChartData,
        individualSkuForecasts: forecastResults, // Store individual results
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

  if (loadingAuth || loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/20 p-4 rounded-md text-center">
        <p className="font-semibold mb-2">Error loading Vault SKU data for forecasting:</p>
        <p>{error}</p>
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
        <p className="text-center">Please sign in to use the Vault SKU Forecasting tool.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        <i className="fas fa-chart-line text-blue-400 mr-2"></i>Vault Sales Forecasting
      </h2>
      <p className="text-slate-400 mb-4">
        Select a Vault SKU to view its sales history and forecast future stock needs.
      </p>

      <div className="mb-6">
        <label htmlFor="forecast-item-select" className="block text-slate-300 mb-2 font-medium">
          Select Vault SKU for Forecast
        </label>
        <select
          id="forecast-item-select"
          value={selectedForecastItem?.id || ''}
          onChange={e => {
            const item = inventory.find(i => i.id === e.target.value);
            setSelectedForecastItem(item);
            setForecastAnalysis(null); // Clear previous forecast when item changes
          }}
          className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
          aria-label="Select item for forecast"
        >
          <option value="" disabled>
            -- Select a Vault SKU --
          </option>
          {inventoryOptions.map(item => (
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
                name="reorderMethodVault"
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
                name="reorderMethodVault"
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
                  htmlFor="lead-time-weeks-input"
                  className="block text-slate-300 mb-2 font-medium"
                >
                  Supplier Lead Time (Weeks)
                </label>
                <input
                  type="number"
                  id="lead-time-weeks-input"
                  value={leadTimeWeeks}
                  onChange={e => setLeadTimeWeeks(parseInt(e.target.value, 10) || 0)}
                  min="0"
                  className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="safety-stock-weeks-input"
                  className="block text-slate-300 mb-2 font-medium"
                >
                  Safety Stock (Percentage)
                </label>
                <input
                  type="number"
                  id="safety-stock-percentage-input"
                  value={safetyStockPercentage * 100}
                  onChange={e => setSafetyStockPercentage(parseFloat(e.target.value) / 100 || 0)}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
                />
              </div>
            </div>
          )}

          {reorderMethod === 'manual' && (
            <div>
              <label
                htmlFor="manual-reorder-point-input"
                className="block text-slate-300 mb-2 font-medium"
              >
                Manual Re-Order Point (Units)
              </label>
              <input
                type="number"
                id="manual-reorder-point-input"
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
        onClick={handleForecastItem}
        disabled={isForecasting || (inventory.length === 0 && !selectedForecastItem)}
        className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/30 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isForecasting ? 'Generating Forecast...' : 'Generate Forecast'}
      </button>

      {forecastAnalysis && (
        <div className="mt-8 bg-slate-700 p-6 rounded-lg shadow-inner">
          <h3 className="text-xl font-semibold text-cyan-400 mb-4 border-b pb-2">
            Forecast for {forecastAnalysis.product}
          </h3>

          <h4 className="text-lg font-semibold mb-3 text-slate-200">Sales History & Forecast</h4>
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
                {Object.keys(forecastAnalysis.individualSkuForecasts).map((sku, index) => (
                  <Line
                    key={`${sku}-sales`}
                    type="monotone"
                    dataKey={`${sku} Sales`}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    name={`${forecastAnalysis.individualSkuForecasts[sku].productName} Sales`}
                  />
                ))}
                {Object.keys(forecastAnalysis.individualSkuForecasts).map((sku, index) => (
                  <Line
                    key={`${sku}-forecast`}
                    type="monotone"
                    dataKey={`${sku} Forecast`}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    name={`${forecastAnalysis.individualSkuForecasts[sku].productName} Forecast`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {selectedForecastItem ? (
            <div className="mt-4 text-center text-slate-400 text-sm">
              Recommendation: Order{' '}
              <strong className="text-emerald-400">
                {
                  forecastAnalysis.individualSkuForecasts[selectedForecastItem.sku]
                    ?.recommendedOrderQty
                }{' '}
                units
              </strong>{' '}
              of{' '}
              <strong className="text-white">
                {forecastAnalysis.individualSkuForecasts[selectedForecastItem.sku]?.productName}
              </strong>{' '}
              to meet the re-order point of{' '}
              {forecastAnalysis.individualSkuForecasts[selectedForecastItem.sku]?.reorderPoint}{' '}
              units.
            </div>
          ) : (
            <div className="mt-8">
              <h4 className="text-lg font-semibold text-slate-200 mb-3">
                Individual SKU Forecast Summaries
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(forecastAnalysis.individualSkuForecasts).map(skuForecast => (
                  <div
                    key={skuForecast.sku}
                    className="bg-slate-600/50 p-4 rounded-lg border border-slate-700"
                  >
                    <h5 className="font-bold text-cyan-300 mb-2">
                      {skuForecast.productName} ({skuForecast.sku})
                    </h5>
                    <p className="text-sm text-slate-300">
                      Avg. Weekly Sales:{' '}
                      <span className="font-semibold">{skuForecast.avgWeeklySales}</span>
                    </p>
                    <p className="text-sm text-slate-300">
                      Current Stock:{' '}
                      <span className="font-semibold">{skuForecast.currentStock}</span>
                    </p>
                    <p className="text-sm text-slate-300">
                      Re-Order Point:{' '}
                      <span className="font-semibold">{skuForecast.reorderPoint}</span>
                    </p>
                    <p className="text-sm text-emerald-300">
                      Recommended Order:{' '}
                      <span className="font-bold">{skuForecast.recommendedOrderQty}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VaultForecastingView;
