export interface AmazonPOItem {
  sku: string;
  name: string;
  quantity: number;
}

export interface AmazonPO {
  id?: string;
  poNumber: string;
  poDate: string;
  status: 'Draft' | 'Submitted' | 'In Transit' | 'Receiving' | 'Shipped' | 'Delivered' | 'Completed' | 'Cancelled';
  items: AmazonPOItem[];
  movedToOutgoing?: boolean;
}

export interface AmazonItem {
  id: string;
  name: string;
  sku: string;
  updatedAt?: string;
  amazonFBA_BaseQuantity: number;
  amazonFBA_Base_OnTheWayQuantity: number;
  amazonFBA_250Quantity: number;
  amazonFBA_250_OnTheWayQuantity: number;
  amazonFBA_500Quantity: number;
  amazonFBA_500_OnTheWayQuantity: number;
}

export interface AmazonListingVariant {
  suffix: string;
  asin: string;
  packSize: number;
  price: number;
}

export interface AmazonListing {
  id: string;
  itemType: 'Device' | 'Component';
  inventoryId: string;
  productName: string;
  inventorySku: string;
  parentSku: string;
  isMultiSku: boolean;
  asin?: string;
  variants?: AmazonListingVariant[];
  fbaStock: number;
}
