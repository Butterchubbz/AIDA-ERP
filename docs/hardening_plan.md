# AIDA-ERP Hardening Implementation Plan

**Version:** 1.0  
**Date:** 2025  
**Owner:** Claude Sonnet (The Project Manager)  
**Status:** Phase 1 (Planning)

---

## Overview

This document distributes the hardening tasks outlined in `docs/hardening_spec.md` across specialized roles. Each role has a clearly defined scope, acceptance criteria, and timeline. Once all roles complete their tasks, Phase 2 (Execution & Testing) begins.

---

## Task Distribution

### Task 1: Startup Validation & Process Handlers
**Assigned to:** Claude Sonnet (Senior Backend Engineer)  
**Priority:** CRITICAL (blocks everything else)  
**Timeline:** Phase 2, Step 1

#### Scope
Implement startup environment validation and process safety handlers in the backend.

#### Deliverables

1. **File:** `packages/backend/src/index.ts`
   - Add `validateStartupSecrets()` function (as specified in hardening_spec.md)
   - Call `validateStartupSecrets()` BEFORE `app.listen()`
   - Add process.on handlers:
     - `unhandledRejection`
     - `uncaughtException`
     - `SIGTERM` (graceful shutdown)

2. **File:** `packages/backend/src/middleware/auth.ts`
   - Rewrite `authMiddleware` to remove the silent-pass branch
   - If JWT_SECRET is missing or invalid, return 401 immediately
   - Add explicit error logging for missing secrets

#### Acceptance Criteria
- [ ] Server refuses to start if JWT_SECRET is missing (exit code 1)
- [ ] Server refuses to start if AIDA_ENCRYPTION_KEY is not exactly 64 hex chars (exit code 1)
- [ ] Server refuses to start if PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD are missing (exit code 1)
- [ ] authMiddleware logs and rejects requests when JWT_SECRET is unavailable
- [ ] `npm run typecheck -w @aida/backend` passes with no errors
- [ ] `npm run build -w @aida/backend` produces valid output

#### Implementation Notes
- Use the exact code from `hardening_spec.md` Section 1 & 3 as the template
- Do NOT change the order of startup calls; `validateStartupSecrets()` must be after `authenticatePocketBase()` and before `app.listen()`
- Log all validation results to console with `[Startup]` prefix for observability
- Ensure process handlers exit cleanly with code 1 (not 0) to allow container restarts

---

### Task 2: Stub Routes & Setup Lock Middleware
**Assigned to:** Claude Haiku (Junior Backend Engineer)  
**Priority:** HIGH  
**Timeline:** Phase 2, Step 2 (depends on Task 1)

#### Scope
Replace stub route implementations with 501 Not Implemented responses and create the `requireSetupIncomplete` middleware.

#### Deliverables

1. **New Middleware:**
   - **File:** `packages/backend/src/middleware/auth.ts` (add new export)
   - Export `requireSetupIncomplete()` function
   - Check `systemConfig` collection for `setupComplete` flag
   - Return 409 Conflict if setup is already complete
   - Return 500 if setup state cannot be determined (fail-closed)

2. **Stub Route Updates:**
   - **File:** `packages/backend/src/routes/amazon.ts`
     - Replace `syncAmazonInventory()` body with 501 response
     - Message: "Amazon inventory sync is not yet fully implemented. Please use manual CSV upload for now."
   
   - **File:** `packages/backend/src/routes/forecasting.ts`
     - Replace `calculateForecast()` body with 501 response
     - Message: "Forecasting engine under development. Check back soon."
   
   - **File:** `packages/backend/src/routes/data.ts`
     - Replace `importCSV()` body with 501 response
     - Message: "CSV import requires a formatted template. Contact support."
   
   - **File:** `packages/backend/src/routes/shipments.ts`
     - Replace `forecastShipments()` body with 501 response
     - Message: "Shipment forecasting not yet available."

3. **Route Registration:**
   - **File:** `packages/backend/src/index.ts`
   - Apply `requireSetupIncomplete` middleware to:
     - `POST /api/setup/save-encryption-key`
     - `POST /api/setup/init-admin`
   - Do NOT apply to:
     - `GET /api/setup/check-health` (must always be readable)
     - Auth or session routes

#### Acceptance Criteria
- [ ] All four stub routes return 501 with correct error message
- [ ] 501 responses include standard JSON format: { error, status, message, contact }
- [ ] `requireSetupIncomplete` middleware created and exported
- [ ] Setup lock middleware applied to mutating setup routes only
- [ ] GET /api/setup/check-health can be called anytime (no middleware)
- [ ] `npm run typecheck -w @aida/backend` passes
- [ ] `npm run build -w @aida/backend` produces valid output

