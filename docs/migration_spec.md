# Migration Functional Specification: AIDA Three-Package Monorepo

**Status:** Approved for implementation  
**Source plan:** `docs/split_architecture_plan.md`  
**Scope:** Full inventory of what moves where, API contract definitions, engine migration details, and RBAC enforcement mapping.

---

## 1. Type Migration Map

All files move from `src/types/` → `packages/shared/src/types/` verbatim, with the single change noted.

| File | Change required | Notes |
|---|---|---|
| `device.ts` | None | Already stripped of PB imports |
| `component.ts` | Audit for `RecordModel` — remove if present | PB base type is backend-only |
| `amazon.ts` | Audit for `RecordModel` — remove if present | |
| `history.ts` | None expected | `StockHistoryRecord` is a plain object |
| `inbound.ts` | Audit for `RecordModel` — remove if present | |
| `inventory.ts` | Audit for `RecordModel` — remove if present | |
| `order.ts` | Audit for `RecordModel` — remove if present | |
| `refurbished.ts` | Audit for `RecordModel` — remove if present | |
| `rma.ts` | Audit for `RecordModel` — remove if present | |
| `shipment.ts` | Audit for `RecordModel` — remove if present | |
| `stock.ts` | Audit for `RecordModel` — remove if present | |
| `user.ts` | **Rewrite** — replace `RecordModel`-based shape with plain `User` interface (see §1.1) | |
| `forecast.ts` | **Partial move** — `SaleRecord`, `StockHistoryRecord`, `ProjectionPoint`, `LOOKBACK_WEEKS`, and the date/week utility functions stay in the shared package as `@aida/shared/src/types/forecastPrimitives.ts`. The computation result type `ForecastItem` (currently defined in `useForecasting.ts`) is promoted to `@aida/shared/src/types/forecast.ts`. | |

### 1.1 Canonical `User` Type

```ts
// packages/shared/src/types/user.ts
export interface User {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Manager' | 'Staff' | 'Viewer'       // raw role stored in PB
  roles: UserRoles                                        // derived permission map (see §4)
}
```

### 1.2 Canonical `ForecastItem` Type

Move from `src/hooks/useForecasting.ts` (currently `export interface ForecastItem`) to `packages/shared/src/types/forecast.ts`. The shape is preserved exactly:

```ts
// packages/shared/src/types/forecast.ts
import type { ProjectionPoint } from './forecastPrimitives'

export interface ForecastItem {
  id: string | null
  inventoryItemIds: string[]
  name: string
  sku: string
  currentStock: number
  inboundQty: number
  effectiveStock: number
  velocityPerWeek: number
  salesVelocity: number | null
  inventoryVelocity: number | null
  velocitySource: 'sales' | 'inventory' | 'combined'
  discrepancyPct: number | null
  hasDiscrepancy: boolean
  weeksRemaining: number | null
  depletionDate: string | null
  reorderPoint: number
  trend: 'up' | 'down' | 'stable'
  confidence: 'high' | 'medium' | 'low' | 'none'
  status: 'CRITICAL' | 'WARNING' | 'NORMAL'
  vendorKeys: string[]
  vendorNames: string[]
  vendorLeadTimeWeeks: number
  vendorSafetyStockPct: number
  projection: ProjectionPoint[]
}
```

### 1.3 `@aida/shared` Index Barrel

`packages/shared/src/index.ts` re-exports everything:

```ts
// Types
export * from './types/user'
export * from './types/device'
export * from './types/component'
export * from './types/amazon'
export * from './types/history'
export * from './types/inbound'
export * from './types/inventory'
export * from './types/order'
export * from './types/refurbished'
export * from './types/rma'
export * from './types/shipment'
export * from './types/stock'
export * from './types/forecast'
export * from './types/forecastPrimitives'
export * from './types/vendor'

// API envelopes
export * from './api/auth'
export * from './api/inventory'
export * from './api/forecasting'
export * from './api/amazon'
export * from './api/rma'
export * from './api/shipments'
export * from './api/orders'

// Constants
export * from './constants/roles'
```

---

## 2. API Envelope Definitions

