import * as sharedModule from '@aida/shared'
import type { AppRole, UserRoles } from '@aida/shared'

interface SharedRuntimeShape {
  ROLE_PERMISSIONS?: Record<AppRole, UserRoles>
  default?: {
    ROLE_PERMISSIONS?: Record<AppRole, UserRoles>
  }
}

const runtimeModule = sharedModule as unknown as SharedRuntimeShape

export const ROLE_PERMISSIONS: Record<AppRole, UserRoles> =
  runtimeModule.ROLE_PERMISSIONS ??
  runtimeModule.default?.ROLE_PERMISSIONS ??
  {
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