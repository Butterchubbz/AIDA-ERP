# Migration Technical Addendum

**Status:** Approved — supplements `docs/migration_spec.md`  
**Covers:** Option B velocity override persistence, vendor config full lifecycle, `VendorConfigContext` design, PocketBase v0.26 admin API note.

---

## A. `userPreferences` PocketBase Collection

### A.1 Purpose

Replaces all `localStorage`-based user-specific settings:

| Current localStorage key | Moved to |
|---|---|
| `aida_velocity_override_<sku>` | `userPreferences.velocityOverrides` |
| `aida_vendor_configs_<mode>` | `userPreferences.vendorConfigs` |
| `aida_sku_vendor_map_<mode>` | `userPreferences.skuVendorMap` |

### A.2 Collection Schema

```
Collection: userPreferences
Type: base (not auth)

Fields:
  userId         Relation → users (required, unique index)
  velocityOverrides  JSON   default: {}
  vendorConfigs      JSON   default: {}
  skuVendorMap       JSON   default: {}
  updated        Auto-date (PB managed)
```

**JSON field shapes:**

```ts
// velocityOverrides
Record<string, 'sales' | 'inventory'>   // keyed by SKU

// vendorConfigs
Record<string, VendorConfig>            // keyed by vendorKey; empty = use server defaults

// skuVendorMap
Record<string, string[]>                // sku → vendorKey[]
```

### A.3 Backend API Endpoints

```
GET  /api/users/preferences
     → UserPreferences (full object for the authenticated user)
     Creates a default record if none exists.

PATCH /api/users/preferences
     Body: Partial<{ velocityOverrides, vendorConfigs, skuVendorMap }>
     → UserPreferences (updated)
     Deep-merges the supplied fields; does not clobber unmodified keys.
     RBAC: any authenticated user (their own prefs only)
```

`UserPreferences` shared type:

```ts
// packages/shared/src/api/preferences.ts
import type { VendorConfig } from '../types/vendor'

export interface UserPreferences {
  userId: string
  velocityOverrides: Record<string, 'sales' | 'inventory'>
  vendorConfigs: Record<string, VendorConfig>    // {} = use server defaults
  skuVendorMap: Record<string, string[]>
}

export interface UpdatePreferencesRequest {
  velocityOverrides?: Record<string, 'sales' | 'inventory'>
  vendorConfigs?: Record<string, VendorConfig>
  skuVendorMap?: Record<string, string[]>
}
```

Add `export * from './api/preferences'` to `packages/shared/src/index.ts`.

---

## B. Forecasting Route with Overrides

### B.1 Full Handler Flow

```
GET /api/forecasting?mode=device
Auth: aida_session cookie required
RBAC: requireRole('Forecasting', 'Viewer')
```

```ts
// packages/backend/src/routes/forecasting.ts (handler body)

import { pb } from '../lib/pocketbase'
import { DEFAULT_VENDORS } from '../lib/vendorConfig'
import { computeForecast } from '../lib/forecastingEngine'
import type { Request, Response } from 'express'
import type { GetForecastResponse, ForecastMode } from '@aida/shared'

export async function getForecast(req: Request, res: Response) {
  const mode = req.query.mode as string
  if (mode !== 'device' && mode !== 'component') {
    res.status(400).json({ error: 'mode must be "device" or "component"' })
    return
  }

  const userId = req.user!.id

  // 1. Fetch user preferences (velocity overrides + sku-vendor map)
  const prefsRecords = await pb.collection('userPreferences')
    .getList(1, 1, { filter: `userId = "${userId}"` })
  const prefs = prefsRecords.items[0] ?? {
    velocityOverrides: {},
    vendorConfigs: {},
    skuVendorMap: {},
  }

  // 2. Resolve effective vendor configs:
  //    user customizations overlay the server defaults
  const effectiveVendors = {
    ...DEFAULT_VENDORS,
    ...prefs.vendorConfigs,   // user overrides win
  }

  // 3. Fetch raw inventory + sales data via admin singleton
  const [inventoryRecords, salesRecords, historyRecords, inboundRecords] =
    await Promise.all([
      pb.collection(mode === 'device' ? 'inventoryDevice' : 'inventoryComponent')
        .getFullList({ sort: 'name' }),
      pb.collection('salesData').getFullList(),
      pb.collection('stockHistory').getFullList(),
      pb.collection('inboundShipments').getFullList({
        filter: 'status != "Received"',
      }),
    ])

  // 4. Run engine (pure functions — no PB dependency)
  const items = computeForecast({
    mode: mode as ForecastMode,
    inventoryRecords,
    salesRecords,
    historyRecords,
    inboundRecords,
    vendorConfigs: effectiveVendors,
    skuVendorMap: prefs.skuVendorMap,
    velocityOverrides: prefs.velocityOverrides,
  })

  const response: GetForecastResponse = {
    mode: mode as ForecastMode,
    computedAt: new Date().toISOString(),
    items,
  }

  res.json(response)
}
```

