# AIDA-ERP Hardening Specification

**Version:** 1.0  
**Date:** 2025  
**Architecture:** Senior Systems Architect (Phase 0)

---

## Executive Summary

This specification defines the "Loud Failure" patterns and fail-fast logic required to harden the AIDA-ERP backend against silent failures, stub routes, and re-triggerable setup logic. Once implemented, the system will:

- Refuse to start if critical secrets are missing (JWT_SECRET, AIDA_ENCRYPTION_KEY, PocketBase credentials)
- Reject all state-changing setup requests once the system is configured (409 Conflict)
- Return explicit 501 Not Implemented errors for unfinished feature stubs
- Capture and log unhandled rejections and exceptions instead of entering undefined states

---

## 1. Startup Guard Logic

### Purpose
Validate all required environment variables and secrets at backend startup. If any validation fails, the process must exit with code 1 (FAILURE) immediately, preventing the server from entering a partially-initialized state.

### Required Secrets

The following secrets **must** be present and non-empty before Express starts listening:

| Variable | Purpose | Min Length | Example |
|---|---|---|---|
| `JWT_SECRET` | Sign and verify aida_session JWTs | 32 bytes (base64) | `abcd...` (32+ chars) |
| `AIDA_ENCRYPTION_KEY` | Encrypt/decrypt integration credentials | 64 hex chars (32 bytes) | `a1b2c3d4...` (exactly 64 hex digits) |
| `PB_ADMIN_EMAIL` | PocketBase superuser email | 5 chars (valid email) | `admin@example.com` |
| `PB_ADMIN_PASSWORD` | PocketBase superuser password | 8 chars (strong) | `SecurePass123!` |

### Validation Routine

**File:** `packages/backend/src/index.ts`  
**Timing:** Before `app.listen()` is called

```typescript
function validateStartupSecrets(): void {
  const required = {
    JWT_SECRET: { min: 32, desc: 'JWT signing key' },
    AIDA_ENCRYPTION_KEY: { min: 64, desc: 'Encryption key (must be 64 hex chars)' },
    PB_ADMIN_EMAIL: { min: 5, desc: 'PocketBase superuser email' },
    PB_ADMIN_PASSWORD: { min: 8, desc: 'PocketBase superuser password' },
  }

  const errors: string[] = []

  for (const [key, spec] of Object.entries(required)) {
    const value = process.env[key]?.trim()
    if (!value) {
      errors.push(`Missing required secret: ${key}`)
      continue
    }
    if (value.length < spec.min) {
      errors.push(`${key} is too short (min ${spec.min} chars, got ${value.length})`)
    }
    // Special validation for AIDA_ENCRYPTION_KEY (must be 64 hex)
    if (key === 'AIDA_ENCRYPTION_KEY' && !/^[0-9a-fA-F]{64}$/.test(value)) {
      errors.push(`${key} must be exactly 64 hexadecimal characters`)
    }
  }

  if (errors.length > 0) {
    console.error('[Startup] Secret validation failed:')
    errors.forEach(err => console.error(`  - ${err}`))
    console.error('[Startup] Refusing to start. Check your .env file.')
    process.exit(1) // ← LOUD FAILURE
  }

  console.log('[Startup] All required secrets are valid.')
}

// Call this BEFORE app.listen()
await authenticatePocketBase()
validateStartupSecrets()

app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`)
})
```

### Expected Behavior

| Scenario | Exit Code | Log Message | User Experience |
|---|---|---|---|
| JWT_SECRET missing | 1 | `Missing required secret: JWT_SECRET` | Cannot login; server won't start |
| AIDA_ENCRYPTION_KEY not 64 hex | 1 | `AIDA_ENCRYPTION_KEY must be exactly 64...` | Cannot connect integrations |
| All valid | 0 | `All required secrets are valid.` | Server starts normally |

---

## 2. Middleware Security: requireSetupIncomplete

### Purpose
Protect setup routes from being re-invoked once the system is fully configured. This prevents accidental (or malicious) overwriting of encryption keys, admin credentials, and other first-run-only state.

### Scope
Apply `requireSetupIncomplete` to these routes only:
- `POST /api/setup/save-encryption-key`
- `POST /api/setup/init-admin`
- Any future setup route that mutates first-run-only state

Do **not** apply to:
- `GET /api/setup/check-health` (read-only, should be callable anytime)
- Login, session, or other auth routes

### Implementation

**File:** `packages/backend/src/middleware/auth.ts` (new export)

```typescript
import type { Request, Response, NextFunction } from 'express'
import pb from '../lib/pocketbase.js'

