# Implementation Plan: Three-Package Monorepo Migration

**Status:** Awaiting go-ahead  
**Source spec:** `docs/migration_spec.md`  
**Source plan:** `docs/split_architecture_plan.md`

> **Guardrails (active throughout all phases)**
> - `localStorage` is forbidden for auth. All auth state flows through `aida_session` cookie only.
> - The backend `pb` singleton never has `authWithPassword()` called on it at request time.
> - All type imports in the frontend point to `@aida/shared`, never to local `src/types/`.
> - No `pocketbase` npm package in `packages/frontend/`.

---

## Phase 0 — Monorepo Scaffold
**Agent:** GPT-4.1 (The Intern)  
**Goal:** Convert the repository root into an npm workspaces monorepo. No app code moves yet.

### Tasks

**0.1 — Workspace root `package.json`**

Create `package.json` at the repo root (replacing the current app `package.json`, which moves to `packages/frontend/`):

```json
{
  "name": "aida-erp-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=packages/frontend",
    "build": "npm run build --workspace=packages/shared && npm run build --workspace=packages/frontend",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "start:backend": "npm run dev --workspace=packages/backend"
  }
}
```

**0.2 — Directory structure**

Create the following directories (empty, with `.gitkeep`):
```
packages/
  shared/src/types/
  shared/src/api/
  shared/src/constants/
  backend/src/routes/
  backend/src/middleware/
  backend/src/lib/
  frontend/   ← current repo root content moves here (see Phase 1)
```

**0.3 — Shared package scaffolding**

Create `packages/shared/package.json` (development/monorepo manifest — see §1 of migration spec), `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

And create the empty barrel `packages/shared/src/index.ts`.

**0.4 — Backend package scaffolding**

Create `packages/backend/package.json`:
```json
{
  "name": "@aida/backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4",
    "pocketbase": "^0.26",
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
    "@types/cookie-parser": "^1",
    "@types/cors": "^2",
    "tsx": "^4"
  }
}
```

And `packages/backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**0.5 — Frontend package scaffolding**

Move the current root `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/`, `public/` into `packages/frontend/`. Update the frontend `package.json`:
- Change `name` to `"@aida/frontend"`
- Add `"@aida/shared": "*"` to `dependencies`
- Remove any `"pocketbase"` entry (it will be removed during Phase 2)
- Update Vite `resolve.alias` if needed

**0.6 — Verify scaffold**

Run `npm install` at the workspace root. Confirm:
- `node_modules/@aida/shared` symlinks to `packages/shared`
- `node_modules/@aida/backend` symlinks to `packages/backend`
- `node_modules/@aida/frontend` symlinks to `packages/frontend`

**Completion signal:** `npm run typecheck` passes (or fails only on missing type definitions expected to be added in Phase 1).

---

## Phase 1 — Shared Package: Types, Envelopes, Constants
**Agent:** GPT-4.1 (The Intern)  
**Goal:** Populate `@aida/shared` with all types, API envelopes, and role constants. No behaviour changes — types only.

### Tasks

**1.1 — Migrate `src/types/` → `packages/shared/src/types/`**

Copy all 13 type files. For each file, audit and strip any line that imports from `'pocketbase'` (e.g. `import type { RecordModel } from 'pocketbase'`). Replace field types that used `RecordModel` with `id: string`.

Files: `amazon.ts`, `component.ts`, `device.ts`, `history.ts`, `inbound.ts`, `inventory.ts`, `order.ts`, `refurbished.ts`, `rma.ts`, `shipment.ts`, `stock.ts`

Special handling:
- `user.ts` — **rewrite** to the canonical `User` interface defined in §1.1 of migration spec
- `forecast.ts` — split into `forecastPrimitives.ts` (utility types + functions) and promote `ForecastItem` to `forecast.ts` as defined in §1.2 of migration spec

**1.2 — Add `VendorConfig` type**

Create `packages/shared/src/types/vendor.ts` with the `VendorConfig` interface from §3.4 of migration spec.

**1.3 — Add shared constants**

Create `packages/shared/src/constants/roles.ts` with `AppRole`, `ModuleName`, `PermissionLevel`, `UserRoles`, and `ROLE_PERMISSIONS` as defined in §4.1 of migration spec.

**1.4 — Add API envelope types**

Create one file per domain in `packages/shared/src/api/`:
- `auth.ts` — §2.1 of migration spec
- `inventory.ts` — §2.2
- `forecasting.ts` — §2.3
- `amazon.ts` — §2.4
- `rma.ts` — §2.5
- `shipments.ts` — §2.6
- `orders.ts` — §2.7

**1.5 — Wire the barrel**

Populate `packages/shared/src/index.ts` with the full re-export list from §1.3 of migration spec.

**1.6 — Update frontend imports**

In `packages/frontend/src/`, update all `import ... from '../types/...'` (or `../../types/...`) to `import type { ... } from '@aida/shared'`. This is a mechanical find-and-replace pass.

