// Remove broken import and use local type only

export interface DeviceItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  webStock: number;
  warehouseStock: number;
  productionStock: number;
  reserveStock: number;
  onlineStock: number;
  location?: string;
  quantity?: number;
  countedStock?: number;
  created?: string;
  updated?: string;
}
