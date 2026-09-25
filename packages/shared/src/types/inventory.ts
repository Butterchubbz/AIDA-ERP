export interface InventoryItem {
  id: string
  workspaceId: string
  sku: string
  name: string
  barcode?: string
  location?: string
  warehouseStock: number
  webStock: number
  onlineStock: number
  countedStock?: number
  created: string
  updated: string
}
