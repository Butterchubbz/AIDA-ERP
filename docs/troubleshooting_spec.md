# Troubleshooting Specification

## Scope

This document defines the expected behavior and root-cause hypotheses for three active issues in AIDA-ERP:

1. Device Inventory ordering is not deterministic by SKU.
2. The Setup Wizard health step does not distinguish the main fetch failure classes clearly enough.
3. Navigation to the Management area can end up at `/setup` or a blank/error state.

The intent is to constrain the implementation so the eventual fix is small, testable, and aligned with the current monorepo architecture.

## 1. Standard Sort Order

### Requirement

The default order for Device Inventory must be a case-insensitive alphabetical sort on the `sku` field.

### Mandate

`GET /api/inventory/devices` must return records already sorted by `sku` ascending, case-insensitive.

The frontend `useInventoryModules` hook may apply the same comparator as a defensive normalization layer, but backend ordering is the source of truth.

### Comparator Rule

Sort by `sku.trim().toLowerCase()` ascending.

If two normalized SKUs are equal, preserve a stable tie-breaker. Preferred tie-breakers, in order:

1. Raw `sku` ascending.
2. `created` ascending.
3. `id` ascending.

### Rationale

The current backend `listDevices` handler fetches `deviceInventory` via `getFullList()` with no explicit sort.

The current frontend `useInventoryModules` hook stores records exactly as returned and does not sort before rendering.

That means display order is presently dependent on PocketBase return order or insertion history rather than business order.

### Acceptance Criteria

1. `SKU-001-0` appears before `SKU-001-250` regardless of insertion order.
2. `abc-1` and `ABC-2` are ordered alphabetically without case affecting rank.
3. A refetch returns the same visible ordering without requiring user interaction.

## 2. Wizard Diagnostic Logic

### Requirement

The Setup Wizard health-check UX must differentiate between three error classes instead of collapsing them into a generic fetch failure message.

### Diagnostic Classes

#### Class A: `404 Not Found`

Meaning:

The request reached a server, but the expected route is missing or the frontend is pointed at the wrong base URL/path.

Primary examples:

1. Frontend calls `/api/setup/check-health` against the wrong backend host.
2. Backend is running, but the route is not registered.

Wizard copy requirement:

`Setup health endpoint returned 404. Verify VITE_API_URL points to the backend and confirm /api/setup/check-health is registered.`

Suggested fixes:

1. Check the frontend API base URL.
2. Confirm the backend server started successfully.
3. Confirm the setup routes are mounted.

#### Class B: `TypeError`

Meaning:

This is a browser-level network failure. It usually indicates one of the following:

1. Backend is down.
2. PocketBase is down.
3. CORS blocked the request.
4. The browser could not reach the configured host/port.

This is the current bucket used by `isFailedToFetchError()` in the wizard.

Wizard copy requirement:

`Network request failed before the server returned a response. Check that Backend API and PocketBase are running, and verify CORS/ALLOWED_ORIGIN matches the frontend URL.`

Suggested fixes:

1. Confirm backend on `localhost:3001`.
2. Confirm PocketBase on `localhost:8090`.
3. Check `ALLOWED_ORIGIN` against the active frontend port.
4. Check browser console for CORS details.

#### Class C: `500 Internal Server Error`

Meaning:

The request reached the backend and the route exists, but the backend failed while processing it.

Primary examples:

1. Startup completed partially but a dependency is unavailable.
2. PocketBase auth failed.
3. Route handler threw an exception.

Wizard copy requirement:

`Backend returned 500 during setup health check. The server is reachable but crashed while processing the request. Inspect backend logs for the failing dependency or startup error.`

Suggested fixes:

1. Review backend terminal output.
2. Confirm PocketBase admin auth completed.
3. Confirm required environment variables are present.

### Current Behavior Gap

The current `SetupPage` first probes `/api/health` and PocketBase health, then calls `/api/setup/check-health` through `apiClient`.

The page already distinguishes connectivity issues broadly, but `buildHealthErrorMessage()` still collapses successful reachability plus route/runtime failures into generic messaging unless the thrown error message happens to be specific.

