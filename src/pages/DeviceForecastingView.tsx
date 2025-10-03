import { useState, useMemo, useEffect } from 'react';
import LazyRecharts from '../components/common/LazyRecharts';
import { useInventoryContext } from '../context/InventoryContext';
import type { DeviceItem } from '../types/device';

type SalesRecord = {
  sku: string;
  year: number;
  week: number;
  netSales: number;
};
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { simpleLinearRegression } from '../utils/forecasting';
import { pb } from '../lib/pocketbase'; // Import PocketBase instance
import PageContainer from '../components/common/PageContainer';

// --- DeviceForecastingView Component ---
function DeviceForecastingView() {
  const { inventory, loading, error } = useInventoryContext();
  const { user, loadingAuth } = useAuth();
  const { showToast } = useMessageBox();

  const [selectedForecastItem, setSelectedForecastItem] = useState<DeviceItem | null>(null);
  type ForecastResult = {
    productName: string;
    sku: string;
    salesData: { week: number; weekLabel: string; sales: number }[];
    forecastData: { week: number; weekLabel: string; Forecast: number }[];
    avgWeeklySales: string;
    reorderPoint: number;
    currentStock: number;
    recommendedOrderQty: number;
  };
  type ChartPoint = {
    week: number;
    weekLabel?: string;
  } & Record<string, number | string | undefined>;
  const [forecastAnalysis, setForecastAnalysis] = useState<{
    product: string;
    chartData: ChartPoint[];
    individualSkuForecasts: Record<string, ForecastResult>;
  } | null>(null);
  const [forecastWeeks, setForecastWeeks] = useState(12); // Default to forecast next 12 weeks
  const [historyWeeksForForecast, setHistoryWeeksForForecast] = useState(12); // Default to use past 12 weeks

  // States for re-order point calculation
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(9);
  const [safetyStockPercentage, setSafetyStockPercentage] = useState(0.15); // Default to 15% safety stock
  const [reorderMethod, setReorderMethod] = useState('calculated'); // 'calculated' or 'manual'
  const [manualReorderPoint, setManualReorderPoint] = useState(100);
  const [isForecasting, setIsForecasting] = useState(false);

  useEffect(() => {
    // Initial forecast generation or data loading can be triggered here
    // For now, we'll rely on user interaction to trigger handleForecastItem
  }, []);

  // Permissions
  const canView = !!user;

  // Memoized list of inventory items for the dropdown
  const inventoryOptions = useMemo(() => {
    return inventory.map((item: DeviceItem) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      onlineStock: item.onlineStock, // Need onlineStock for forecasting calculation
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
      // Fetch all sales data from PocketBase 'salesData' collection
      // Assuming 'salesData' collection has fields: 'sku', 'year', 'week', 'netSales'
      const allSalesRecords = (await pb.collection('salesData').getFullList({
        sort: 'sku,year,week', // Order by SKU, then year, then week
      })) as unknown as SalesRecord[];

      const skusToForecast = selectedForecastItem
        ? [selectedForecastItem.sku]
        : inventory.map((item: DeviceItem) => item.sku);
  const forecastResults: Record<string, ForecastResult> = {};
  const combinedChartData: ChartPoint[] = [];
      let maxWeekIndex = 0;

      let latestYear = new Date().getFullYear();
      let latestWeek = Math.ceil(
        (new Date().valueOf() - new Date(latestYear, 0, 1).valueOf()) / (86400000 * 7)
      );

      if (allSalesRecords.length > 0) {
        // Determine the latest year and week from fetched sales records
        const lastRecord = allSalesRecords[allSalesRecords.length - 1];
        latestYear = lastRecord.year;
        latestWeek = lastRecord.week;
      }

      for (const sku of skusToForecast) {
        const item = inventory.find((i: DeviceItem) => i.sku === sku) as DeviceItem | undefined;
        if (!item) continue; // Skip if SKU not found in inventory

        const salesRecordsForSku = allSalesRecords.filter(
          (record: SalesRecord) => record.sku === sku
        );

        const historicalSalesMap = new Map<string, number>();
        salesRecordsForSku.forEach(record => {
          historicalSalesMap.set(`${record.year}-${record.week}`, record.netSales);
        });

        const completeSalesData: { year: number; week: number; netSales: number }[] = [];
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

        const forecastDataForSku: { week: number; weekLabel: string; Forecast: number }[] = [];
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
          reorderPoint = Math.round(avgWeeklySales * leadTimeWeeks * (1 + safetyStockPercentage));
        } else {
          reorderPoint = manualReorderPoint;
        }

        const recommendedOrderQty = Math.max(0, reorderPoint - (item.onlineStock || 0));

        forecastResults[sku] = {
          productName: item.name,
          sku: item.sku,
          salesData: salesDataForRegression,
          forecastData: forecastDataForSku,
          avgWeeklySales: avgWeeklySales.toFixed(2),
          reorderPoint,
          currentStock: item.onlineStock || 0,
          recommendedOrderQty,
        };
      }

      for (let i = 0; i <= maxWeekIndex; i++) {
        const weekData: ChartPoint = { week: i } as ChartPoint;
        let weekLabel = '';

        for (const sku of skusToForecast) {
          const result = forecastResults[sku];
          if (result) {
    const salesRecord = result.salesData.find((d: { week: number }) => d.week === i);
    const forecastRecord = result.forecastData.find((d: { week: number }) => d.week === i);

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
        product: selectedForecastItem ? selectedForecastItem.name : 'All Device SKUs',
        chartData: combinedChartData,
        individualSkuForecasts: forecastResults,
      });
      showToast('Forecast generated successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error generating forecast:', e);
      if ((e as { code?: string }).code === 'failed-precondition') {
        showToast(
          'A Firestore index is required for this query. Check the browser console for a link to create it.',
          'error',
          10000
        );
      } else {
        showToast('Failed to generate forecast: ' + ((e as { message?: string }).message ?? String(e)), 'error');
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
        <p className="font-semibold mb-2">Error loading Device SKU data for forecasting:</p>
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
        <p className="text-center">Please sign in to use the Device SKU Forecasting tool.</p>
      </div>
    );
  }

  return (
    <>
      <PageContainer title="Device Sales Forecasting" icon="fas fa-chart-line">
        <p className="text-slate-400 mb-4">
          Select a Device SKU to view its sales history and forecast future stock needs.
        </p>

        <div className="mb-6">
          <label htmlFor="forecast-item-select" className="block text-slate-300 mb-2 font-medium">
            Select Device SKU for Forecast
          </label>
          <select
            id="forecast-item-select"
            value={selectedForecastItem?.id || ''}
            onChange={e => {
              const item = inventory.find(i => i.id === e.target.value) as DeviceItem | undefined;
              setSelectedForecastItem(item ?? null);
              setForecastAnalysis(null); // Clear previous forecast when item changes
            }}
            className="w-full px-4 py-2 border rounded-md bg-slate-700 border-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
            aria-label="Select item for forecast"
          >
            <option value="" disabled>
              -- Select a Device SKU --
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
                  name="reorderMethodDevice"
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
                  name="reorderMethodDevice"
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
              <LazyRecharts>
                {(R: unknown) => {
                  const Recharts = R as typeof import('recharts');
                  return (
                  <Recharts.ResponsiveContainer width="100%" height="100%">
                    <Recharts.LineChart data={forecastAnalysis.chartData}>
                      <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <Recharts.XAxis dataKey="weekLabel" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <Recharts.YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <Recharts.Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          borderColor: '#475569',
                          color: '#cbd5e1',
                        }}
                        labelStyle={{ color: '#f1f5f9', fontWeight: 'bold' }}
                      />
                      <Recharts.Legend wrapperStyle={{ color: '#e2e8f0' }} />
                      {Object.keys(forecastAnalysis.individualSkuForecasts).map((sku, index) => (
                        <Recharts.Line
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
                        <Recharts.Line
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
                      </Recharts.LineChart>
                    </Recharts.ResponsiveContainer>
                    );
                  }}
              </LazyRecharts>
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
                  {Object.values(forecastAnalysis.individualSkuForecasts).map(
                      (skuForecast: ForecastResult) => (
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
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </>
  );
}

export default DeviceForecastingView;
