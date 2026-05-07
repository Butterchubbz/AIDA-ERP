# Architecture Split Plan: AIDA Three-Package Monorepo

**Status:** Planning  
**Goal:** Decouple the frontend from PocketBase and all external APIs. The frontend speaks only to the AIDA backend. The backend owns all credentials, database access, and third-party integrations.

---

## Motivation

Currently `AuthContext.tsx` holds a live PocketBase client, `src/lib/pocketbase.ts` exposes a singleton PB instance to the entire frontend, and all hooks call PocketBase directly. This means:

- PocketBase's URL must be public (in `VITE_PB_URL`)
- Any future API keys (WooCommerce, shipping carriers, etc.) would leak into the browser bundle
- PocketBase's own auth token is managed client-side by the PB SDK and persisted in `localStorage` by default

The target architecture eliminates all of this from the frontend.

---

## Package Layout

The repository becomes an **npm workspaces monorepo** with three packages:

```
AIDA-ERP/
  package.json               ← workspace root (no app code)
  packages/
    shared/                  ← @aida/shared
      src/
        types/               ← all record interfaces (moved from src/types/)
        api/                 ← request/response envelope types
        constants/           ← shared enums and string literals
      package.json
      tsconfig.json

    backend/                 ← @aida/backend
      src/
        routes/              ← one file per domain
        middleware/          ← auth, RBAC, error handler
        lib/
          pocketbase.ts      ← PB admin client (server-side only)
          woocommerce.ts     ← WooCommerce REST client
        index.ts             ← Express entry point
      .env                   ← ALL secrets live here, never committed
      .env.example
      package.json
      tsconfig.json

    frontend/                ← @aida/frontend  (current src/ moves here)
      src/
        lib/
          apiClient.ts       ← replaces pocketbaseApi.ts; typed fetch wrapper
        context/
          AuthContext.tsx    ← rewritten; no PB SDK dependency
        hooks/               ← all hooks rewritten to call apiClient
        ...                  ← everything else unchanged in structure
      .env                   ← VITE_API_URL only; no PB URL, no keys
      package.json
      tsconfig.json
      vite.config.ts
```

---

## Package 1: `@aida/shared`

### Purpose
Single source of truth for types and API shapes consumed by both the frontend and backend. TypeScript only — no runtime dependencies except optionally `zod` for schema validation.

### Contents

#### `src/types/` — Record interfaces
Move the existing `src/types/*.ts` files here verbatim, with one change: remove any `import ... from 'pocketbase'` references. PocketBase's `RecordModel` base type is a backend concern only.

Files to migrate:
- `amazon.ts`, `component.ts`, `device.ts`, `forecast.ts`, `history.ts`
- `inbound.ts`, `inventory.ts`, `order.ts`, `refurbished.ts`
- `rma.ts`, `shipment.ts`, `stock.ts`, `user.ts`

The `User` type becomes:
```ts
// packages/shared/src/types/user.ts
export interface User {
  id: string
  name: string
  email: string
  roles: Record<string, string>
}
```

#### `src/api/` — Request/response envelopes
Typed shapes for every backend endpoint. The frontend and backend both import these to stay in sync.

```ts
// packages/shared/src/api/inventory.ts
export interface ListDevicesResponse {
  items: DeviceItem[]
}

export interface UpdateDeviceRequest {
  field: keyof DeviceItem
  delta: number
  note?: string
}

// packages/shared/src/api/auth.ts
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  // No token — the session is managed via httpOnly cookie
}

export interface SessionResponse {
  user: User | null
}
```

#### `src/constants/` — Shared literals
Role names, status enums, forecast mode strings. The role system currently defined in `AuthContext.tsx` moves here as a typed enum.

```ts
// packages/shared/src/constants/roles.ts
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
```

### Consumption Model

`@aida/shared` is consumed as **TypeScript source** within the monorepo. It is never compiled to `dist/` for local workspace use. Both consumers handle TS natively:
- Backend runs via `tsx`, which resolves and transpiles TS source directly
- Frontend runs via Vite, which also handles TS source natively

The workspace symlink (`packages/shared` → `@aida/shared` in `node_modules`) is established by `npm workspaces` automatically. No separate build step is needed during development.

