export type ShippingCarrier = 'DHL' | 'DPD' | 'UPS' | 'FedEx' | 'Other'
export type ShippingStatus = 'label_created' | 'in_transit' | 'delivered' | 'exception'

export interface ShippingItemLine {
  sku: string
  qty: number
}

export interface ShippingRecord {
  id: string
  trackingNumber: string
  carrier: ShippingCarrier
  destination: string
  shipDate: string
  status: ShippingStatus
  itemsShipped: ShippingItemLine[]
  packageWeight?: number
  postageCost?: number
  created: string
  updated: string
}

export interface ShipmentItem {
  sku: string
  quantity: number
}

export interface Shipment {
  id?: string
  po_number: string
  tracking_number: string
  vendor: string
  status: 'In Transit' | 'Arrived at Customs' | 'Customs Cleared' | 'Out for Delivery' | 'Complete'
  items: ShipmentItem[]
  notes?: string
}
