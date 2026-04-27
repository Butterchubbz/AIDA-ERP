import { useState, useMemo, useEffect } from 'react';
import LazyRecharts from '../components/common/LazyRecharts';
import { useAuth } from '../context/AuthContext';
import { useMessageBox } from '../components/common/MessageBox';
import LoadingSpinner from '../components/common/LoadingSpinner';
import forecastLogo from '../assets/logos/generic-forecast.svg';

// --- Helper Functions for Forecasting (kept local as they are specific to this component) ---

/**
 * Calculates the slope and intercept for a simple linear regression.
 * @param {number[]} y - An array of dependent variables (e.g., sales).
 * @param {number[]} x - An array of independent variables (e.g., time periods).
 * @returns {{slope: number, intercept: number}} - The slope and intercept of the regression line.
 */
const simpleLinearRegression = (y: number[], x: number[]): { slope: number; intercept: number } => {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] || 0 };

  let sum_x = 0;
  let sum_y = 0;
  let sum_xy = 0;
  let sum_xx = 0;

  for (let i = 0; i < n; i++) {
    sum_x += x[i];
    sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_xx += x[i] * x[i];
  }

  const denominator = n * sum_xx - sum_x * sum_x;
  if (denominator === 0) return { slope: 0, intercept: sum_y / n };

  const slope = (n * sum_xy - sum_x * sum_y) / denominator;
  const intercept = (sum_y - slope * x[0]) / n; // Adjusted intercept calculation

  return { slope, intercept };
};

// --- Default Data for Manual Forecast CSV Input ---
const defaultCSVData = `Week,23,22,21,20,19,18
Crucial DDR3L SO-DIMM Memory Module - 4GB,39,45,45,50,50,50
Crucial DDR3L SO-DIMM Memory Module - 8GB,35,36,50,50,50,56
Samsung DDR3L SO-DIMM Memory Module - 4GB,188,218,221,223,173,183`;

