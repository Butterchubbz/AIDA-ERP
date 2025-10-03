export interface InboundShipmentItem {
  sku: string;
  quantity: number;
  pushed: boolean;
}

export interface InboundShipment {
  id?: string;
  poNumber: string;
  trackingNumber: string;
  vendor: string;
  shipmentType: string;
  status: string;
  customsDocsDownloaded: boolean;
  importAgentEmailed: boolean;
  spreadsheetsUpdated: boolean;
  notes: string;
  items: InboundShipmentItem[];
  timestamp: string;
}