### 2.1 Auth (`packages/shared/src/api/auth.ts`)

```ts
import type { User } from '../types/user'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  // No token field — session is managed exclusively via HttpOnly cookies
}

export interface SessionResponse {
  user: User | null
}

// POST /api/auth/logout returns 204 No Content — no body type needed
```

### 2.2 Inventory (`packages/shared/src/api/inventory.ts`)

```ts
import type { DeviceItem } from '../types/device'
import type { ComponentItem } from '../types/component'

// Devices
export interface ListDevicesResponse {
  items: DeviceItem[]
  total: number
}

export interface GetDeviceResponse {
  item: DeviceItem
}

export interface CreateDeviceRequest {
  name: string
  sku: string
  barcode?: string
  warehouseStock?: number
  webStock?: number
  productionStock?: number
  reserveStock?: number
  onlineStock?: number
  location?: string
}

export interface UpdateDeviceRequest {
  name?: string
  sku?: string
  location?: string
  // Stock fields are mutated via /adjust, not PATCH
}

export interface AdjustStockRequest {
  field: 'warehouseStock' | 'webStock' | 'productionStock' | 'reserveStock' | 'onlineStock' | 'countedStock'
  delta: number
  note?: string
}

export interface AdjustStockResponse {
  item: DeviceItem
  event: {
    field: string
    oldValue: number
    newValue: number
    change: number
    created: string
  }
}

// Components follow the same pattern — omitted for brevity; same shape as device equivalents
export interface ListComponentsResponse {
  items: ComponentItem[]
  total: number
}
```

### 2.3 Forecasting (`packages/shared/src/api/forecasting.ts`)

```ts
import type { ForecastItem } from '../types/forecast'
import type { VendorConfig } from '../types/vendor'

export type ForecastMode = 'device' | 'component'

export interface GetForecastRequest {
  mode: ForecastMode
  // Query param: GET /api/forecasting?mode=device
}

export interface GetForecastResponse {
  mode: ForecastMode
  computedAt: string           // ISO timestamp — client can cache by this value
  items: ForecastItem[]
}

export interface GetVendorConfigsResponse {
  vendors: Record<string, VendorConfig>   // full shape — see §3.3 for VendorConfig
}
```

### 2.4 Amazon POs (`packages/shared/src/api/amazon.ts`)

```ts
import type { AmazonPO } from '../types/amazon'

export interface ListAmazonPOsResponse { items: AmazonPO[]; total: number }
export interface CreateAmazonPORequest { /* fields from AmazonPO minus id/created/updated */ }
export interface UpdateAmazonPORequest { /* partial AmazonPO fields */ }
```

### 2.5 RMA (`packages/shared/src/api/rma.ts`)

```ts
import type { RMARecord } from '../types/rma'

export interface ListRMAsResponse { items: RMARecord[]; total: number }
export interface CreateRMARequest { /* fields from RMARecord minus id/created/updated */ }
export interface UpdateRMARequest { /* partial RMARecord fields */ }
```

### 2.6 Inbound Shipments (`packages/shared/src/api/shipments.ts`)

```ts
import type { InboundShipment } from '../types/inbound'

export interface ListInboundResponse { items: InboundShipment[]; total: number }
export interface CreateInboundRequest { /* fields from InboundShipment */ }
export interface PushShipmentToInventoryResponse {
  pushed: number          // count of line items applied
  updatedDeviceIds: string[]
}
```

### 2.7 Orders / Refurbished (`packages/shared/src/api/orders.ts`)

```ts
import type { QuoteApprovedOrder } from '../types/order'
import type { RefurbishedDevice } from '../types/refurbished'

export interface ListQuoteApprovedResponse { items: QuoteApprovedOrder[]; total: number }
export interface CreateQuoteApprovedRequest { /* fields from QuoteApprovedOrder */ }

export interface ListRefurbishedResponse { items: RefurbishedDevice[]; total: number }
export interface CreateRefurbishedRequest { /* fields from RefurbishedDevice */ }
```

---

## 3. Forecasting Engine Migration

### 3.1 What moves and where