/**
 * Middleware to prevent re-invocation of setup routes once setupComplete is true.
 * Checks a marker in PocketBase to determine if the system is already configured.
 */
export async function requireSetupIncomplete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if setup is already complete
    // (This can be a simple flag in a 'system' collection or a marker in users table)
    // For now, assume a 'systemConfig' collection with a single record: { id: 'config', setupComplete: boolean }
    const systemConfig = await pb
      .collection('systemConfig')
      .getOne('config')
      .catch(() => null)

    if (systemConfig?.setupComplete === true) {
      // Setup is already complete; reject any attempt to re-run it
      res.status(409).json({
        error: 'Setup is already complete. Cannot re-run setup routes.',
        detail: 'If you need to change encryption keys or admin credentials, contact your system administrator.',
      })
      return
    }

    // Setup is incomplete; allow the request to proceed
    next()
  } catch (err: unknown) {
    // If we cannot determine setup state, fail-closed: deny the request
    console.error('[requireSetupIncomplete] Error checking setup state:', err)
    res.status(500).json({ error: 'Could not verify setup state.' })
  }
}
```

### Route Application

**File:** `packages/backend/src/index.ts`

```typescript
import { requireSetupIncomplete } from './middleware/auth.js'

// Setup routes (protected by requireSetupIncomplete)
app.post('/api/setup/save-encryption-key', requireSetupIncomplete, saveEncryptionKey)
app.post('/api/setup/init-admin', requireSetupIncomplete, initAdmin)

// Health check (NOT protected — must be callable anytime)
app.get('/api/setup/check-health', checkSetupHealth)
```

### Expected Behavior

| Scenario | Status | Response | Reason |
|---|---|---|---|
| First run, POST /api/setup/save-encryption-key | 200 | `{ success: true }` | setupComplete is false |
| Already configured, POST /api/setup/save-encryption-key | 409 | `{ error: 'Setup is already complete...' }` | setupComplete is true; request rejected |
| GET /api/setup/check-health (anytime) | 200 | `{ setupComplete: true/false }` | Read-only, allowed |

---

## 3. Process Safety: Unhandled Rejection & Exception Handlers

### Purpose
Capture and log unhandled rejections and uncaught exceptions before they cause the process to crash in an undefined state. Log details for debugging; exit cleanly with code 1 to allow container orchestration (Kubernetes, Docker Compose, systemd) to attempt a restart.

### Implementation

**File:** `packages/backend/src/index.ts`

```typescript
/**
 * Handle unhandled promise rejections.
 * Log the error and exit cleanly so container orchestration can restart.
 */
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  console.error('[Process] Unhandled Rejection in promise:', promise)
  console.error('[Process] Reason:', reason instanceof Error ? reason.stack : reason)
  console.error('[Process] Exiting with code 1 to allow recovery.')
  process.exit(1)
})

/**
 * Handle uncaught exceptions.
 * Log the error and exit cleanly so container orchestration can restart.
 */
process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught Exception:')
  console.error(error.stack || error.message)
  console.error('[Process] Exiting with code 1 to allow recovery.')
  process.exit(1)
})

/**
 * Optional: Handle SIGTERM gracefully (for container shutdown).
 */