### B.2 `computeForecast` Signature

The existing `useForecasting` computation loop is extracted into a pure function:

```ts
// packages/backend/src/lib/forecastingEngine.ts (exported function)
import type { ForecastItem, ForecastMode, VendorConfig } from '@aida/shared'

export interface ComputeForecastOptions {
  mode: ForecastMode
  inventoryRecords: unknown[]
  salesRecords: unknown[]
  historyRecords: unknown[]
  inboundRecords: unknown[]
  vendorConfigs: Record<string, VendorConfig>
  skuVendorMap: Record<string, string[]>
  velocityOverrides: Record<string, 'sales' | 'inventory'>
}

export function computeForecast(opts: ComputeForecastOptions): ForecastItem[] {
  // Body: the existing useForecasting.ts computation loop,
  // translated from React hook state mutations to a pure array-returning function.
  // All calls to calcSalesVelocity, calcInventoryVelocity, calcCombinedVelocity,
  // calcDepletionDate, calcReorderPoint, calcConfidence, projectFutureSales
  // remain unchanged — those functions are imported from forecastingEngine.ts.
}
```

The velocity override logic that currently lives in `getSignalOverride()` (reading localStorage) moves into `computeForecast` as a parameter lookup: `velocityOverrides[sku]`.

### B.3 Frontend Hook After Migration

```ts
// packages/frontend/src/hooks/useForecasting.ts
import { useState, useEffect } from 'react'
import { apiClient } from '../lib/apiClient'
import { usePreferences } from '../context/PreferencesContext'
import type { ForecastItem, GetForecastResponse, ForecastMode } from '@aida/shared'

export function useForecasting(mode: ForecastMode) {
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { preferences } = usePreferences()

  useEffect(() => {
    setLoading(true)
    // Overrides are persisted server-side; the backend reads them from userPreferences.
    // No override query param needed — the server already knows the user's preferences.
    apiClient
      .get<GetForecastResponse>(`/api/forecasting?mode=${mode}`)
      .then(res => setForecastItems(res.items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [mode, preferences.velocityOverrides])  // re-fetch when overrides change
  // (preferences are invalidated after PATCH /api/users/preferences succeeds)

  return { forecastItems, loading, error }
}
```

---

## C. `VendorConfigContext`

### C.1 Problem Statement

`src/lib/vendorConfig.ts` currently serves two roles:
1. **Provides defaults** (`DEFAULT_VENDORS`) — static data, moves to backend
2. **Provides user-customized configs** — read/write from localStorage, moves to `userPreferences`

After migration, the frontend reads vendor configs from `UserPreferences.vendorConfigs` (merged with server defaults by the backend). The `VendorConfigContext` is the bridge.

### C.2 Context Definition

