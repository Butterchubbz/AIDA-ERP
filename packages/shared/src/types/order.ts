export interface Order {
  id?: string;
  orderNumber: string;
  sku: string;
  amount: string;
  status: 'Initiated' | 'Approved' | 'Paid' | 'Completed';
}
