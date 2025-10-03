export interface ForecastAnalysis {
  product: string;
  chartData: ChartDataEntry[];
  avgWeeklySales: string;
  reorderPoint: number;
  currentStock: number;
  recommendedOrderQty: number;
}

export interface ChartDataEntry {
  weekLabel: string;
  Sales?: number;
  Forecast?: number;
}

export interface SalesRecord {
  year: number;
  week: number;
  netSales: number;
}