```ts
// packages/frontend/src/context/VendorConfigContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { VendorConfig, GetVendorConfigsResponse } from '@aida/shared'
import { apiClient } from '../lib/apiClient'

interface VendorConfigContextType {
  /** Effective vendor map: server defaults merged with user customizations.
   *  Fetched once on app load from GET /api/forecasting/vendor-configs.
   *  Keys are vendorKey strings (e.g. "memory", "storage"). */
  vendors: Record<string, VendorConfig>
  /** True while the initial fetch is in flight. */
  loading: boolean
  /** Save a full vendor map customization to the user's server-side preferences.
   *  Triggers a re-fetch to reflect the saved state. */
  saveVendors: (updated: Record<string, VendorConfig>) => Promise<void>
}

const VendorConfigContext = createContext<VendorConfigContextType | undefined>(undefined)

export function VendorConfigProvider({ children }: { children: React.ReactNode }) {
  const [vendors, setVendors] = useState<Record<string, VendorConfig>>({})
  const [loading, setLoading] = useState(true)

  const fetchVendors = useCallback(async () => {
    const res = await apiClient.get<GetVendorConfigsResponse>(
      '/api/forecasting/vendor-configs'
    )
    setVendors(res.vendors)
  }, [])

  useEffect(() => {
    fetchVendors().finally(() => setLoading(false))
  }, [fetchVendors])

  const saveVendors = useCallback(
    async (updated: Record<string, VendorConfig>) => {
      await apiClient.patch('/api/users/preferences', { vendorConfigs: updated })
      await fetchVendors()   // re-fetch to confirm saved state from server
    },
    [fetchVendors]
  )

  return (
    <VendorConfigContext.Provider value={{ vendors, loading, saveVendors }}>
      {children}
    </VendorConfigContext.Provider>
  )
}

export function useVendorConfig(): VendorConfigContextType {
  const ctx = useContext(VendorConfigContext)
  if (!ctx) throw new Error('useVendorConfig must be used inside VendorConfigProvider')
  return ctx
}
```

### C.3 Provider Placement

`VendorConfigProvider` wraps the app inside `AuthProvider` (vendors are only fetched when authenticated):

```tsx
// packages/frontend/src/main.tsx or App.tsx
<AuthProvider>
  <VendorConfigProvider>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </VendorConfigProvider>
</AuthProvider>
```

Fetch is deferred until after `loadingAuth = false` to avoid a 401 race on initial load. The simplest approach is to render `VendorConfigProvider` only when `isLoggedIn` is true (inside the auth guard).

### C.4 Component Migration

Components that currently import from `vendorConfig.ts` switch to `useVendorConfig()`:

| Current import | After migration |
|---|---|
| `import { getVendorConfigs } from '../lib/vendorConfig'` | `const { vendors } = useVendorConfig()` |
| `import { saveVendorConfigs } from '../lib/vendorConfig'` | `const { saveVendors } = useVendorConfig()` |
| `import { DEFAULT_VENDORS } from '../lib/vendorConfig'` | `const { vendors } = useVendorConfig()` (same — server merges defaults) |
| `import { getSkuVendorMap } from '../lib/vendorConfig'` | `const { preferences } = usePreferences()` → `preferences.skuVendorMap` |

### C.5 `PreferencesContext` (companion context)

The full `userPreferences` object (including `velocityOverrides` and `skuVendorMap`) lives in a companion `PreferencesContext`:

```ts
// packages/frontend/src/context/PreferencesContext.tsx
import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import type { UserPreferences, UpdatePreferencesRequest } from '@aida/shared'
import { apiClient } from '../lib/apiClient'

interface PreferencesContextType {
  preferences: UserPreferences
  updatePreferences: (patch: UpdatePreferencesRequest) => Promise<void>
  loading: boolean
}

const defaultPrefs: UserPreferences = {
  userId: '',
  velocityOverrides: {},
  vendorConfigs: {},
  skuVendorMap: {},
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPrefs)
  const [loading, setLoading] = useState(true)

  const fetchPreferences = useCallback(async () => {
    const prefs = await apiClient.get<UserPreferences>('/api/users/preferences')
    setPreferences(prefs)
  }, [])

  useEffect(() => {
    fetchPreferences().finally(() => setLoading(false))
  }, [fetchPreferences])

  const updatePreferences = useCallback(
    async (patch: UpdatePreferencesRequest) => {
      const updated = await apiClient.patch<UserPreferences>(
        '/api/users/preferences',
        patch
      )
      setPreferences(updated)
    },
    []
  )

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, loading }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
```

