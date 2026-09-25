# Fix Plan

## Scope

This plan is derived from `docs/troubleshooting_spec.md` and is intentionally narrow. It covers the sort defect, the Setup Wizard fetch diagnostics, the auth/session white-screen behavior, and a backend CORS audit.

## Local Hypothesis

The visible failures are caused by a combination of four small defects rather than one large one:

1. Device order is unsorted because neither the backend inventory route nor the frontend inventory hook applies a default SKU comparator.
2. The wizard still treats too many failures as generic connectivity problems.
3. Session/bootstrap code redirects too aggressively on `401` and treats any setup-health error as first-run.
4. Backend origin enforcement may not match the user’s active frontend port.

## Work Split

### Claude Sonnet (The Senior)

Fix the auth/session control flow so unauthorized states are handled deterministically instead of causing route churn or a white screen.

#### Tasks

1. Refactor `packages/frontend/src/lib/apiClient.ts` so it does not perform an unconditional hard browser redirect on every `401`.
2. Ensure `401` is surfaced as a typed error that callers can handle.
3. Update `packages/frontend/src/context/AuthContext.tsx` so initial session fetch distinguishes between:
   1. confirmed anonymous session
   2. expired session
   3. backend unavailable
4. Make `ProtectedRoute` respect `loadingAuth` before navigating away.
5. Stop `detectFirstRun()` from treating all setup-health fetch failures as `first-run`.

#### Expected Outcome

1. Expired sessions go to login cleanly.
2. Backend/CORS errors do not masquerade as setup-required state.
3. Protected routes do not flicker, blank, or bounce on transient fetch failures.

### Claude Haiku (The Junior)

Apply the alphabetical SKU sort in both the backend inventory route and the frontend inventory hook.

#### Tasks

1. In `packages/backend/src/routes/inventory.ts`, sort the `listDevices()` result by case-insensitive `sku` before returning JSON.
2. In `packages/frontend/src/hooks/useInventoryModules.ts`, sort fetched device items by the same comparator before storing state.
3. Use one shared comparator shape in both places:
   1. normalize with `trim().toLowerCase()`
   2. tie-break on raw `sku`
   3. final tie-break on `created` or `id`

#### Expected Outcome

1. Device list ordering is deterministic.
2. UI still looks correct even if backend ordering regresses later.

### GPT-4.1 (The Intern)

Improve the Setup Wizard health-check messaging so the operator sees concrete next actions for each fetch failure class.

#### Tasks

1. Update `packages/frontend/src/pages/SetupPage.tsx` to branch on `ApiError.status` when `/api/setup/check-health` returns a non-2xx response.
2. Add distinct user-facing guidance for:
   1. `404` route not found
   2. `500` backend crashed
   3. `TypeError` network/CORS failure
3. Add targeted fix suggestions such as `Check CORS settings in .env` when the failure pattern is consistent with origin mismatch.
4. Preserve the existing retry and copy-log workflow.

#### Expected Outcome

1. The wizard explains why health is failing.
2. The operator can act without reading terminal stack traces first.

### GPT-5 (Audit)

Audit backend origin enforcement to ensure it matches the user’s frontend port and launcher/runtime behavior.

#### Audit Targets

1. `packages/backend/src/index.ts`
2. `packages/backend/src/middleware/csrf.ts`
3. backend `.env` and launcher defaults if they control origin

#### Audit Questions

1. Does `ALLOWED_ORIGIN` match the actual frontend origin in local development?
2. Are CORS and CSRF using the same origin source?
3. Does the launcher or setup flow ever run the UI on a port other than the backend default assumption?
4. If the frontend is served from a different port, will browser requests fail as `TypeError` or `403`?

#### Expected Outcome

1. A clear pass/fail note on current `ALLOWED_ORIGIN` logic.
2. If needed, a small follow-up change to sync origin config with the active frontend port.

## Sequence

1. Fix `apiClient`, `AuthContext`, `ProtectedRoute`, and `detectFirstRun` first.
2. Add backend and frontend SKU sorting second.
3. Improve Setup Wizard diagnostics third.
4. Run the GPT-5 CORS audit before closing the task.

This order keeps the first validation focused on the white-screen and setup-redirect path before touching secondary UX improvements.

## Focused Validation

1. Session missing: protected routes go to login without blanking the app.
2. Backend down: app does not incorrectly force `/setup` just because health fetch failed.
3. Device list: SKUs render in alphabetical order regardless of creation order.
4. Setup Wizard: `404`, `500`, and `TypeError` produce different guidance text.
5. CORS audit: backend allowed origin matches the actual frontend origin.

## Files Expected To Change In The Implementation Phase

1. `packages/frontend/src/lib/apiClient.ts`
2. `packages/frontend/src/context/AuthContext.tsx`
3. `packages/frontend/src/components/common/ProtectedRoute.tsx`
4. `packages/frontend/src/lib/firstRun.ts`
5. `packages/frontend/src/pages/SetupPage.tsx`
6. `packages/frontend/src/hooks/useInventoryModules.ts`
7. `packages/backend/src/routes/inventory.ts`
8. Potentially `packages/frontend/src/App.tsx` for a `/management` alias to `/data`
9. Potentially backend env/origin config if the audit fails

## Stop Condition

Plan only. Do not implement fixes until the user gives the go-ahead.
---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.
