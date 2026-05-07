import type { InboundShipment, InboundShipmentItem } from '../types/inbound.js'

export interface ListInboundResponse {
  items: InboundShipment[]
  total: number
}

export interface CreateInboundRequest {
  poNumber: string
  trackingNumber: string
  vendor: string
  shipmentType: string
  status: string
  notes: string
  items: InboundShipmentItem[]
}

export interface UpdateInboundRequest {
  trackingNumber?: string
  status?: string
  notes?: string
  items?: InboundShipmentItem[]
  customsDocsDownloaded?: boolean
  importAgentEmailed?: boolean
  spreadsheetsUpdated?: boolean
}

export interface PushShipmentToInventoryResponse {
  pushed: number
  updatedDeviceIds: string[]
}
