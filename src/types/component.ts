export interface ComponentItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  onlineStock: number;
  countedStock: number;
  category?: string;
  subcategory?: string;
  created?: string;
  updated?: string;
}