---

## D. PocketBase v0.26 Admin API Note

In PocketBase JavaScript SDK **v0.21+**, the `pb.admins` property was deprecated. In **v0.23+** it was removed from the server-side admin panel interface; the SDK shim may still exist but behaviour varies.

For PocketBase server **v0.23+** with SDK **v0.21+**, use:

```ts
// packages/backend/src/lib/pocketbase.ts
import PocketBase from 'pocketbase'

const pb = new PocketBase(process.env.PB_URL)

// For PB server < 0.23 (admin collection):
// await pb.admins.authWithPassword(email, password)

// For PB server >= 0.23 (superusers collection):
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL!,
  process.env.PB_ADMIN_PASSWORD!
)

export { pb }
```

**Verify before Phase 3:** run `pb serve --version` and check the installed server version. If < 0.23, use `pb.admins.authWithPassword`. If >= 0.23, use `pb.collection('_superusers').authWithPassword`. The current `package.json` pins `"pocketbase": "^0.26"` for the SDK — this is compatible with both server versions but the auth call path differs.

For login validation (throwaway instance), the same version check applies:

```ts
// Throwaway instance for credential validation only
const throwaway = new PocketBase(process.env.PB_URL)
await throwaway.collection('users').authWithPassword(email, password)
// throwaway is discarded; do not export or cache it
```

This is safe regardless of PB server version — user auth via `pb.collection('users')` is unchanged in all versions.

---

## E. `GET /api/forecasting/vendor-configs` — Full Spec

```
GET /api/forecasting/vendor-configs
Auth: aida_session cookie required
RBAC: requireRole('Forecasting', 'Viewer')

Response 200:
{
  "vendors": {
    "memory": { "name": "Memory", "leadTimeWeeks": 2, "safetyStockPct": 0.2, ... },
    "storage": { ... },
    ...
  }
}
```

Handler:

```ts
export async function getVendorConfigs(req: Request, res: Response) {
  const userId = req.user!.id

  // Fetch user's saved customizations
  const prefsRecords = await pb.collection('userPreferences')
    .getList(1, 1, { filter: `userId = "${userId}"` })
  const savedVendorConfigs = prefsRecords.items[0]?.vendorConfigs ?? {}

  // Merge: server defaults first, user overrides on top
  const effective = { ...DEFAULT_VENDORS, ...savedVendorConfigs }

  res.json({ vendors: effective })
}
```

This means `VendorConfigContext` always sees the merged result — the frontend never needs to merge defaults itself.

---

## F. Full localStorage Removal Inventory

All `localStorage` calls in the frontend after migration:

| Current call | Replaces with |
|---|---|
| `localStorage.getItem('aida_velocity_override_<sku>')` | `usePreferences().preferences.velocityOverrides[sku]` |
| `localStorage.setItem('aida_velocity_override_<sku>', ...)` | `usePreferences().updatePreferences({ velocityOverrides: { ...existing, [sku]: value } })` |
| `localStorage.getItem('aida_vendor_configs_<mode>')` | `useVendorConfig().vendors` |
| `localStorage.setItem('aida_vendor_configs_<mode>', ...)` | `useVendorConfig().saveVendors(updated)` |
| `localStorage.getItem('aida_sku_vendor_map_<mode>')` | `usePreferences().preferences.skuVendorMap` |
| `localStorage.setItem('aida_sku_vendor_map_<mode>', ...)` | `usePreferences().updatePreferences({ skuVendorMap: updated })` |

After migration, `grep -r "localStorage" packages/frontend/src/` must return zero matches.
