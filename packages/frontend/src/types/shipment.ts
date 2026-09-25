export interface ShipmentItem {
  sku: string;
  quantity: number;
}

export interface Shipment {
  id?: string;
  po_number: string;
  tracking_number: string;
  vendor: string;
  status: 'In Transit' | 'Arrived at Customs' | 'Customs Cleared' | 'Out for Delivery' | 'Complete';
  items: ShipmentItem[];
  notes?: string;
}
