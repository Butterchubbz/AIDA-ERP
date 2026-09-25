# Setup Fix Specification

## Scope

This specification defines the routing and auth behavior required to stop the Setup Wizard from failing behind session checks, and it restates the default SKU ordering rule for inventory surfaces.

The target problems are:

1. Setup Wizard requests are being treated as authenticated app traffic.
2. Auth bootstrap does not clearly distinguish expired-session behavior from not-initialized-app behavior.
3. Inventory order must remain deterministic and alphabetical by SKU.

## 1. Public Setup Routes

### Requirement

All `/api/setup/*` routes are public bootstrap routes and must bypass the global auth gate.

### Mandate

The following routes must execute without requiring a JWT cookie:

1. `GET /api/setup/check-health`
2. `POST /api/setup/save-encryption-key`
3. `POST /api/setup/init-collections`

### Routing Rule

Setup routes must be mounted before the global `authMiddleware`, or the app must explicitly exclude `/api/setup/*` from auth enforcement.

### Reasoning

The wizard is part of application initialization. It must be able to detect:

1. backend reachability
2. PocketBase reachability
3. setup completeness
4. encryption-key state

before a user session exists.

If setup endpoints return `401 Unauthorized`, the wizard cannot tell whether the app is uninitialized or the user is simply unauthenticated.

### Expected Health Semantics

`GET /api/setup/check-health` must never require a session.

It may still return:

1. `200` with health data
2. `500` if setup internals fail

It must not return `401` just because there is no active `aida_session` cookie.

## 2. AuthContext Resilience

### Requirement

The frontend auth bootstrap must distinguish between a session problem and an initialization problem.

### Required States

#### Session Expired

Meaning:

The app is initialized, but the current user is not authenticated or their cookie is invalid.

Expected behavior:

1. Auth bootstrap or protected API call receives `401`.
2. User is sent to Login, not Setup.

#### App Not Initialized

Meaning:

The setup/bootstrap path is incomplete or unavailable, so the user should be sent through Setup rather than treated as a normal anonymous visitor.

Expected behavior:

1. Setup-health route reports incomplete initialization.
2. User is sent to Setup, not Login.

### Contract

`AuthContext` must not treat all bootstrap failures as equivalent to anonymous session state.

It should distinguish at minimum:

1. `401` from `/api/auth/session` as session missing or expired
2. setup incomplete from `/api/setup/check-health` as initialization required
3. network or server failures as transient app errors, not proof of either condition

### Redirect Rule

1. `401` auth failure means Login.
2. setup incomplete means Setup.
3. backend unreachable or server error means stay on the current route and show diagnostics instead of forcing a redirect.

## 3. Wizard Reachability Messaging

### Requirement

The Setup Wizard must tell the user whether the backend is reachable but unauthorized, or fully unreachable.

### Copy Rule

The wizard should differentiate at least these two states:

1. `Backend Reachable (Unauthorized)`
2. `Backend Unreachable`

### Interpretation

`Backend Reachable (Unauthorized)` means:

1. the request reached Express
2. the service is up
3. auth policy blocked access

`Backend Unreachable` means:

1. no HTTP response was received
2. the server is down, blocked by CORS, or on the wrong host/port

This distinction is necessary because a `401` is a routing/auth configuration problem, not a network availability problem.

## 4. SKU Alpha-Sort

### Requirement

All inventory fetch hooks and backend inventory list routes must apply a standard alphabetical sort by SKU from A to Z.

### Mandate

The default inventory ordering rule is:

1. sort ascending by normalized `sku`
2. normalization must be case-insensitive
3. ties should remain stable via raw `sku`, then `created`, then `id`

### Required Surfaces

1. backend device inventory list route
2. any frontend inventory fetch hook that stores fetched inventory records

### Business Outcome

Users must see predictable SKU order regardless of insertion order or backend storage order.

## 5. Implementation Targets

1. `packages/backend/src/index.ts`
2. `packages/frontend/src/context/AuthContext.tsx`
3. `packages/frontend/src/pages/SetupPage.tsx`
4. `packages/frontend/src/lib/apiClient.ts`
5. `packages/backend/src/routes/inventory.ts`
6. `packages/frontend/src/hooks/useInventoryModules.ts`

## 6. Exit Criteria

1. Setup health routes execute without a JWT.
2. Setup Wizard can run health checks before login.
3. Auth bootstrap distinguishes Login vs Setup redirects correctly.
4. Wizard copy distinguishes unauthorized backend reachability from backend unreachability.
5. Inventory lists remain alphabetically sorted by SKU.
---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.
