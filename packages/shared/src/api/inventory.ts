import type { DeviceItem } from '../types/device.js'
import type { ComponentItem } from '../types/component.js'

export interface ListDevicesResponse {
  items: DeviceItem[]
  total: number
}

export interface GetDeviceResponse {
  item: DeviceItem
}

export interface CreateDeviceRequest {
  name: string
  sku: string
  barcode?: string
  warehouseStock?: number
  webStock?: number
  productionStock?: number
  reserveStock?: number
  onlineStock?: number
  location?: string
}

export interface UpdateDeviceRequest {
  name?: string
  sku?: string
  location?: string
}

export interface AdjustStockRequest {
  field:
    | 'warehouseStock'
    | 'webStock'
    | 'productionStock'
    | 'reserveStock'
    | 'onlineStock'
    | 'countedStock'
  delta: number
  note?: string
}

export interface AdjustStockResponse {
  item: DeviceItem
  event: {
    field: string
    oldValue: number
    newValue: number
    change: number
    created: string
  }
}

export interface ListComponentsResponse {
  items: ComponentItem[]
  total: number
}

export interface CreateComponentRequest {
  name: string
  sku: string
  barcode?: string
  onlineStock?: number
  countedStock?: number
  category?: string
  subcategory?: string
}

export interface UpdateComponentRequest {
  name?: string
  sku?: string
  category?: string
  subcategory?: string
}
