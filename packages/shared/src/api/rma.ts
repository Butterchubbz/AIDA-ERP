import type { EUReturnItem, ReturnCondition, ReturnStatus, RMAItem } from '../types/rma.js'

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

export interface CreateReturnRequest {
  rmaNumber: string
  workspaceId: string
  sku: string
  serialNumber?: string
  customerName?: string
  returnReason?: string
  condition: ReturnCondition
  status: ReturnStatus
  processedBy: string
  receivedAt: string
}

export interface UpdateReturnRequest {
  rmaNumber?: string
  workspaceId?: string
  sku?: string
  serialNumber?: string
  customerName?: string
  returnReason?: string
  condition?: ReturnCondition
  status?: ReturnStatus
  processedBy?: string
  receivedAt?: string
}

export interface GetReturnsResponse {
  items: EUReturnItem[]
  total: number
}
