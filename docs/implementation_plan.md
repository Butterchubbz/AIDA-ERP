# Implementation Plan: Three-Package Monorepo Migration

**Sources:** `docs/migration_spec.md`, `docs/migration_addendum.md`  
**Status:** Awaiting go-ahead  
**Approval Criteria:** `tsc --noEmit` passes across all three packages; GPT-5 Security Audit passes all checklist items; verification grep checks return zero matches.

> **Active guardrails throughout all phases**
> - `localStorage` forbidden for auth and user preferences — all state is server-persisted or cookie-based
> - Backend `pb` singleton never calls `authWithPassword()` in a request handler
> - All frontend type imports point to `@aida/shared`
> - No `pocketbase` npm package in `packages/frontend/`

---

## Agent Assignment Overview

| Agent | Role | Phases |
|---|---|---|
| GPT-4.1 | The Intern | 0 — Scaffold, 1 — Type migration |
| Claude Haiku | The Junior | 1 — API envelopes, 2 — apiClient + env cleanup |
| Claude Sonnet | The Senior | 3 — Backend core, 4 — Domain routes, 5 — Cleanup |
| GPT-5 | The Auditor | Post-Phase 3 — Security & CSRF Audit |

---

## Phase 0 — Monorepo Scaffold
**Agent:** GPT-4.1 (The Intern)

### 0.1 — Workspace root `package.json`

Replace the current root `package.json` (which moves to `packages/frontend/package.json`):

```json
{
  "name": "aida-erp-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=packages/frontend",
    "build": "npm run build --workspace=packages/frontend",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "start:backend": "npm run dev --workspace=packages/backend"
  }
}
```

### 0.2 — Directory layout

Create the following (empty, `.gitkeep`):
```
packages/shared/src/types/
packages/shared/src/api/
packages/shared/src/constants/
packages/backend/src/routes/
packages/backend/src/middleware/
packages/backend/src/lib/
packages/backend/src/types/
packages/frontend/    ← app content moves here
```

### 0.3 — `packages/shared/package.json` (development/monorepo)

```json
{
  "name": "@aida/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "default": "./src/index.ts" } },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsup src/index.ts --format esm,cjs --dts --out-dir dist"
  },
  "devDependencies": { "typescript": "^5", "tsup": "^8" }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "declaration": true, "outDir": "dist", "rootDir": "src"
  },
  "include": ["src"]
}
```

Create empty `packages/shared/src/index.ts`.

### 0.4 — `packages/backend/package.json`

```json
{
  "name": "@aida/backend", "version": "1.0.0", "private": true, "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4", "pocketbase": "^0.26", "jsonwebtoken": "^9",
    "cookie-parser": "^1", "cors": "^2", "zod": "^3", "@aida/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5", "@types/express": "^4", "@types/jsonwebtoken": "^9",
    "@types/cookie-parser": "^1", "@types/cors": "^2", "tsx": "^4"
  }
}
```

`packages/backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "outDir": "dist", "rootDir": "src"
  },
  "include": ["src"]
}
```

### 0.5 — Move frontend

Move current root app files into `packages/frontend/`. Update `packages/frontend/package.json`:
- `"name": "@aida/frontend"`
- Add `"@aida/shared": "*"` to `dependencies`

### 0.6 — Verify

`npm install` at workspace root. Confirm three workspace symlinks exist in `node_modules/`.

**Completion signal:** `npm install` succeeds.

---

## Phase 1 — Shared Package: Types, Envelopes, Constants
**Agent:** GPT-4.1 (The Intern) for type migration; Claude Haiku (The Junior) for envelopes

### 1.1 — Migrate `src/types/` → `packages/shared/src/types/`

Copy all 13 type files. For each, strip any `import ... from 'pocketbase'` line and replace `RecordModel`-based fields with `id: string`.

Special cases:
- `user.ts` — **rewrite** to canonical `User` interface (migration spec §1.1)
- `forecast.ts` — **split** into `forecastPrimitives.ts` (SaleRecord, StockHistoryRecord, ProjectionPoint, LOOKBACK_WEEKS, utility functions) and `forecast.ts` (ForecastItem interface — migration spec §1.2)

