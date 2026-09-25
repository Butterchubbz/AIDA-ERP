import type { Order } from '../types/order.js'
import type { RefurbishedDevice } from '../types/refurbished.js'

export interface ListOrdersResponse {
  items: Order[]
  total: number
}

export interface CreateOrderRequest {
  orderNumber: string
  sku: string
  amount: string
  status: Order['status']
}

export interface UpdateOrderRequest {
  orderNumber?: string
  sku?: string
  amount?: string
  status?: Order['status']
}

export interface ListRefurbishedResponse {
  items: RefurbishedDevice[]
  total: number
}

export interface CreateRefurbishedRequest {
  name: string
  sku: string
  refurbishedStock: number
  notes: string
  sortOrder?: number
}

export interface UpdateRefurbishedRequest {
  name?: string
  sku?: string
  refurbishedStock?: number
  notes?: string
  sortOrder?: number
}
