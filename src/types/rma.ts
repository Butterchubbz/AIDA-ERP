export interface RMAEntry {
  status?: 'Incoming' | 'Processing' | 'Testing' | 'Outgoing' | 'Received' | 'Completed';
  id?: string;
  customerName: string;
  ticketNumber: string;
  orderNumber: string;
  device: string;
  trackingNumber: string;
  timestamp?: string | number;
}

export interface RMAItem {
  id?: string;
  customer_name: string;
  order_number: string;
  status: 'Incoming' | 'Processing' | 'Testing' | 'Outgoing' | 'Completed';
  items_returned: string;
  tracking_number?: string;
}
