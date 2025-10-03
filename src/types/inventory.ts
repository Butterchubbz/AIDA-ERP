// Remove broken import and use local type only

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  onlineStock: number;
  productionStock: number;
  warehouseStock: number;
  reserveStock: number;
  quantity: number;
  location?: string;
  countedStock?: number;
}