The spec requirement is that the wizard must branch on HTTP status when a response exists, not just on network reachability.

### Required Decision Table

1. Probe says backend unreachable: show network/CORS/service-down guidance.
2. Probe passes and `/api/setup/check-health` returns `404`: show route/base-URL guidance.
3. Probe passes and `/api/setup/check-health` returns `500`: show backend-crash guidance.
4. Probe passes and request throws `TypeError`: show network/CORS guidance.

## 3. Management Route Fix

### Finding

The redirect to `/setup` is not primarily explained by an AuthContext-only bug.

There are two stronger control-path causes in the current codebase:

1. There is no `/management` route.
2. First-run detection fails open and treats any setup-health fetch failure as `first-run`.

### Evidence

The router defines the management UI at `/data`, labeled `AIDA Management` in the sidebar.

The router does not define `/management`.

The wildcard route redirects unmatched paths to `/setup` whenever `firstRunStatus === 'first-run'`.

`detectFirstRun()` currently catches all errors from `/api/setup/check-health` and returns `true`, which marks the app as first-run even for transient backend failures, CORS mismatches, or route errors.

### Likely Failure Sequence

1. User lands on or is linked to `/management`.
2. React Router treats it as an unmatched path.
3. `detectFirstRun()` calls `/api/setup/check-health`.
4. If that request fails for any reason, `detectFirstRun()` returns `true`.
5. The wildcard route redirects the unmatched path to `/setup`.

This matches the observed symptom better than a pure 401/403-only theory.

### Secondary Auth Risk

Auth handling still contributes instability:

1. `apiClient` performs a hard redirect to `/login` on every `401`.
2. `AuthContext` initial session load catches every failure and silently sets `user` to `null`.
3. `ProtectedRoute` does not wait for `loadingAuth` before deciding to navigate.

This can cause route churn or blank-state transitions during auth/session errors, but it does not explain `/management` specifically as well as the missing-route plus fail-open first-run logic.

### Spec Decision

The Management fix must include both of these behaviors:

1. `/management` must either become a real alias for `/data` or all UI/navigation must exclusively target `/data`.
2. `detectFirstRun()` must not convert arbitrary fetch failures into `first-run`.

### Recommended Behavior

1. If `/api/setup/check-health` returns a definitive payload, derive first-run from `setupComplete`.
2. If `/api/setup/check-health` fails with `401`, `403`, `404`, `500`, or `TypeError`, keep the app out of forced first-run redirect mode and surface diagnostics instead.
3. If a user navigates to `/management`, redirect to `/data` explicitly.

## 4. CORS Guardrail

### Finding

Backend CORS and CSRF allow exactly one origin via `ALLOWED_ORIGIN`, defaulting to `http://localhost:5173`.

The launcher/setup flow in this repository has also been exercised on `localhost:8090`, and Vite may run on ports other than `5173`.

This creates a realistic mismatch path where the backend is healthy but browser requests fail with a `TypeError` or a `403` CSRF rejection because the frontend origin does not exactly match `ALLOWED_ORIGIN`.

### Spec Requirement

Every troubleshooting surface must tell the operator to verify that `ALLOWED_ORIGIN` matches the actual frontend origin including protocol, host, and port.

## 5. Implementation Targets

1. Backend inventory ordering in `packages/backend/src/routes/inventory.ts`.
2. Defensive frontend ordering in `packages/frontend/src/hooks/useInventoryModules.ts`.
3. Setup wizard diagnostic branching in `packages/frontend/src/pages/SetupPage.tsx`.
4. First-run detection in `packages/frontend/src/lib/firstRun.ts`.
5. Auth/session behavior in `packages/frontend/src/context/AuthContext.tsx` and `packages/frontend/src/lib/apiClient.ts`.
6. Route alias or navigation fix in `packages/frontend/src/App.tsx`.

## 6. Exit Criteria

1. Device inventory always renders in case-insensitive SKU order by default.
2. Setup Wizard copy distinguishes `404`, `TypeError`, and `500`.
3. Navigating to the Management area no longer bounces to `/setup` during backend/auth instability.
4. Operators can diagnose CORS/port mismatches from the wizard without opening source code.
---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.