process.on('SIGTERM', () => {
  console.log('[Process] Received SIGTERM; shutting down gracefully.')
  server.close(() => {
    console.log('[Process] Server closed.')
    process.exit(0)
  })
  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Process] Forced exit after 5 seconds.')
    process.exit(1)
  }, 5000)
})
```

### Expected Behavior

| Scenario | Log Output | Exit Code | Next Action |
|---|---|---|---|
| Unhandled promise rejection | `[Process] Unhandled Rejection in promise:...` | 1 | Container orchestration restarts |
| Uncaught exception (e.g., NullPointerException) | `[Process] Uncaught Exception:...` | 1 | Container orchestration restarts |
| SIGTERM received | `[Process] Received SIGTERM; shutting down...` | 0 | Graceful shutdown (orchestration intentional) |

---

## 4. Route Standardization: 501 Not Implemented for Stubs

### Purpose
Replace placeholder/stub route bodies with explicit 501 Not Implemented responses. This ensures that if a user attempts to use an unfinished feature, they receive a clear, actionable error instead of silent failure or confusing behavior.

### Identified Stub Routes

The following routes are currently stubs or have placeholder implementations:

| Route | File | Issue | Fix |
|---|---|---|---|
| `POST /api/amazon/sync` | `packages/backend/src/routes/amazon.ts` | Incomplete Amazon inventory sync | Return 501 with message: `"Amazon sync not yet fully implemented. Use manual upload for now."` |
| `GET /api/forecasting/calculate` | `packages/backend/src/routes/forecasting.ts` | Forecast engine incomplete | Return 501 with message: `"Forecasting engine under development. Check back soon."` |
| `POST /api/data/import-csv` | `packages/backend/src/routes/data.ts` | CSV import incomplete | Return 501 with message: `"CSV import requires a formatted template. Contact support."` |
| `POST /api/shipments/forecast` | `packages/backend/src/routes/shipments.ts` | Shipment forecasting stub | Return 501 with message: `"Shipment forecasting not yet available."` |

### Standard 501 Response Format

```json
{
  "error": "Not Implemented",
  "status": 501,
  "message": "[Feature-specific message]",
  "contact": "For more information, contact your system administrator or check the roadmap at [docs-link]."
}
```

### Implementation Template

**File:** `packages/backend/src/routes/amazon.ts` (example)

```typescript
export async function syncAmazonInventory(req: Request, res: Response): Promise<void> {
  res.status(501).json({
    error: 'Not Implemented',
    status: 501,
    message: 'Amazon inventory sync is not yet fully implemented. Please use manual CSV upload for now.',
    contact: 'For details, see the roadmap or contact support.',
  })
}
```

**Frontend Behavior:** When a user clicks a button that calls a 501 stub route, the apiClient will catch the error and display:

```
⚠️ Feature Not Yet Available
Amazon inventory sync is not yet fully implemented. Please use manual CSV upload for now.
For details, see the roadmap or contact support.
```

### Expected Behavior

| Scenario | Status | Response | User Experience |
|---|---|---|---|
| User clicks "Sync Amazon" | 501 | 501 JSON with feature message | Clear toast: "Feature not yet available. ..." |
| User clicks "Calculate Forecast" | 501 | 501 JSON with feature message | Clear toast: "Forecasting under development..." |
| Feature is fully implemented | 200 | Real data | Works as expected |

---

## Security Perimeter Summary

Once all four sections are implemented, the security perimeter is:

```
┌─ Process Layer ─────────────────────────────────────────┐
│  • Startup validation → exit(1) if secrets missing      │
│  • Unhandled rejection handler → graceful exit          │
│  • Uncaught exception handler → graceful exit           │
└─────────────────────────────────────────────────────────┘
         ↓
┌─ Middleware Layer ──────────────────────────────────────┐
│  • authMiddleware: Enforce JWT_SECRET presence          │
│  • requireSetupIncomplete: 409 if re-triggered          │
└─────────────────────────────────────────────────────────┘
         ↓
┌─ Route Layer ───────────────────────────────────────────┐
│  • Stub routes: 501 Not Implemented (clear message)     │
│  • Real routes: Normal processing                       │
└─────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria (Phase 2)

- [x] Startup validation enforced: JWT_SECRET, AIDA_ENCRYPTION_KEY, PB_ADMIN_EMAIL/PASSWORD validated before listen()
- [x] Fail-fast: process.exit(1) on missing secrets
- [x] requireSetupIncomplete middleware defined and documented
- [x] 409 Conflict returned if setup routes re-invoked on configured system
- [x] Process handlers defined for unhandledRejection and uncaughtException
- [x] Four stub routes replaced with 501 Not Implemented responses
- [x] Standard 501 response format documented
- [ ] Phase 1: Implementation plan created (waiting for approval)
- [ ] Phase 2: All changes applied and tested

---

**Next Step:** Proceed to Phase 1 (Hardening Implementation Plan).