#### Implementation Notes
- Use the exact 501 response format from `hardening_spec.md` Section 4
- Test each 501 route manually: `curl -X POST http://localhost:3001/api/amazon/sync` should return 501
- For `requireSetupIncomplete`, assume `systemConfig` collection exists (GPT-5's Security Audit will verify this)

---

### Task 3: Frontend First-Run Migration
**Assigned to:** GPT-4.1 (Intern)  
**Priority:** HIGH  
**Timeline:** Phase 2, Step 3 (depends on Task 1 & 2)

#### Scope
Migrate all frontend first-run detection from synchronous `hasSetupCompleted()` to async `detectFirstRun()`, then delete the old stub.

#### Deliverables

1. **Migration:**
   - Audit `packages/frontend/src/lib/firstRun.ts`
   - Verify `detectFirstRun()` function is async and returns Promise<boolean>
   - Find all calls to `hasSetupCompleted()` in frontend codebase
   - Replace each with `await detectFirstRun()`
   - Update call sites to be async where needed

2. **Deletion:**
   - Remove `hasSetupCompleted()` function definition (if it exists as a stub)
   - Remove any hardcoded `setupComplete` state variables
   - Remove any localStorage `aida_setup_complete` checks (legacy)

3. **Verification:**
   - Search codebase for patterns:
     - `hasSetupCompleted`
     - `aida_setup_complete`
     - `useSetupComplete` (old hook)
     - Any synchronous setup checks
   - Ensure no remnants exist

#### Acceptance Criteria
- [ ] `detectFirstRun()` is the only first-run detection function
- [ ] All call sites use `await detectFirstRun()` (async)
- [ ] No `hasSetupCompleted()` exists in codebase
- [ ] No localStorage `aida_setup_complete` checks remain
- [ ] Frontend builds with `npm run build -w @aida/frontend` without errors
- [ ] First-run flow routes to `/setup` wizard on unconfigured instance
- [ ] Configured instances route to `/login`

#### Implementation Notes
- Check all files in `packages/frontend/src/` for first-run usage patterns
- Pay special attention to:
  - Route guards / middleware
  - Layout components
  - App initialization logic
- Update TypeScript types if necessary

---

### Task 4: Security Perimeter Audit
**Assigned to:** GPT-5 (Security Lead)  
**Priority:** CRITICAL (verification only, no implementation)  
**Timeline:** Phase 2, Step 4 (after Tasks 1–3)

#### Scope
Verify that the hardened system prevents re-triggering of setup routes and enforces the 409 Conflict response.

#### Test Cases

1. **Startup Guard Test**
   ```
   TEST: Start backend without JWT_SECRET
   EXPECTED: Server exits with code 1
   ACTUAL: [To be verified in Phase 2]
   ```

2. **Setup Lock Test**
   ```
   TEST: POST /api/setup/save-encryption-key on already-configured instance
   EXPECTED: 409 Conflict response
   ACTUAL: [To be verified in Phase 2]
   ```

3. **Stub Route Test**
   ```
   TEST: POST /api/amazon/sync
   EXPECTED: 501 Not Implemented
   ACTUAL: [To be verified in Phase 2]
   ```

4. **Middleware Test**
   ```
   TEST: Call POST /api/setup/init-admin with valid JWT (after setup complete)
   EXPECTED: 409 Conflict (requireSetupIncomplete blocks it)
   ACTUAL: [To be verified in Phase 2]
   ```

5. **Health Check Test**
   ```
   TEST: GET /api/setup/check-health on configured instance
   EXPECTED: 200 OK (no middleware applied)
   ACTUAL: [To be verified in Phase 2]
   ```

#### Deliverables
- Manual curl/Postman test results for each scenario
- Log output showing [Startup], [Middleware], [Process] prefixes
- Confirmation that no silent failures occur

#### Acceptance Criteria
- [x] Security Audit plan created (this document)
- [ ] Startup Guard Test: pass
- [ ] Setup Lock Test: pass
- [ ] Stub Route Test: pass
- [ ] Middleware Test: pass
- [ ] Health Check Test: pass
- [ ] No undefined behavior observed
- [ ] All exit codes and HTTP status codes as expected

#### Implementation Notes
- Execute tests manually via curl/Postman
- Capture full server logs (including [Startup], [Process] prefixes)
- If a test fails, document the failure and roll back the implementing task

---

## Dependency Graph

```
Task 1 (Startup & Process Handlers)
    ↓
Task 2 (Stub Routes & Setup Lock)
    ↓
Task 3 (Frontend First-Run)
    ↓
Task 4 (Security Audit)
```

All four tasks must complete before Phase 2 testing begins.

---

## Timeline & Status

| Task | Owner | Status | Est. Duration | Target Completion |
|---|---|---|---|---|
| 1. Startup & Process | Sonnet | Not Started | 30 mins | Phase 2, Step 1 |
| 2. Stub Routes & Lock | Haiku | Not Started | 45 mins | Phase 2, Step 2 |
| 3. Frontend Migration | GPT-4.1 | Not Started | 40 mins | Phase 2, Step 3 |
| 4. Security Audit | GPT-5 | Not Started | 20 mins | Phase 2, Step 4 |

---

## Phase 2 Entry Criteria

Phase 2 (Execution & Testing) begins when:
- [x] All tasks defined in this plan
- [x] Hardening specification (Phase 0) approved
- [ ] User approves proceeding to Phase 2 execution

---

## Final Checklist (Phase 2 Acceptance)

Once Phase 2 execution completes, verify:

- [ ] Startup: Backend refuses to start without a JWT_SECRET (exit code 1)
- [ ] Auth: authMiddleware no longer silently continues if a secret is missing
- [ ] Persistence: Re-running the wizard on a configured instance is blocked by a 409 Conflict
- [ ] Stubs: Clicking "Sync Amazon Inventory" shows a visible 501 error in the UI
- [ ] First-Run: Already-configured instances land on /login, never the wizard

---

**Status:** Awaiting your go-ahead to proceed to Phase 2 (Execution & Testing).