| Artifact | Source location | Target location |
|---|---|---|
| `forecastingEngine.ts` (all pure functions) | `src/lib/forecastingEngine.ts` | `packages/backend/src/lib/forecastingEngine.ts` |
| Utility types (`SaleRecord`, `StockHistoryRecord`, `ProjectionPoint`, `LOOKBACK_WEEKS`) | `src/types/forecast.ts` | `packages/shared/src/types/forecastPrimitives.ts` |
| `ForecastItem` interface | `src/hooks/useForecasting.ts` | `packages/shared/src/types/forecast.ts` |
| `vendorConfig.ts` — `VendorConfig` interface | `src/lib/vendorConfig.ts` | `packages/shared/src/types/vendor.ts` |
| `vendorConfig.ts` — `DEFAULT_VENDORS`, `getVendorsForSku`, `getVendorConfigs` | `src/lib/vendorConfig.ts` | `packages/backend/src/lib/vendorConfig.ts` |
| `useForecasting.ts` — computation loop | `src/hooks/useForecasting.ts` | `packages/backend/src/routes/forecasting.ts` (handler body) |
| `useForecasting.ts` — React hook wrapper | stays as `useForecasting.ts` | rewritten to call `GET /api/forecasting?mode=` (see §3.3) |

### 3.2 Backend Route: `GET /api/forecasting`

```
GET /api/forecasting?mode=device
Authorization: aida_session cookie (required)
RBAC: requireRole('Forecasting', 'Viewer')

Response 200:
{
  "mode": "device",
  "computedAt": "2026-05-07T14:22:00.000Z",
  "items": [ ...ForecastItem[] ]
}
```

The route handler:
1. Reads query param `mode` — validates it is `'device'` or `'component'`
2. Fetches all inventory records from PB via the admin singleton
3. Fetches `salesData` and `stockHistory` from PB via the admin singleton
4. Runs the `forecastingEngine` functions (velocity, depletion, reorder, confidence, projection)
5. Reads `DEFAULT_VENDORS` from `vendorConfig.ts` to enrich vendor fields
6. Returns `GetForecastResponse`

**The frontend never sees raw `salesData` or `stockHistory` records after migration.**

### 3.3 Frontend `useForecasting` After Migration

```ts
// packages/frontend/src/hooks/useForecasting.ts
import { useState, useEffect } from 'react'
import { apiClient } from '../lib/apiClient'
import type { ForecastItem, GetForecastResponse, ForecastMode } from '@aida/shared'

export function useForecasting(mode: ForecastMode) {
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<GetForecastResponse>(`/api/forecasting?mode=${mode}`)
      .then(res => setForecastItems(res.items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [mode])

  return { forecastItems, loading, error }
}
```

The velocity override stored in `localStorage` (`aida_velocity_override_*`) must be migrated to a backend-persisted preference (e.g., a `userPreferences` PB collection) or sent as a query param on the forecast request. This is a **known breaking change** — the current `localStorage`-based override silently disappears on migration. Address in Phase 3 before committing.

### 3.4 Vendor Config Split

```ts
// packages/shared/src/types/vendor.ts
export interface VendorConfig {
  name: string
  leadTimeWeeks: number
  safetyStockPct: number
  color: string
  poFormat: {
    prefix: string
    separator: string
    includeDate: boolean
    dateFormat: 'YYYYMMDD' | 'MMDD' | 'YYYY'
    includeSuffix: boolean
    customPattern: string | null
  }
}
```

Backend serves this via `GET /api/forecasting/vendor-configs → GetVendorConfigsResponse`. Frontend fetches on app load and stores in a `VendorConfigContext` (or top-level state). Components that currently import from `vendorConfig.ts` switch to reading from context.

---

## 4. RBAC Mapping

### 4.1 Role → Permission Matrix (source of truth)

Extracted from `src/context/AuthContext.tsx` `getUserRolesObject()`. This exact matrix becomes `packages/shared/src/constants/roles.ts`:

