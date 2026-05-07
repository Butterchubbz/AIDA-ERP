export interface InboundShipmentItem {
  sku: string;
  quantity: number;
  pushed?: boolean;
}

export interface InboundShipment {
  id: string;
  poNumber: string;
  trackingNumber: string;
  vendor: string;
  shipmentType: string;
  status: string;
  notes: string;
  items: InboundShipmentItem[];
  customsDocsDownloaded?: boolean;
  importAgentEmailed?: boolean;
  spreadsheetsUpdated?: boolean;
  timestamp?: string;
  created?: string;
  updated?: string;
  collectionId?: string;
  collectionName?: string;
}
