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

export type CanonicalModule =
  | 'Inventory'
  | 'Forecasting'
  | 'Amazon'
  | 'Inbound Shipments'
  | 'RMA Tracker'
  | 'Orders'
  | 'Admin'
  | 'Profile'
  | 'Dashboard'
  | 'ForecastingSettings'

export const CANONICAL_MODULES: readonly CanonicalModule[] = [
  'Inventory',
  'Forecasting',
  'Amazon',
  'Inbound Shipments',
  'RMA Tracker',
  'Orders',
  'Admin',
  'Profile',
  'Dashboard',
  'ForecastingSettings',
] as const

const CANONICAL_MODULE_BY_LOWER = new Map<string, CanonicalModule>(
  CANONICAL_MODULES.map((m) => [m.toLowerCase(), m])
)

/**
 * Maps frontend application route paths to canonical module IDs.
 * Keys are normalized to lowercase without leading or trailing slashes.
 */
export const ROUTE_TO_MODULE: Record<string, CanonicalModule> = {
  '': 'Dashboard',
  'dashboard': 'Dashboard',
  'inventory': 'Inventory',
  'inventory/devices': 'Inventory',
  'inventory/accessories': 'Inventory',
  'inventory/components': 'Inventory',
  'inventory/refurbished': 'Inventory',
  'forecasting': 'Forecasting',
  'forecasting/devices': 'Forecasting',
  'forecasting/component': 'Forecasting',
  'forecasting/purchase-order': 'Forecasting',
  'forecasting/settings': 'ForecastingSettings',
  'settings/forecasting': 'ForecastingSettings',
  'amazon': 'Amazon',
  'amazon/processing': 'Amazon',
  'amazon/outgoing': 'Amazon',
  'orders': 'Orders',
  'quotes/approved': 'Orders',
  'shipments': 'Inbound Shipments',
  'shipments/inbound': 'Inbound Shipments',
  'logistics/shipping': 'Inbound Shipments',
  'rma': 'RMA Tracker',
  'inventory/rma': 'RMA Tracker',
  'logistics/returns': 'RMA Tracker',
  'profile': 'Profile',
  'admin': 'Admin',
  'users': 'Admin',
  'data': 'Admin',
  'integrations': 'Admin',
}

/**
 * Resolves a module name, route path, or case/path variant to a canonical module ID.
 * Examples:
 *   '/users/' -> 'Admin'
 *   'users' -> 'Admin'
 *   'Admin' -> 'Admin'
 *   'admin' -> 'Admin'
 *   '/forecasting/settings' -> 'ForecastingSettings'
 *   'settings/forecasting' -> 'ForecastingSettings'
 *   'ForecastingSettings' -> 'ForecastingSettings'
 */
export function resolveCanonicalModule(input: string | undefined | null): CanonicalModule | null {
  if (!input) return null
  const cleaned = input.trim()
  if (!cleaned) return null

  // Direct match or case-insensitive match against canonical modules
  const canonical = CANONICAL_MODULE_BY_LOWER.get(cleaned.toLowerCase())
  if (canonical) {
    return canonical
  }

  // Route path match (strip leading and trailing slashes, normalize case)
  const normalizedRoute = cleaned.toLowerCase().replace(/^\/+|\/+$/g, '')
  if (normalizedRoute in ROUTE_TO_MODULE) {
    return ROUTE_TO_MODULE[normalizedRoute]
  }

  return null
}

export const ROLE_MODULES: Record<AppRole, readonly CanonicalModule[]> = {
  Admin: [
    'Inventory',
    'Forecasting',
    'Amazon',
    'Inbound Shipments',
    'RMA Tracker',
    'Orders',
    'Admin',
    'Profile',
    'Dashboard',
    'ForecastingSettings',
  ],
  Manager: [
    'Inventory',
    'Forecasting',
    'Amazon',
    'Inbound Shipments',
    'RMA Tracker',
    'Orders',
    'Profile',
    'Dashboard',
    'ForecastingSettings',
  ],
  Staff: [
    'Inventory',
    'Forecasting',
    'Amazon',
    'Inbound Shipments',
    'RMA Tracker',
    'Orders',
    'Profile',
    'Dashboard',
  ],
  Viewer: [
    'Inventory',
    'Forecasting',
    'Amazon',
    'Inbound Shipments',
    'RMA Tracker',
    'Orders',
    'Profile',
    'Dashboard',
  ],
}

/**
 * Single source of truth helper to check if a role is allowed access to a module or route path.
 * Normalizes route paths and case variants via ROUTE_TO_MODULE before checking ROLE_MODULES.
 */
export function isModuleAllowed(role: AppRole | undefined | null, moduleOrRoute: string): boolean {
  if (!role) return false
  const allowed = ROLE_MODULES[role]
  if (!allowed) return false

  const canonical = resolveCanonicalModule(moduleOrRoute)
  if (!canonical) return false

  return allowed.includes(canonical)
}