```ts
export type AppRole = 'Admin' | 'Manager' | 'Staff' | 'Viewer'
export type ModuleName = 'Inventory' | 'Forecasting' | 'Amazon' | 'Inbound Shipments' | 'RMA Tracker' | 'Orders' | 'Admin' | 'Profile'
export type PermissionLevel = 'Editor' | 'Viewer' | 'None'
export type UserRoles = Record<ModuleName, PermissionLevel>

export const ROLE_PERMISSIONS: Record<AppRole, UserRoles> = {
  Admin: {
    Inventory: 'Editor', Forecasting: 'Editor', Amazon: 'Editor',
    'Inbound Shipments': 'Editor', 'RMA Tracker': 'Editor', Orders: 'Editor',
    Admin: 'Editor', Profile: 'Editor',
  },
  Manager: {
    Inventory: 'Editor', Forecasting: 'Editor', Amazon: 'Editor',
    'Inbound Shipments': 'Editor', 'RMA Tracker': 'Editor', Orders: 'Editor',
    Admin: 'None', Profile: 'Editor',
  },
  Staff: {
    Inventory: 'Viewer', Forecasting: 'Viewer', Amazon: 'Viewer',
    'Inbound Shipments': 'Editor', 'RMA Tracker': 'Editor', Orders: 'Viewer',
    Admin: 'None', Profile: 'Editor',
  },
  Viewer: {
    Inventory: 'Viewer', Forecasting: 'Viewer', Amazon: 'Viewer',
    'Inbound Shipments': 'Viewer', 'RMA Tracker': 'Viewer', Orders: 'Viewer',
    Admin: 'None', Profile: 'Viewer',
  },
}
```

### 4.2 Backend `requireRole` Middleware

```ts
// packages/backend/src/middleware/rbac.ts
import type { Request, Response, NextFunction } from 'express'
import { ROLE_PERMISSIONS } from '@aida/shared'
import type { ModuleName, PermissionLevel } from '@aida/shared'

// requireRole checks that req.user (set by authMiddleware) has at least the
// required permission level for the given module.
// Permission hierarchy: Editor > Viewer > None
export function requireRole(module: ModuleName, required: PermissionLevel) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const actual = user.roles[module] ?? 'None'
    if (!hasPermission(actual, required)) {
      res.status(403).json({ error: `Forbidden: requires ${required} on ${module}` })
      return
    }
    next()
  }
}

function hasPermission(actual: PermissionLevel, required: PermissionLevel): boolean {
  const rank: Record<PermissionLevel, number> = { Editor: 2, Viewer: 1, None: 0 }
  return rank[actual] >= rank[required]
}
```

### 4.3 Route-Level RBAC Assignments

| Route | Method | Required role |
|---|---|---|
| `/api/inventory/devices` | GET | `Inventory: Viewer` |
| `/api/inventory/devices` | POST | `Inventory: Editor` |
| `/api/inventory/devices/:id` | PATCH | `Inventory: Editor` |
| `/api/inventory/devices/:id` | DELETE | `Inventory: Editor` |
| `/api/inventory/devices/:id/adjust` | POST | `Inventory: Editor` |
| `/api/forecasting` | GET | `Forecasting: Viewer` |
| `/api/forecasting/vendor-configs` | GET | `Forecasting: Viewer` |
| `/api/amazon/pos` | GET | `Amazon: Viewer` |
| `/api/amazon/pos` | POST, PATCH | `Amazon: Editor` |
| `/api/shipments/inbound` | GET | `Inbound Shipments: Viewer` |
| `/api/shipments/inbound` | POST | `Inbound Shipments: Editor` |
| `/api/shipments/inbound/:id/push` | POST | `Inbound Shipments: Editor` |
| `/api/rma` | GET | `RMA Tracker: Viewer` |
| `/api/rma` | POST, PATCH | `RMA Tracker: Editor` |
| `/api/orders/quote-approved` | GET | `Orders: Viewer` |
| `/api/orders/quote-approved` | POST, PATCH | `Orders: Editor` |
| `/api/refurbished` | GET | `Orders: Viewer` |
| `/api/refurbished` | POST, PATCH | `Orders: Editor` |
| `/api/users` | GET, PATCH | `Admin: Editor` |
| `/api/data/export` | GET | `Admin: Editor` |
| `/api/data/import` | POST | `Admin: Editor` |