// Component for Manual Inventory Forecasting
function ManualForecastingView() {
  const { user, loadingAuth } = useAuth(); // Get currentUser and loadingAuth from AuthContext
  const { showToast } = useMessageBox(); // Use the custom message box

  // Permissions (Assuming any logged-in user can view/use this tool)
  const canView = !!user;
  // This tool is client-side calculation, so 'canEdit' isn't directly applicable for Firebase writes.

  // --- Manual Inventory Forecasting States ---
  const [csvData, setCsvData] = useState(defaultCSVData);
  const [forecastWeeks, setForecastWeeks] = useState(12);
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(2);
  const [reorderMethod, setReorderMethod] = useState('safetyStock');
  const [safetyStockWeeks, setSafetyStockWeeks] = useState(2);
  const [manualReorderPoint, setManualReorderPoint] = useState(100);
    type HistoricalEntry = { product: string; week: number; sales: number; stock: number };
    type ForecastAnalysis = {
      product: string;
      chartData: { weekLabel: string; Sales?: number; Forecast?: number }[];
      avgWeeklySales: string;
      reorderPoint: number;
      currentStock: number;
      recommendedOrderQty: number;
    } | null;

    const [forecastAnalysis, setForecastAnalysis] = useState<ForecastAnalysis>(null);
  const [selectedForecastProduct, setSelectedForecastProduct] = useState<string | null>(null);
  const [isManualForecasting, setIsManualForecasting] = useState(false);

  // Memoized processing of CSV data for the forecasting dashboard.
  const processedForecastData = useMemo(() => {
    // Only process if canView is true, meaning user is authenticated
    if (!canView) return {};

    try {
      const lines = csvData
        .trim()
        .split('\n')
        .filter(line => line.trim() && !line.match(/^,*\\s*$/));
      if (lines.length < 2) {
        setForecastAnalysis(null);
        return {};
      }

      const headerLineIndex = lines.findIndex(l => l.trim().toLowerCase().startsWith('week'));
      if (headerLineIndex === -1)
        throw new Error("Could not find a header row starting with 'Week'.");

      const headerParts = lines[headerLineIndex].split(',').map(h => h.trim());
      const weekNumbers = headerParts.slice(1).map(w => parseInt(w, 10));

      const dataByProduct: {
        [key: string]: {
          stockLevels: { week: number; stockLevel: number }[];
            historical: HistoricalEntry[];
          currentStock: number;
        };
      } = {};

      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const productName = values[0];

        const isProductRow = productName && values.slice(1).some(v => v && !isNaN(parseInt(v, 10)));
        if (!isProductRow) continue;

        if (!dataByProduct[productName]) {
          dataByProduct[productName] = { stockLevels: [], historical: [], currentStock: 0 };
        }

        for (let j = 0; j < weekNumbers.length; j++) {
          const week = weekNumbers[j];
          const stockValueStr = values[j + 1];
          if (week !== undefined && stockValueStr && !isNaN(parseInt(stockValueStr, 10))) {
            dataByProduct[productName].stockLevels.push({
              week: week,
              stockLevel: parseInt(stockValueStr, 10),
            });
          }
        }
      }

      for (const productName in dataByProduct) {
        const productData = dataByProduct[productName];
        if (productData.stockLevels.length === 0) continue;

        productData.stockLevels.sort((a, b) => a.week - b.week);

        productData.currentStock =
          productData.stockLevels[productData.stockLevels.length - 1].stockLevel;

        for (let k = 1; k < productData.stockLevels.length; k++) {
          const prevWeek = productData.stockLevels[k - 1];
          const currWeek = productData.stockLevels[k];
          const sales = Math.max(0, prevWeek.stockLevel - currWeek.stockLevel);

          productData.historical.push({
            product: productName,
            week: currWeek.week,
            sales: sales,
            stock: currWeek.stockLevel,
          });
        }
      }
      return dataByProduct;
    } catch (e: unknown) {
      showToast('Error processing CSV data: ' + ((e as { message?: string }).message ?? String(e)), 'error');
      console.error(e);
      return {};
    }
  }, [csvData, showToast, canView]); // Added canView to dependencies

  const forecastProductNames = useMemo(
    () => Object.keys(processedForecastData),
    [processedForecastData]
  );

  // Effect to automatically select the first product for forecasting when data changes.
  useEffect(() => {
    if (
      forecastProductNames.length > 0 &&
      !forecastProductNames.includes(selectedForecastProduct || '')
    ) {
      setSelectedForecastProduct(forecastProductNames[0]);
    } else if (forecastProductNames.length === 0) {
      setSelectedForecastProduct(null);
      setForecastAnalysis(null);
    }
  }, [forecastProductNames, selectedForecastProduct]);

  const handleManualForecast = () => {
    if (!canView) {
      showToast('Permission denied. You must be logged in to use this tool.', 'error');
      return;
    }

    if (!selectedForecastProduct || !processedForecastData[selectedForecastProduct]) {
      showToast('Please select a valid product to forecast.', 'error');
      return;
    }

    const productData = processedForecastData[selectedForecastProduct];
    const historicalData = productData.historical;

    if (historicalData.length < 2) {
      showToast(
        'Not enough historical data to perform a forecast. At least 3 weeks of stock data are needed to calculate 2 sales periods.',
        'error'
      );
      setForecastAnalysis(null);
      return;
    }

    setIsManualForecasting(true);
    try {
      const y_values = historicalData.map(d => d.sales);
      const x_values = historicalData.map(d => d.week);

      const { slope, intercept } = simpleLinearRegression(y_values, x_values);

      const lastHistoricalWeek = historicalData[historicalData.length - 1].week;
      const combinedChartData: { weekLabel: string; Sales?: number; Forecast?: number }[] =
        historicalData.map(d => ({
          weekLabel: `Week ${d.week}`,
          Sales: d.sales,
        }));

      let cumulativeForecast = 0;

      for (let i = 1; i <= forecastWeeks; i++) {
        const next_week = lastHistoricalWeek + i;
        const predictedSales = Math.max(0, Math.round(slope * next_week + intercept));
        cumulativeForecast += predictedSales;
        combinedChartData.push({ weekLabel: `Week ${next_week}`, Forecast: predictedSales });
      }

      const avgWeeklySales = forecastWeeks > 0 ? cumulativeForecast / forecastWeeks : 0;

      let reorderPoint;
      if (reorderMethod === 'safetyStock') {
        reorderPoint = Math.round(
          avgWeeklySales * leadTimeWeeks + avgWeeklySales * safetyStockWeeks
        );
      } else {
        reorderPoint = manualReorderPoint;
      }

      const currentStock = productData.currentStock || 0;
      const recommendedOrderQty = reorderPoint - currentStock > 0 ? reorderPoint - currentStock : 0;

      setForecastAnalysis({
        product: selectedForecastProduct,
        chartData: combinedChartData,
        avgWeeklySales: avgWeeklySales.toFixed(2),
        reorderPoint,
        currentStock: currentStock,
        recommendedOrderQty,
      });
      showToast('Manual forecast generated successfully!', 'success');
    } catch (e: unknown) {
      console.error('Error generating manual forecast:', e);
      showToast('Failed to generate manual forecast. ' + ((e as { message?: string }).message ?? String(e)), 'error');
    } finally {
      setIsManualForecasting(false);
    }
  };

  // Render a loading spinner if authentication is still loading
  if (loadingAuth) {
    return <LoadingSpinner />;
  }

  // Render a message if user is not authenticated
  if (!canView) {
    // Re-using canView for the conditional render
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-800 rounded-lg shadow-xl text-slate-200 text-lg">
        <i className="fas fa-user-lock text-6xl text-blue-500 mb-4"></i>
        <h2 className="text-2xl font-semibold mb-2">Access Denied (AIDA)</h2>
        <p className="text-center">Please sign in to use the Manual Forecasting tool.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white min-h-full font-sans p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="border-b border-slate-700 pb-3 mb-6">
          <h2 className="text-2xl font-semibold text-cyan-400 flex items-center gap-2">
            <img src={forecastLogo} alt="Forecast logo" className="w-7 h-7 object-contain" />
            Manual Sales Forecasting
          </h2>
        </div>
        <p className="text-slate-400 mb-8">
          Paste your weekly sales data from any source to analyze trends and forecast inventory
          needs. This forecast is independent of your Firebase inventory data.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-slate-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-white">1. Input Data</h3>
            <div className="mb-4">
              <label htmlFor="csv-data" className="block text-slate-300 mb-2 font-medium">
                Paste Data from Google Sheets or Excel
              </label>
              <textarea
                id="csv-data"
                value={csvData}
                onChange={e => {
                  setCsvData(e.target.value);
                  setForecastAnalysis(null);
                }}
                className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                placeholder="Week,23,22,21,..."
              ></textarea>
              <p className="text-xs text-slate-400 mt-2">
                Simply copy a range of cells from your spreadsheet and paste it here. Ensure the
                format matches the example.
              </p>
            </div>

            <h3 className="text-2xl font-semibold mb-4 mt-6 text-white">2. Set Parameters</h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="forecast-product-select"
                  className="block text-slate-300 mb-2 font-medium"
                >
                  Select Product
                </label>
                <select
                  id="forecast-product-select"
                  value={selectedForecastProduct || ''}
                  onChange={e => setSelectedForecastProduct(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 text-slate-100"
                  disabled={forecastProductNames.length === 0}
                >
                  <option value="" disabled>
                    -- Select a Product --
                  </option>
                  {forecastProductNames.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="forecast-weeks" className="block text-slate-300 mb-2 font-medium">
                  Forecast Period (Weeks)
                </label>
                <input
                  type="number"
                  id="forecast-weeks"
                  value={forecastWeeks}
                  min="1"
                  onChange={e => setForecastWeeks(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="lead-time" className="block text-slate-300 mb-2 font-medium">
                  Supplier Lead Time (Weeks)
                </label>
                <input
                  type="number"
                  id="lead-time"
                  value={leadTimeWeeks}
                  min="0"
                  onChange={e => setLeadTimeWeeks(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100"
                />
              </div>

              {/* Re-order point method selection */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <span className="block text-slate-300 mb-3 font-medium">Re-Order Point Method</span>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reorderMethod"
                      value="safetyStock"
                      checked={reorderMethod === 'safetyStock'}
                      onChange={() => setReorderMethod('safetyStock')}
                      className="form-radio bg-slate-600 text-cyan-500"
                    />
                    <span className="text-slate-200">Calculate</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="reorderMethod"
                      value="manual"
                      checked={reorderMethod === 'manual'}
                      onChange={() => setReorderMethod('manual')}
                      className="form-radio bg-slate-600 text-cyan-500"
                    />
                    <span className="text-slate-200">Manual</span>
                  </label>
                </div>
                {reorderMethod === 'safetyStock' && (
                  <div className="mt-4">
                    <label htmlFor="safety-stock" className="block text-slate-400 mb-2 text-sm">
                      Safety Stock (Weeks of Sales)
                    </label>
                    <input
                      type="number"
                      id="safety-stock"
                      value={safetyStockWeeks}
                      min="0"
                      onChange={e => setSafetyStockWeeks(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100"
                    />
                  </div>
                )}
                {reorderMethod === 'manual' && (
                  <div className="mt-4">
                    <label htmlFor="manual-reorder" className="block text-slate-400 mb-2 text-sm">
                      Manual Re-Order Point
                    </label>
                    <input
                      type="number"
                      id="manual-reorder"
                      value={manualReorderPoint}
                      min="0"
                      onChange={e => setManualReorderPoint(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-slate-100"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-8">
              <button
                onClick={handleManualForecast}
                disabled={!selectedForecastProduct || isManualForecasting || !canView}
                className="flex-grow bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/30 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isManualForecasting ? 'Analyzing...' : 'Analyze & Forecast'}
              </button>
              <button
                disabled
                title="Google Sheet sync coming soon!"
                className="flex-shrink-0 p-3 rounded-lg bg-slate-600 text-slate-400 cursor-not-allowed"
                aria-label="Sync with Google Sheet (coming soon)"
              >
                <i className="fab fa-google-drive text-2xl"></i>
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-white">3. Forecast Results</h3>
            {forecastAnalysis ? (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="text-sm text-slate-400">Avg. Weekly Sales</div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {forecastAnalysis.avgWeeklySales}
                    </div>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="text-sm text-slate-400">Current Stock</div>
                    <div className="text-2xl font-bold text-white">
                      {forecastAnalysis.currentStock}
                    </div>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="text-sm text-slate-400">Re-Order Point</div>
                    <div className="text-2xl font-bold text-white">
                      {forecastAnalysis.reorderPoint}
                    </div>
                  </div>
                  <div className="bg-emerald-500/20 border border-emerald-500 p-4 rounded-lg">
                    <div className="text-sm text-emerald-300">Order Now</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {forecastAnalysis.recommendedOrderQty}
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-4 text-white">
                  {forecastAnalysis.product} - Sales & Forecast
                </h3>
                <div className="w-full h-80">
                  <LazyRecharts>
                    {(R: unknown) => {
                      const Recharts = R as typeof import('recharts');
                      return (
                      <Recharts.ResponsiveContainer width="100%" height="100%">
                        <Recharts.LineChart data={forecastAnalysis.chartData}>
                          <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#334155" />
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
                          <Recharts.Line
                            type="monotone"
                            dataKey="Sales"
                            stroke="#2dd4bf"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Recharts.Line
                            type="monotone"
                            dataKey="Forecast"
                            stroke="#67e8f9"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                          />
                        </Recharts.LineChart>
                      </Recharts.ResponsiveContainer>
                      );
                    }}
                  </LazyRecharts>
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
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <p>
                  Paste your data, select a product, and click "Analyze & Forecast" to see the
                  results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManualForecastingView;
