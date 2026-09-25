export type AppRole = 'Admin' | 'Manager' | 'Staff' | 'Viewer'
export type ModuleName =
  | 'Inventory'
  | 'Forecasting'
  | 'Amazon'
  | 'Inbound Shipments'
  | 'RMA Tracker'
  | 'Orders'
  | 'Admin'
  | 'Profile'
export type PermissionLevel = 'Editor' | 'Viewer' | 'None'
export type UserRoles = Record<ModuleName, PermissionLevel>

export const ROLE_PERMISSIONS: Record<AppRole, UserRoles> = {
  Admin: {
    Inventory: 'Editor',
    Forecasting: 'Editor',
    Amazon: 'Editor',
    'Inbound Shipments': 'Editor',
    'RMA Tracker': 'Editor',
    Orders: 'Editor',
    Admin: 'Editor',
    Profile: 'Editor',
  },
  Manager: {
    Inventory: 'Editor',
    Forecasting: 'Editor',
    Amazon: 'Editor',
    'Inbound Shipments': 'Editor',
    'RMA Tracker': 'Editor',
    Orders: 'Editor',
    Admin: 'None',
    Profile: 'Editor',
  },
  Staff: {
    Inventory: 'Viewer',
    Forecasting: 'Viewer',
    Amazon: 'Viewer',
    'Inbound Shipments': 'Editor',
    'RMA Tracker': 'Editor',
    Orders: 'Viewer',
    Admin: 'None',
    Profile: 'Editor',
  },
  Viewer: {
    Inventory: 'Viewer',
    Forecasting: 'Viewer',
    Amazon: 'Viewer',
    'Inbound Shipments': 'Viewer',
    'RMA Tracker': 'Viewer',
    Orders: 'Viewer',
    Admin: 'None',
    Profile: 'Viewer',
  },
}