### 1.2 — Add `vendor.ts` and `roles.ts`

- `packages/shared/src/types/vendor.ts` — `VendorConfig` interface (migration spec §3.4)
- `packages/shared/src/constants/roles.ts` — `AppRole`, `ModuleName`, `PermissionLevel`, `UserRoles`, `ROLE_PERMISSIONS` (migration spec §4.1)

### 1.3 — Add API envelope types

One file per domain in `packages/shared/src/api/`:
- `auth.ts` (§2.1), `inventory.ts` (§2.2), `forecasting.ts` (§2.3)
- `amazon.ts` (§2.4), `rma.ts` (§2.5), `shipments.ts` (§2.6), `orders.ts` (§2.7)
- `preferences.ts` (addendum §A.3) — `UserPreferences`, `UpdatePreferencesRequest`

### 1.4 — Wire the barrel

Populate `packages/shared/src/index.ts` with full re-export list (migration spec §1.3 + `export * from './api/preferences'`).

### 1.5 — Update frontend imports

Mechanical find-and-replace: all `import ... from '../types/...'` in `packages/frontend/src/` → `import type { ... } from '@aida/shared'`.

### 1.6 — tsc + stage

```
tsc --noEmit   # in packages/shared and packages/frontend
git add packages/shared/ packages/frontend/src/
```

**Completion signal:** `tsc --noEmit` passes in both packages.

---

## Phase 2 — Frontend: apiClient + Environment Cleanup
**Agent:** Claude Haiku (The Junior)

### 2.1 — `packages/frontend/src/lib/apiClient.ts`

Typed fetch wrapper (split_architecture_plan.md §3):
- `credentials: 'include'` on every request
- 401 → `window.location.href = '/login'` + throw
- Non-OK → parse JSON error body, throw with `err.message`
- Exports: `apiClient.get`, `.post`, `.patch`, `.delete`

### 2.2 — Rewrite `AuthContext.tsx`

Remove all PB imports. New interface (migration spec §5):
- `user: User | null` (from `@aida/shared`, not `RecordModel`)
- Remove `pb` from context value — permanently gone
- Remove `isAdmin` param from `login()`
- On mount: `GET /api/auth/session`
- `login()`: `POST /api/auth/login`
- `logout()`: `POST /api/auth/logout`

### 2.3 — Add `VendorConfigContext` and `PreferencesContext`

Create both contexts exactly as specified in addendum §C.2 and §C.5. Wrap in `App.tsx` per addendum §C.3 — both providers are children of `AuthProvider`, rendered only when `isLoggedIn`.

### 2.4 — Remove all `localStorage` calls

Replace every `localStorage` usage per addendum §F:
- Velocity overrides → `usePreferences()`
- Vendor configs → `useVendorConfig()`
- SKU vendor map → `usePreferences()`

### 2.5 — Remove PocketBase from frontend

- Delete `VITE_PB_URL` from all `.env*` files in `packages/frontend/`
- Add `VITE_API_URL=http://localhost:3001` to `packages/frontend/.env.example`
- Remove `"pocketbase"` from `packages/frontend/package.json`
- Run `npm install` at workspace root

### 2.6 — tsc + stage

```
tsc --noEmit   # in packages/frontend
grep -r "pocketbase" packages/frontend/src/      # must return zero
grep -r "localStorage" packages/frontend/src/    # must return zero
git add packages/frontend/
```

**Completion signal:** Both greps return zero. `tsc --noEmit` passes.

---

## Security & CSRF Audit (GPT-5)
**Blocks Phase 3 commit. All items must pass.**

**Files in scope:**
- `packages/backend/src/middleware/csrf.ts`
- `packages/backend/src/middleware/auth.ts`
- `packages/backend/src/routes/auth.ts`
- `packages/frontend/src/lib/apiClient.ts`
- `packages/frontend/src/context/AuthContext.tsx`

**Checklist:**

