import type { RMAItem } from '../types/rma.js'

export interface ListRMAsResponse {
  items: RMAItem[]
  total: number
}

export interface CreateRMARequest {
  customer_name: string
  order_number: string
  status: RMAItem['status']
  items_returned: string
  tracking_number?: string
}

export interface UpdateRMARequest {
  customer_name?: string
  order_number?: string
  status?: RMAItem['status']
  items_returned?: string
  tracking_number?: string
}
