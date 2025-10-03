export const availableCollections = [
  {
    id: 'inventoryDevice',
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
    id: 'inventoryComponent',
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
    id: 'refurbishedDevices',
    name: 'Refurbished Devices',
    schema: [],
  },
  {
    id: 'amazonPOs',
    name: 'Amazon POs',
    schema: [],
  },
  {
    id: 'rmaEntries',
    name: 'RMA Entries',
    schema: [],
  },
  {
    id: 'inboundShipments',
    name: 'Inbound Shipments',
    schema: [],
  },
  {
    id: 'users',
    name: 'Users',
    schema: [],
  },
  {
    id: 'salesData',
    name: 'Sales Data',
    schema: [],
  },
  {
    id: 'stockHistory',
    name: 'Stock History',
    schema: [],
  },
];