| # | Check | Pass criteria |
|---|---|---|
| 1 | CSRF origin parsing | `csrfOriginGuard` uses `new URL(raw).origin` (not `startsWith`); fails closed on malformed/missing origin |
| 2 | CSRF scope | Guard applied globally in `index.ts` before all routes |
| 3 | Cookie attributes | `aida_session` and `aida_refresh` both set with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` |
| 4 | Cookie lifetime | `MaxAge` matches `JWT_EXPIRES_IN` (15 min) and `REFRESH_EXPIRES_IN` (7d) respectively |
| 5 | JWT algorithm | `jsonwebtoken.verify()` called with `{ algorithms: ['HS256'] }` — no algorithm confusion |
| 6 | PB singleton isolation | Singleton `pb` export never calls `authWithPassword()` in any request handler |
| 7 | Login throwaway | Login route creates `new PocketBase(...)` per-request for credential validation; instance not exported |
| 8 | Frontend PB removal | `packages/frontend/src/` contains zero `pocketbase` imports; no `VITE_PB_URL` in any `.env*` |
| 9 | Input validation | Login body validated with zod before touching PocketBase |
| 10 | `credentials: 'include'` | `apiClient.ts` sends `credentials: 'include'` on every request method |

**Output:** Written finding per item. Any failure blocks the commit.

---

## Phase 3 — Backend Core
**Agent:** Claude Sonnet (The Senior)

### 3.1 — PocketBase admin singleton (`packages/backend/src/lib/pocketbase.ts`)

**Check PB server version first** (addendum §D):
- PB server < 0.23: use `pb.admins.authWithPassword(...)`
- PB server ≥ 0.23: use `pb.collection('_superusers').authWithPassword(...)`

```ts
import PocketBase from 'pocketbase'
const pb = new PocketBase(process.env.PB_URL)
// For PB >= 0.23:
await pb.collection('_superusers').authWithPassword(
  process.env.PB_ADMIN_EMAIL!,
  process.env.PB_ADMIN_PASSWORD!
)
export { pb }
```

**Rule:** `pb.authWithPassword()` or any `.auth*` method is NEVER called on this instance in a request handler.

### 3.2 — Auth middleware (`packages/backend/src/middleware/auth.ts`)

- Read `req.cookies.aida_session`
- `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`
- Decode `AidaJwtPayload` (sub, email, role)
- Derive `roles` from `ROLE_PERMISSIONS[payload.role]` — **not from JWT**
- Attach full `User` to `req.user`
- Silent re-issue if `aida_session` expired + `aida_refresh` valid
- 401 if both expired

### 3.3 — RBAC middleware (`packages/backend/src/middleware/rbac.ts`)

Exact implementation from migration spec §4.2 — `requireRole(module, level)` with `hasPermission()` rank map.

### 3.4 — CSRF middleware (`packages/backend/src/middleware/csrf.ts`)

`parseOrigin()` + `csrfOriginGuard()` from split_architecture_plan.md CSRF Policy section. `new URL(raw).origin === ALLOWED_ORIGIN` — exact equality, not prefix match.

### 3.5 — Error handler (`packages/backend/src/middleware/errorHandler.ts`)

### 3.6 — Auth routes (`packages/backend/src/routes/auth.ts`)

- `POST /api/auth/login`
  1. Zod validate `{ email, password }`
  2. Throwaway PB instance for credential validation (`new PocketBase(...)` — not the singleton)
  3. Fetch user record via singleton to get `role` field
  4. Sign `aida_session` JWT (HS256, 15 min) and `aida_refresh` JWT (7d)
  5. Set both cookies: `Secure; HttpOnly; SameSite=Strict; Path=/`
  6. Return `LoginResponse { user }`

- `POST /api/auth/logout` — clear both cookies, 204

- `GET /api/auth/session` — non-throwing auth; return `{ user }` or `{ user: null }`

### 3.7 — Preferences routes (`packages/backend/src/routes/preferences.ts`)

- `GET /api/users/preferences` — fetch or create default `userPreferences` record for `req.user.id`
- `PATCH /api/users/preferences` — deep-merge patch; no clobber of unmodified keys

### 3.8 — Express entry point (`packages/backend/src/index.ts`)

Register: CORS → JSON → cookieParser → csrfOriginGuard (global) → routes → errorHandler.

### 3.9 — Type augmentation (`packages/backend/src/types/express.d.ts`)

Per migration spec §4.4.

### 3.10 — `.env.example` (`packages/backend/.env.example`)

All vars from split_architecture_plan.md §2 + `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`.

### 3.11 — tsc + GPT-5 Audit + stage

```
tsc --noEmit   # in packages/backend
# Run GPT-5 Security Audit — all 10 items must pass
git add packages/backend/
```

**Completion signal:** `tsc --noEmit` passes. GPT-5 audit passes. `GET /api/auth/session` returns `{ user: null }`.

---

## Phase 4 — Backend Routes (Domain by Domain)
**Agent:** Claude Sonnet (The Senior)  
**Order:** Inventory → RMA → Shipments → Amazon → Orders/Refurb → Forecasting → Users/Data

For each domain:
1. Implement route file in `packages/backend/src/routes/`
2. Apply `authMiddleware` + `requireRole()` per migration spec §4.3 table
3. Register router in `packages/backend/src/index.ts`
4. Rewrite corresponding frontend hook to call `apiClient`
5. `tsc --noEmit` across all three packages
6. Stage backend route + updated frontend hook together

**Forecasting (domain 6) — additional tasks:**
- Move `forecastingEngine.ts` to `packages/backend/src/lib/` — pure functions unchanged
- Extract `computeForecast()` wrapper function (addendum §B.2)
- Move `DEFAULT_VENDORS` + helper functions to `packages/backend/src/lib/vendorConfig.ts`
- Implement `GET /api/forecasting` handler (addendum §B.1 — fetches userPreferences before running engine)
- Implement `GET /api/forecasting/vendor-configs` handler (addendum §E — merges defaults + user customizations)
- Rewrite `useForecasting.ts` per addendum §B.3 (calls `apiClient`, watches `preferences.velocityOverrides`)
- Delete `packages/frontend/src/lib/forecastingEngine.ts`
- Delete `packages/frontend/src/lib/vendorConfig.ts`

**Completion signal:** All 7 domains complete. `tsc --noEmit` passes across all three packages.

---

## Phase 5 — Cleanup & Verification
**Agent:** Claude Sonnet (The Senior)

### 5.1 — Delete PocketBase files from frontend

```
packages/frontend/src/lib/pocketbase.ts      — delete
packages/frontend/src/lib/pocketbaseApi.ts   — delete
packages/frontend/src/lib/collections.ts     — delete
```

### 5.2 — Run verification checklist (migration spec §8)

All 10 items must pass:

```sh
grep -r "pocketbase" packages/frontend/src/      # zero matches
grep -r "VITE_PB_URL" packages/frontend/         # zero matches
grep -r "localStorage" packages/frontend/src/    # zero matches
grep -r "useAuth().pb" packages/frontend/src/    # zero matches
tsc --noEmit                                      # passes in all three packages
```

Manual tests:
- `GET /api/auth/session` returns `{ user: null }` with no cookie
- Login sets `aida_session` + `aida_refresh` as `HttpOnly; Secure; SameSite=Strict`
- Forecasting tab populates from `/api/forecasting?mode=device` (DevTools Network)
- Stock adjust creates history record via `/api/inventory/devices/:id/adjust`
- Staff user receives 403 on `GET /api/users`

### 5.3 — Final commit (only after all checks pass)

```
git commit -m "arch: complete transition to monorepo with backend-persisted velocity overrides"
```

### 5.4 — Update README

Add Monorepo section: workspace structure, `npm run dev`, `npm run start:backend`, env file locations, link to `docs/migration_spec.md`.

---

## Decision Gate Before Phase 3

Confirm before executing Phase 3:

- [ ] **PB server version** — run `./pocketbase --version`. If ≥ 0.23, use `pb.collection('_superusers').authWithPassword`. If < 0.23, use `pb.admins.authWithPassword`.
- [ ] **Deployment topology** — same-site (required for current CSRF policy)? Cross-origin requires synchronizer tokens.
- [ ] **Velocity override strategy** — Option B (server-persisted) is selected and implemented per addendum §A. Confirm no other localStorage reads remain.