# Final Polish Plan

## Scope

This plan is based on `docs/setup_fix_spec.md` and focuses on the minimum implementation needed to let the Setup Wizard operate without session friction while keeping inventory ordering deterministic.

## Local Hypothesis

The remaining setup friction is caused by one routing problem and two interpretation problems:

1. setup routes are still positioned in a way that can be influenced by global auth middleware
2. the wizard does not clearly label `401` as backend reachable but unauthorized
3. cookie transport must be verified so auth failures are not caused by missing credentials on fetch

## Work Split

### Claude Sonnet (The Senior)

Update backend route registration so setup endpoints are unquestionably public.

#### Tasks

1. In `packages/backend/src/index.ts`, move setup-route registration ahead of the global `authMiddleware`.
2. Preserve auth protection for the rest of `/api/*`.
3. Confirm `GET /api/setup/check-health` can execute with no JWT cookie present.

#### Expected Outcome

1. Setup Wizard can run before login.
2. Setup health no longer returns `401` just because the session is missing.

### Claude Haiku (The Junior)

Implement and preserve standard alphabetical SKU sorting in backend inventory responses.

#### Tasks

1. In `packages/backend/src/routes/inventory.ts`, apply a standard `.sort()` over the fetched device inventory results before sending the response.
2. Keep the comparator alphabetical by SKU A-Z.
3. Preserve stable tie-break behavior where practical.

#### Expected Outcome

1. Device inventory order is deterministic.
2. SKUs display in predictable alphabetical order.

### GPT-4.1 (The Intern)

Clarify the Setup Wizard messaging so auth failures are not mistaken for connectivity failures.

#### Tasks

1. Update the Setup Wizard UI to show `Backend Reachable (Unauthorized)` when the backend responds with `401`.
2. Keep `Backend Unreachable` for true network/CORS/no-response failures.
3. Preserve existing retry and diagnostics actions.

#### Expected Outcome

1. Users can tell the difference between an auth problem and a network problem.
2. Debugging time drops because the wizard labels the class of failure correctly.

### GPT-5 (Audit)

Audit credential transport for frontend API requests.

#### Audit Target

`packages/frontend/src/lib/apiClient.ts`

#### Audit Questions

1. Is `credentials: 'include'` applied on requests that need cookies?
2. Does the current API client send cookies on session, login, and protected-route requests consistently?
3. Could any `401` reports be caused by missing cookie inclusion rather than actual auth expiration?

#### Expected Outcome

1. A pass or fail statement on current cookie transport.
2. A follow-up change only if cookie inclusion is incomplete or inconsistent.

## Sequence

1. Make setup routes explicitly public first.
2. Confirm cookie transport assumptions second.
3. Adjust wizard unauthorized messaging third.
4. Preserve SKU sort behavior last if not already present.

## Focused Validation

1. `GET /api/setup/check-health` works without a session cookie.
2. Setup Wizard can render backend health before login.
3. `401` is presented as reachable-but-unauthorized, not unreachable.
4. Device inventory remains alphabetically sorted by SKU.

## Stop Condition

Plan only. Wait for user go-ahead before implementation.
---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.