**1.7 — tsc check + git stage**

Run `tsc --noEmit` in `packages/shared/` and `packages/frontend/`. Fix any type errors. Then:
```
git add packages/shared/
git add packages/frontend/src/
```

**Completion signal:** `tsc --noEmit` passes in both `packages/shared` and `packages/frontend`.

---

## Phase 2 — Frontend: `apiClient` + Environment Cleanup
**Agent:** Claude Haiku (The Junior)  
**Goal:** Replace `pocketbaseApi.ts` with a typed `fetch` wrapper and strip all PocketBase references from the frontend environment and client code.

### Tasks

**2.1 — Create `packages/frontend/src/lib/apiClient.ts`**

Implement the typed fetch wrapper as specified in `split_architecture_plan.md` §3:
- `credentials: 'include'` on every request
- 401 → redirect to `/login` + throw
- Non-OK → parse JSON error body, throw
- Methods: `get`, `post`, `patch`, `delete`

**2.2 — Rewrite `AuthContext.tsx`**

Implement the rewritten context as specified in `split_architecture_plan.md` §3 and migration spec §5:
- Remove all PocketBase imports
- Remove `pb` from context value
- Remove `isAdmin` parameter from `login()`
- On mount: `GET /api/auth/session` to hydrate user
- `login()`: `POST /api/auth/login`
- `logout()`: `POST /api/auth/logout`
- Derive `userRoles` from `user.roles` (already on the `User` shape from backend)

**2.3 — Remove PocketBase from frontend env**

- Delete `VITE_PB_URL` from any `.env`, `.env.local`, `.env.example` files in `packages/frontend/`
- Add `VITE_API_URL=http://localhost:3001` to `packages/frontend/.env.example`

**2.4 — Remove `pocketbase` npm dependency**

Remove `"pocketbase"` from `packages/frontend/package.json` `dependencies`. Run `npm install` at workspace root to update lockfile.

**2.5 — Velocity override: remove localStorage read**

Remove the `localStorage.getItem(OVERRIDE_KEY_PREFIX + sku)` call from `useForecasting.ts`. Default to `null` override until Phase 4 wires up the preference endpoint.

**2.6 — tsc check + git stage**

Run `tsc --noEmit` in `packages/frontend`. Fix any errors. Then:
```
git add packages/frontend/src/lib/apiClient.ts
git add packages/frontend/src/context/AuthContext.tsx
git add packages/frontend/.env.example
git add packages/frontend/package.json
```

**Completion signal:** `tsc --noEmit` passes in `packages/frontend`. `grep -r "pocketbase" packages/frontend/src/` returns zero matches.

---

## Security & CSRF Audit (GPT-5)

> **Must complete before any Phase 3 code is committed.**

**Auditor:** GPT-5  
**Scope:** `packages/backend/src/middleware/csrf.ts`, `packages/backend/src/middleware/auth.ts`, `packages/backend/src/routes/auth.ts`, `packages/frontend/src/lib/apiClient.ts`, `packages/frontend/src/context/AuthContext.tsx`

**Audit checklist:**

1. **CSRF guard correctness**
   - Does `csrfOriginGuard` use `new URL(raw).origin` for both `Origin` and `Referer` headers?
   - Does it fail closed (403) on malformed or missing headers for state-mutating methods?
   - Is `ALLOWED_ORIGIN` read from `process.env.CORS_ORIGIN` (not hardcoded)?
   - Is the guard applied before all route handlers in `index.ts`?

2. **Cookie security**
   - Are `aida_session` and `aida_refresh` set with `Secure`, `HttpOnly`, and `SameSite=Strict`?
   - Is the cookie `Path` set to `/`?
   - Is `MaxAge` set to match `JWT_EXPIRES_IN` / `REFRESH_EXPIRES_IN`?

3. **JWT handling**
   - Is `JWT_SECRET` a minimum of 256-bit entropy?
   - Is `jsonwebtoken.verify()` called with explicit `{ algorithms: ['HS256'] }` to prevent algorithm confusion?
   - Are expired tokens rejected?

4. **PB singleton isolation**
   - Does the singleton `pb` export never call `authWithPassword()` after startup?
   - Does the login handler use a **new** `PocketBase` instance for credential validation?
   - Is the throwaway instance garbage-collected (not exported or stored)?

5. **Frontend PocketBase removal**
   - Does `packages/frontend/src/` contain zero imports from `'pocketbase'`?
   - Is `VITE_PB_URL` absent from all `.env*` files in `packages/frontend/`?
   - Does `apiClient.ts` send `credentials: 'include'` on every request?

6. **Input validation**
   - Is the login body validated with zod before being passed to PocketBase?
   - Are route params (`:id`) validated as non-empty strings before PB queries?

**Audit output:** Pass/fail per item. Any fail blocks commit. Fix the item and re-check before Phase 4.

---

