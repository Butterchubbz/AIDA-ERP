export const COLLECTIONS = {
  INVENTORY_DEVICE: 'inventoryDevice',
  INVENTORY_COMPONENT: 'inventoryComponent',
  REFURBISHED_DEVICES: 'refurbishedDevices',
  AMAZON_POS: 'amazonPOs',
  RMA_ENTRIES: 'rmaEntries',
  INBOUND_SHIPMENTS: 'inboundShipments',
  QUOTE_APPROVED_ORDERS: 'quoteApprovedOrders',
  SALES_DATA: 'salesData',
  STOCK_HISTORY: 'stockHistory',
  SHIPMENTS: 'shipments',
  INVENTORY_TRANSACTIONS: 'inventory_transactions',
  USERS: 'users',
  SUPERUSERS: '_superusers',
} as const

// Schema definitions used by CsvImportModal and DataManagementView
export const availableCollections = [
  {
    id: COLLECTIONS.INVENTORY_DEVICE,
    name: 'Inventory Device',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'sku', type: 'text', required: true },
      { name: 'webStock', type: 'number', required: false },
      { name: 'productionStock', type: 'number', required: false },
      { name: 'warehouseStock', type: 'number', required: false },
      { name: 'reserveStock', type: 'number', required: false },
      { name: 'location', type: 'text', required: false },
    ],
  },
  {
    id: COLLECTIONS.INVENTORY_COMPONENT,
    name: 'Inventory Component',
    schema: [
      { name: 'name', type: 'text', required: true },
      { name: 'sku', type: 'text', required: true },
      { name: 'webStock', type: 'number', required: false },
      { name: 'countedStock', type: 'number', required: false },
      { name: 'category', type: 'text', required: false },
      { name: 'subcategory', type: 'text', required: false },
    ],
  },
  {
    id: COLLECTIONS.REFURBISHED_DEVICES,
    name: 'Refurbished Devices',
    schema: [],
  },
  {
    id: COLLECTIONS.AMAZON_POS,
    name: 'Amazon POs',
    schema: [],
  },
  {
    id: COLLECTIONS.RMA_ENTRIES,
    name: 'RMA Entries',
    schema: [],
  },
  {
    id: COLLECTIONS.INBOUND_SHIPMENTS,
    name: 'Inbound Shipments',
    schema: [],
  },
  {
    id: COLLECTIONS.USERS,
    name: 'Users',
    schema: [],
  },
  {
    id: COLLECTIONS.SALES_DATA,
    name: 'Sales Data',
    schema: [],
  },
  {
    id: COLLECTIONS.STOCK_HISTORY,
    name: 'Stock History',
    schema: [],
  },
];