### 4.4 `req.user` Type Augmentation

```ts
// packages/backend/src/types/express.d.ts
import type { User } from '@aida/shared'

declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}
```

`authMiddleware` verifies the `aida_session` JWT, looks up or reconstructs the `User` shape (id, name, email, role, roles), and attaches it to `req.user`. The `roles` map is derived server-side from `role` using `ROLE_PERMISSIONS` — it is NOT stored in the JWT to avoid stale permission data after role changes.

### 4.5 JWT Payload (minimal)

```ts
// Stored in aida_session cookie
interface AidaJwtPayload {
  sub: string      // user id
  email: string
  role: AppRole    // raw role — roles map is derived on each request
  iat: number
  exp: number
}
```

---

## 5. `AuthContext` Rewrite Contract

The frontend `AuthContext` after migration exposes no PocketBase types:

```ts
// packages/frontend/src/context/AuthContext.tsx
interface AuthContextType {
  user: User | null         // @aida/shared User, not RecordModel
  isLoggedIn: boolean
  userRoles: UserRoles | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadingAuth: boolean
  // pb: PocketBase  — REMOVED. Never exposed to the frontend again.
}
```

The `isAdmin` boolean parameter currently passed to `login()` is removed — the backend determines the correct auth path based on the users collection.

---

## 6. Velocity Override Migration

**Current behavior:** `localStorage.getItem('aida_velocity_override_<sku>')` stores `'sales' | 'inventory'` per SKU. The `useForecasting` hook reads this to weight velocity calculations.

**Target behavior options (choose one before Phase 3 begins):**

| Option | Complexity | Persistence |
|---|---|---|
| A. Send override as query param: `GET /api/forecasting?mode=device&overrides=sku1:sales,sku2:inventory` | Low | Session-only — lost on refresh |
| B. Store overrides in a `userPreferences` PocketBase collection via a new `PATCH /api/users/preferences` endpoint | Medium | Persistent across devices |
| C. Keep overrides in a cookie (`aida_overrides`) rather than localStorage | Low | Persists across refreshes, lost on logout |

**Recommended: Option B** — matches the "no localStorage" hard rule, keeps data on the server, and is consistent with the RBAC-per-user model. The `userPreferences` collection stores `{ userId, velocityOverrides: Record<string, 'sales' | 'inventory'> }`.

---

## 7. Known Breaking Changes

1. **`pb` removed from `AuthContext`** — any component that imports `pb` via `useAuth().pb` will fail to compile. Search: `useAuth().pb` and `pb.` in component files.
2. **`ForecastItem` import path changes** — currently `import { ForecastItem } from '../hooks/useForecasting'` becomes `import type { ForecastItem } from '@aida/shared'`.
3. **Velocity override localStorage** — disappears unless Option B is implemented in Phase 3.
4. **`isAdmin` login param** — callers of `login()` must remove the third boolean argument.
5. **Direct PB calls in any remaining hooks** — any hook not yet migrated by the QC pass that still calls `pb.collection(...)` directly will need updating.

---

## 8. Verification Checklist (Phase 5)

- [ ] `grep -r "pocketbase" packages/frontend/` returns zero matches outside `node_modules`
- [ ] `grep -r "VITE_PB_URL" packages/frontend/` returns zero matches
- [ ] `grep -r "localStorage" packages/frontend/src/` returns zero matches except non-auth usage
- [ ] `grep -r "useAuth().pb" packages/frontend/src/` returns zero matches
- [ ] `tsc --noEmit` passes across all three packages
- [ ] `GET /api/auth/session` returns `{ user: null }` with no active cookie
- [ ] Login sets `aida_session` and `aida_refresh` as `HttpOnly; Secure; SameSite=Strict`
- [ ] Forecasting tab populates from `/api/forecasting?mode=device` (verify via DevTools Network tab)
- [ ] Stock adjust creates a history record via `/api/inventory/devices/:id/adjust`
- [ ] Admin-only routes return 403 for `Staff` and `Viewer` role users