If the package ever needs to be published to a registry or consumed outside the monorepo, run `npm run build` to produce `dist/`. **Before publishing, update `main`, `types`, and `exports` to point at `dist/` rather than `src/`.** That change is intentionally deferred — making it now would break the monorepo workspace resolution without adding any value.

### `package.json` (development / monorepo)

The manifest below is correct for workspace use. `main`, `types`, and `exports` all resolve to TS source — that is intentional and expected by `tsx` and Vite. A publish-ready manifest would change those three fields to `./dist/index.js` / `./dist/index.d.ts` / `{ import: './dist/index.js' }` after running `build`.

```json
{
  "name": "@aida/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsup src/index.ts --format esm,cjs --dts --out-dir dist"
  },
  "devDependencies": {
    "typescript": "^5",
    "tsup": "^8"
  }
}
```

---

## Package 2: `@aida/backend`

### Purpose
Express.js API server (TypeScript). The only process that holds PocketBase credentials, WooCommerce keys, or any other external service secrets. Exposes a REST API consumed by the frontend. Never deployed to a CDN — runs on a server or container.

### Authentication Architecture

The backend authenticates users against PocketBase on their behalf, then issues its own session to the frontend. The frontend never receives or stores the PocketBase token.

**PocketBase is persistence-only.** The backend is the sole actor in PocketBase. PocketBase's own user-level collection rules and row-level permissions are not relied upon — the AIDA backend's RBAC layer is the authority for all access control. This is a deliberate design decision; see [Design Decisions](#design-decisions) below.

**PocketBase client isolation (critical):** `lib/pocketbase.ts` on the backend creates a **single service/admin client** authenticated once at startup using `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`. This client is used for all database operations. `pb.authWithPassword()` is **never called** in request handlers — doing so would mutate the singleton's auth state and race across concurrent requests. User identity is validated entirely via the AIDA JWT; PocketBase never sees individual user sessions.

```ts
// packages/backend/src/lib/pocketbase.ts
import PocketBase from 'pocketbase'

const pb = new PocketBase(process.env.PB_URL)

// Authenticate once at startup as the service account.
// This client is shared across all requests. Never call
// pb.collection('users').authWithPassword() on this instance.
await pb.admins.authWithPassword(
  process.env.PB_ADMIN_EMAIL!,
  process.env.PB_ADMIN_PASSWORD!
)

export { pb }
```

**Login flow:**
1. Frontend `POST /api/auth/login` → `{ email, password }`
2. Backend uses the service `pb` client to fetch the matching user record from the `users` collection and verify the password via PocketBase's `authWithPassword` on a **throwaway per-request client** (not the singleton) — or validates credentials via PocketBase's auth API endpoint using a direct HTTP call that does not touch the singleton's auth state
3. On success, backend signs a short-lived **JWT** (15 min) containing `{ userId, email, roles }` and sets it as a `Secure; HttpOnly; SameSite=Strict` cookie named `aida_session`
4. Backend also issues a **refresh token** in a second HttpOnly cookie (`aida_refresh`, 7 days)
5. Frontend receives only the `LoginResponse` body containing the `User` shape — no raw token, no PB token

**Session refresh:**
- Every API request passes through `authMiddleware`
- If `aida_session` is valid, request proceeds
- If expired but `aida_refresh` is valid, backend silently re-issues both cookies
- If both expired, 401 is returned; frontend redirects to login

**Logout:**
- `POST /api/auth/logout` — backend clears both cookies; no client-side storage to clean up

### Environment Variables (backend `.env`)

```env
# PocketBase
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=...

# Session
JWT_SECRET=...          # long random string
JWT_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=7d

# WooCommerce (future)
WC_URL=https://store.example.com
WC_KEY=ck_...
WC_SECRET=cs_...

# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

**Nothing in this file is ever present in the frontend.**

### Route Structure

```
src/routes/
  auth.ts            POST /api/auth/login
                     POST /api/auth/logout
                     GET  /api/auth/session

  inventory.ts       GET    /api/inventory/devices
                     GET    /api/inventory/devices/:id
                     POST   /api/inventory/devices
                     PATCH  /api/inventory/devices/:id
                     DELETE /api/inventory/devices/:id
                     POST   /api/inventory/devices/:id/adjust   ← stock delta + event log

                     (same pattern for /components)

  shipments.ts       GET  /api/shipments/inbound
                     POST /api/shipments/inbound
                     POST /api/shipments/inbound/:id/push      ← pushShipmentToInventory

  amazon.ts          GET  /api/amazon/pos
                     POST /api/amazon/pos
                     PATCH /api/amazon/pos/:id

  rma.ts             GET   /api/rma
                     POST  /api/rma
                     PATCH /api/rma/:id

  forecasting.ts     GET /api/forecasting?mode=device|component
                     ← runs the forecastingEngine server-side and returns ForecastItem[]

  orders.ts          GET /api/orders/quote-approved
                     POST /api/orders/quote-approved
                     PATCH /api/orders/quote-approved/:id

  refurbished.ts     GET   /api/refurbished
                     POST  /api/refurbished
                     PATCH /api/refurbished/:id

  users.ts           GET   /api/users          ← Admin only
                     PATCH /api/users/:id

  data.ts            GET  /api/data/export     ← DataManagementView backup
                     POST /api/data/import
```

### Middleware Stack

```
src/middleware/
  auth.ts        ← verify aida_session JWT; attach req.user; refresh if needed
  rbac.ts        ← requireRole(module, level) — checks req.user.roles
  errorHandler.ts ← unified error response shape
```

Example RBAC usage:
```ts
router.patch(
  '/devices/:id',
  requireRole('Inventory', 'Editor'),
  updateDeviceHandler
)
```

### `forecastingEngine` Migration

`src/lib/forecastingEngine.ts` moves to the backend (`packages/backend/src/lib/forecastingEngine.ts`). The `/api/forecasting` endpoint runs the engine and returns serialized `ForecastItem[]`. The frontend hooks receive computed forecast data — they no longer load raw `salesData` and `stockHistory` records and compute locally.

`vendorConfig.ts` is **split** between `@aida/shared` and the backend:

**`@aida/shared/src/types/vendor.ts`** — the full public config shape the frontend needs for UX:
```ts
// All fields needed by ForecastingSettingsView, PurchaseOrderView, ForecastingWorkspace, etc.
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

**`packages/backend/src/lib/vendorConfig.ts`** — the `DEFAULT_VENDORS` map and any future private fields (webhook URLs, API keys per vendor). The backend serves the full `VendorConfig` payload via:

```
GET /api/forecasting/vendor-configs
→ { vendors: Record<string, VendorConfig> }
```

The frontend fetches this on mount and stores it in context. It does not hard-code any vendor data. This preserves all current frontend behavior (`ForecastingSettingsView`, PO generation, safety stock calculations) while keeping the authoritative vendor map server-side.

### Key Dependencies

```json
{
  "dependencies": {
    "express": "^4",
    "pocketbase": "^0.21",
    "jsonwebtoken": "^9",
    "cookie-parser": "^1",
    "cors": "^2",
    "zod": "^3",
    "@aida/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/express": "^4",
    "@types/jsonwebtoken": "^9",
    "tsx": "^4"
  }
}
```

---

## Package 3: `@aida/frontend`

### Purpose
The existing React + Vite application, moved from the repository root into `packages/frontend/`. The only structural changes are:

1. `src/lib/pocketbase.ts` — **deleted**
2. `src/lib/pocketbaseApi.ts` — **deleted**
3. `src/lib/collections.ts` — **deleted** (collection names are now a backend concern)
4. `src/lib/forecastingEngine.ts` — **deleted** (moved to backend)
5. `src/lib/vendorConfig.ts` — vendor config types move to `@aida/shared`; the full config with secrets moves to backend
6. `src/context/AuthContext.tsx` — **rewritten** (see below)
7. All hooks — PB calls replaced with `apiClient` calls (see below)
8. `src/types/*` — replaced with `import type { ... } from '@aida/shared'`

### Environment Variables (frontend `.env`)

```env
# Points to the backend API server only
VITE_API_URL=http://localhost:3001

# Optional
VITE_DEBUG=false
VITE_SENTRY_DSN=
```

No `VITE_PB_URL`. No keys. No secrets.

### `src/lib/apiClient.ts` (replaces pocketbaseApi.ts)

A thin typed `fetch` wrapper. Credentials are sent via cookies automatically (`credentials: 'include'`).

```ts
// packages/frontend/src/lib/apiClient.ts
const BASE = import.meta.env.VITE_API_URL

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',           // sends aida_session cookie
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    // Session expired — redirect to login
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const apiClient = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
}
```

### Rewritten `AuthContext.tsx`

```ts
// No PocketBase import. No token handling.
const login = async (email: string, password: string) => {
  const res = await apiClient.post<LoginResponse>('/api/auth/login', { email, password })
  setUser(res.user)
}

const logout = async () => {
  await apiClient.post('/api/auth/logout', {})
  setUser(null)
}

// On mount, check existing session via cookie
useEffect(() => {
  apiClient.get<SessionResponse>('/api/auth/session')
    .then(r => setUser(r.user))
    .catch(() => setUser(null))
    .finally(() => setLoadingAuth(false))
}, [])
```

No `localStorage`. No `pb.authStore`. The session is entirely managed via HttpOnly cookies.

### Hook Migration Pattern

Every hook that currently calls `listRecords`, `createRecord`, etc. switches to `apiClient`:

```ts
// BEFORE
const devices = await listRecords<DeviceItem>(COLLECTIONS.INVENTORY_DEVICE)

// AFTER
const { items } = await apiClient.get<ListDevicesResponse>('/api/inventory/devices')
```

The `useCollectionCrud` factory is replaced by a new `useApiCollection<T>` factory that calls `apiClient` instead of the PocketBase helpers. The hook surface (`items`, `createItem`, `updateItem`, `removeItem`, `refetch`, `loading`, `error`) remains identical so consuming components require no changes.

---

## Migration Strategy

### Phase 0 — Monorepo Setup
- Add `package.json` workspace root with `"workspaces": ["packages/*"]`
- Create `packages/shared/`, `packages/backend/`, `packages/frontend/` directories
- Move current repo root app files into `packages/frontend/`
- Configure workspace-level `tsc` composite build

### Phase 1 — Shared Package
- Move all `src/types/*.ts` into `packages/shared/src/types/`
- Strip `pocketbase` import from `user.ts`
- Add API envelope types for each domain
- Add shared role/permission constants
- Update frontend imports: `from '../types/device'` → `from '@aida/shared'`

### Phase 2 — Backend Scaffold
- Initialize `packages/backend/` with Express + TypeScript
- Implement `authMiddleware` and `rbacMiddleware`
- Implement `/api/auth/*` routes backed by PocketBase server-side auth
- Verify cookie flow end-to-end with the frontend login screen

### Phase 3 — Backend Routes (domain by domain)
Implement one domain at a time, parallel-testing against the frontend:

1. **Inventory** (devices + components)
2. **RMA Tracker**
3. **Inbound Shipments**
4. **Amazon POs**
5. **Quote Approved Orders / Refurbished**
6. **Forecasting** (move `forecastingEngine` to backend)
7. **Users / Data Management**

### Phase 4 — Frontend Migration
For each domain implemented in Phase 3:
- Update the corresponding hook to call `apiClient` instead of `listRecords`/`createRecord`
- Remove the domain's PocketBase calls from the frontend
- Delete `pocketbaseApi.ts` imports incrementally

### Phase 5 — Cleanup
- Delete `src/lib/pocketbase.ts` (frontend)
- Delete `src/lib/pocketbaseApi.ts` (frontend)
- Delete `src/lib/collections.ts` (frontend)
- Delete `pocketbase` npm dependency from frontend `package.json`
- Verify `VITE_PB_URL` is gone from all frontend env files
- Run full `tsc --noEmit` across all three packages

---

## Security Properties After Migration

| Property | Before | After |
|---|---|---|
| PocketBase URL | Public (VITE_PB_URL in browser) | Backend-only env |
| PocketBase admin credentials | N/A (used client SDK) | Backend-only env |
| WooCommerce API keys | Would leak into bundle | Backend-only env |
| Auth token storage | PocketBase SDK (localStorage) | HttpOnly cookie, inaccessible to JS |
| Session persistence | `pb.authStore` (localStorage) | Secure cookie; refresh handled server-side |
| Credential exposure surface | Any XSS could steal PB token | XSS cannot read HttpOnly cookies |
| CSRF | N/A (token auth) | **Required:** `Origin` header validation on all state-mutating routes + `SameSite=Strict` as defense-in-depth (see CSRF policy below) |

### CSRF Policy

`SameSite=Strict` alone is insufficient if the deployment topology ever changes (different subdomains, reverse proxy relaxation, load balancer). The required baseline is **Origin header validation** enforced by middleware on all state-mutating methods (POST, PATCH, DELETE, PUT).

```ts
// packages/backend/src/middleware/csrf.ts
import type { Request, Response, NextFunction } from 'express'

// Must be the exact origin (scheme + host + port), e.g. "https://app.aida.example.com".
// startsWith() is NOT used — it allows prefix-spoofing attacks.
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN

function parseOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin  // normalised: scheme + host + port, no path
  } catch {
    return null
  }
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  const safe = ['GET', 'HEAD', 'OPTIONS']
  if (safe.includes(req.method)) return next()

  // Prefer the Origin header; fall back to Referer only when Origin is absent
  // (some browsers omit Origin on same-origin form POSTs).
  const raw = (req.headers['origin'] ?? req.headers['referer']) as string | undefined
  const requestOrigin = raw ? parseOrigin(raw) : null

  if (!requestOrigin || requestOrigin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: 'Forbidden: invalid origin' })
    return
  }
  next()
}
```

**Why `new URL(raw).origin` instead of `startsWith`:** a prefix match accepts `https://app.example.com.attacker.tld` because it starts with `https://app.example.com`. Parsing to a URL and comparing `.origin` (scheme + host + port, path stripped) eliminates the prefix-spoofing class entirely. The `parseOrigin` helper returns `null` for malformed values rather than throwing, so the guard fails closed.

This middleware is applied globally before all routes. `SameSite=Strict` is retained as defense-in-depth. Both must be present; neither is optional. If the frontend and backend land on different origins in production, upgrade to synchronizer CSRF tokens at that point — document it as a known future work item at that time, not before.

---

## Design Decisions

### PocketBase as persistence-only

The backend treats PocketBase purely as a managed database. PocketBase's own collection rules, row-level API rules, and user auth system are **not used to enforce access control**. The AIDA Express backend is the sole enforcement point. Rationale:
- Avoids split-brain authorization (two separate rule systems that must stay in sync)
- PocketBase's API rules are not expressive enough for the module/role matrix already defined in the app
- The decoupling goal (frontend does not speak to PocketBase directly) only makes sense if the backend owns authorization completely

### `@aida/shared` consumption model

Source-consumed in the monorepo during all development and production builds. Both `tsx` (backend) and Vite (frontend) transpile TypeScript natively, so no separate compilation of `@aida/shared` is needed. The workspace symlink makes `import type { DeviceItem } from '@aida/shared'` resolve to `packages/shared/src/index.ts` at all times.

If a future requirement emerges to publish `@aida/shared` to a registry or consume it outside the monorepo, run `npm run build` in `packages/shared/` to produce `dist/`. Until then, the `build` script exists but is not part of the CI pipeline.

---

## Rules for Future Sessions

Once this migration is complete, the following are **hard rules**:

1. **No `pocketbase` npm package in `packages/frontend/`** — if it reappears, remove it.
2. **No `VITE_PB_URL`, `VITE_PB_*`, or any API key in frontend env** — frontend env contains only `VITE_API_URL`.
3. **No `localStorage` for auth** — auth state lives in cookies and React context only.
4. **All new API keys go in `packages/backend/.env`** — never in the frontend.
5. **New data domains follow the pattern:** shared type in `@aida/shared`, route in backend, `apiClient` call in frontend hook.
6. **`useApiCollection<T>` is the hook factory** — same surface as `useCollectionCrud` but calls the backend API.
