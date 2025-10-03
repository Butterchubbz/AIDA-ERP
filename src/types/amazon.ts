export interface AmazonPOItem {
  sku: string;
  name: string;
  quantity: number;
}

export interface AmazonPO {
  id?: string;
  poNumber: string;
  poDate: string;
  status: 'Draft' | 'Submitted' | 'In Transit' | 'Receiving' | 'Completed' | 'Cancelled';
  items: AmazonPOItem[];
}

export interface AmazonItem {
  id: string;
  name: string;
  sku: string;
  updatedAt?: string; // Assuming it's a string from the database, will be converted to Date in component
  amazonFBA_BaseQuantity: number;
  amazonFBA_Base_OnTheWayQuantity: number;
  amazonFBA_250Quantity: number;
  amazonFBA_250_OnTheWayQuantity: number;
  amazonFBA_500Quantity: number;
  amazonFBA_500_OnTheWayQuantity: number;
}
