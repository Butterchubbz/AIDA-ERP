export type ReturnCondition = 'unopened' | 'opened_functional' | 'refurbishable' | 'scrap'
export type ReturnStatus = 'pending_receipt' | 'received' | 'under_test' | 'refurbished' | 'scrapped'

export interface ReturnHistoryEntry {
  timestamp: string
  status: ReturnStatus
  changedBy: string
  notes?: string
}

export interface EUReturnItem {
  id: string
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
  historyLogs?: ReturnHistoryEntry[]
}

export interface RMAEntry {
  status?: 'Incoming' | 'Processing' | 'Testing' | 'Outgoing' | 'Received' | 'Completed'
  id?: string
  customerName: string
  ticketNumber: string
  orderNumber: string
  device: string
  trackingNumber: string
  timestamp?: string | number
  created?: string
}

export interface RMAItem {
  id?: string
  customer_name: string
  order_number: string
  status: 'Incoming' | 'Processing' | 'Testing' | 'Outgoing' | 'Completed'
  items_returned: string
  tracking_number?: string
}