## Phase 3 — Backend Scaffold: Express + Auth + PB Singleton
**Agent:** Claude Sonnet (The Senior)  
**Goal:** Implement the full backend core: process entry point, PB admin singleton, JWT auth middleware, CSRF guard, RBAC middleware, and auth routes.

### Tasks

**3.1 — PocketBase admin singleton** (`packages/backend/src/lib/pocketbase.ts`)

Authenticated at startup via `pb.admins.authWithPassword(...)`. File-level comment prohibiting per-request auth mutation.

**3.2 — JWT auth middleware** (`packages/backend/src/middleware/auth.ts`)

- Reads `req.cookies.aida_session`
- Verifies with `jsonwebtoken.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`
- Derives `roles` from `ROLE_PERMISSIONS[payload.role]`
- Attaches `User` to `req.user`
- Silent refresh if `aida_session` expired and `aida_refresh` valid; 401 if both expired

**3.3 — RBAC middleware** (`packages/backend/src/middleware/rbac.ts`)

Exact implementation from migration spec §4.2.

**3.4 — CSRF middleware** (`packages/backend/src/middleware/csrf.ts`)

`parseOrigin()` + `csrfOriginGuard()` with URL-based origin parsing from `split_architecture_plan.md`.

**3.5 — Error handler** (`packages/backend/src/middleware/errorHandler.ts`)

**3.6 — Auth routes** (`packages/backend/src/routes/auth.ts`)

- `POST /api/auth/login` — throwaway PB instance for credential validation; sign JWT; set cookies
- `POST /api/auth/logout` — clear both cookies; 204
- `GET /api/auth/session` — non-throwing auth check; return `{ user }` or `{ user: null }`

**3.7 — Express entry point** (`packages/backend/src/index.ts`)

Register CORS, JSON, cookieParser, csrfOriginGuard globally; mount auth routes; mount errorHandler.

**3.8 — Express type augmentation** (`packages/backend/src/types/express.d.ts`)

**3.9 — tsc check + git stage**

```
git add packages/backend/
```

**Completion signal:** `tsc --noEmit` passes. `GET /api/auth/session` returns `{ user: null }`. GPT-5 Security Audit passes all 6 checklist items.

---

## Phase 4 — Backend Routes (Domain by Domain)
**Agent:** Claude Sonnet (The Senior)  
**Order:** Inventory → RMA → Shipments → Amazon → Orders/Refurb → Forecasting → Users/Data

For each domain:
1. Implement route file in `packages/backend/src/routes/`
2. Apply `authMiddleware` + `requireRole()` per migration spec §4.3
3. Register router in `packages/backend/src/index.ts`
4. Update the corresponding frontend hook to call `apiClient` instead of PB helpers
5. `tsc --noEmit` across all three packages
6. Stage backend route + updated frontend hook together

**Forecasting-specific tasks (domain 6):**
- Move `forecastingEngine.ts` to `packages/backend/src/lib/`
- Move `DEFAULT_VENDORS` to `packages/backend/src/lib/vendorConfig.ts`
- Implement `GET /api/forecasting` and `GET /api/forecasting/vendor-configs`
- Implement `PATCH /api/users/preferences` for velocity overrides (Option B)
- Rewrite `packages/frontend/src/hooks/useForecasting.ts` per migration spec §3.3
- Delete `packages/frontend/src/lib/forecastingEngine.ts`
- Delete `packages/frontend/src/lib/vendorConfig.ts`

**Completion signal:** All 7 domains implemented. `tsc --noEmit` passes across all three packages.

---

## Phase 5 — Cleanup & Verification
**Agent:** Claude Sonnet (The Senior)

**5.1 — Delete PocketBase files from frontend**
```
packages/frontend/src/lib/pocketbase.ts        — delete
packages/frontend/src/lib/pocketbaseApi.ts     — delete
packages/frontend/src/lib/collections.ts       — delete
```
(forecastingEngine.ts and vendorConfig.ts already deleted in Phase 4)

**5.2 — Run verification checklist** (migration spec §8 — all 8 items must pass)

**5.3 — Final commit** (only after all checks pass)
```
git commit -m "arch: transition to three-package monorepo and decouple frontend from pocketbase"
```

**5.4 — Update README** with monorepo structure, `npm run dev`, `npm run start:backend`, env file locations.

---

## Decision Gate Before Phase 3 Begins

Confirm before executing Phase 3:

- [ ] **Velocity override strategy** — confirm Option B (server-persisted preferences), Option A (query param, session-only), or Option C (cookie)
- [ ] **PocketBase admin API version** — confirm `pb.admins.authWithPassword` is available in PB 0.26. In PB 0.23+ the admin API changed; may need `pb.collection('_superusers').authWithPassword(...)` instead.
- [ ] **Deployment topology** — confirm frontend and backend will be same-site in production. Cross-origin deployment requires upgrading to synchronizer CSRF tokens.
