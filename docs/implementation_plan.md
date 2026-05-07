# AIDA ERP Monorepo Implementation Plan

**Status:** Phase 1 Planning (awaiting execution signal)  
**Created:** May 7, 2026  
**Integration:** Merges migration_spec.md + integration_security.md  
**Reference architectures:** docs/split_architecture_plan.md, docs/integration_security.md, docs/migration_spec.md

---

## Executive Summary

This plan distributes the three-package monorepo + encrypted e-commerce integration across four specialized agents:

| Agent | Role | Phases | Key Deliverables |
|-------|------|--------|------------------|
| **GPT-4.1** | The Intern | Phase 1 | Monorepo scaffolding + Manual CSV upload (frontend + backend) |
| **Claude Haiku** | The Junior | Phase 2 | Encryption utilities + Type definitions (@aida/shared) |
| **Claude Sonnet** | The Senior | Phase 2 | Express routes + PocketBase hooks + PB v0.30.0 client |
| **GPT-5** | The Auditor | Phase 2 | Security audit on credential encryption + threat validation |

**Total Effort:** 3 phases, ~200 lines of code per agent (well-scoped tasks)

---

## Phase 1: Scaffolding + Manual CSV Mode (GPT-4.1)

**Goal:** Set up the basic monorepo structure and implement manual CSV upload as Phase 1's primary data ingestion path (no credentials required).

### 1.1 Scaffolding Tasks

#### Task 1a: Create Monorepo Folder Structure
**Deliverable:** Folder scaffold + package.json root  
**Time:** ~30 min

```bash
# Create directories
mkdir -p packages/{shared,frontend,backend}
mkdir -p packages/shared/src/{types,api,constants}
mkdir -p packages/frontend/src/lib
mkdir -p packages/backend/src/{lib,routes,middleware,types}

# Root package.json with workspaces
cat > package.json << 'EOF'
{
  "name": "aida-erp-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @aida/frontend & npm run dev -w @aida/backend",
    "build": "npm run build -w @aida/shared && npm run build -w @aida/frontend && npm run build -w @aida/backend",
    "lint": "npm run lint -w @aida/shared && npm run lint -w @aida/frontend && npm run lint -w @aida/backend",
    "type-check": "npm run type-check -w @aida/shared && npm run type-check -w @aida/frontend && npm run type-check -w @aida/backend"
  }
}
EOF
```

**Files to create:**
- [ ] `packages/shared/package.json` (NodeNext module resolution)
- [ ] `packages/frontend/package.json` (React 19 + Vite 7)
- [ ] `packages/backend/package.json` (Express 4 + TypeScript)
- [ ] Root `.npmrc` (workspace settings)
- [ ] Root `tsconfig.json` (base config)

**Verification:**
```bash
npm install           # Installs all dependencies
npm run type-check   # Should pass with zero errors
```

---

#### Task 1b: Copy Shared Types (from migration_spec.md §1)
**Deliverable:** @aida/shared type files  
**Time:** ~20 min

**Source → Target mapping:**
```
src/types/device.ts                    → packages/shared/src/types/device.ts
src/types/component.ts                 → packages/shared/src/types/component.ts
src/types/amazon.ts                    → packages/shared/src/types/amazon.ts
src/types/history.ts                   → packages/shared/src/types/history.ts
src/types/inbound.ts                   → packages/shared/src/types/inbound.ts
src/types/inventory.ts                 → packages/shared/src/types/inventory.ts
src/types/order.ts                     → packages/shared/src/types/order.ts
src/types/refurbished.ts               → packages/shared/src/types/refurbished.ts
src/types/rma.ts                       → packages/shared/src/types/rma.ts
src/types/shipment.ts                  → packages/shared/src/types/shipment.ts
src/types/stock.ts                     → packages/shared/src/types/stock.ts
src/types/user.ts                      → packages/shared/src/types/user.ts (REWRITE)
src/types/forecast.ts (partial)        → packages/shared/src/types/forecastPrimitives.ts
                                       + packages/shared/src/types/forecast.ts
```

**Special handling:**
- **user.ts (REWRITE):** Remove RecordModel, create plain User interface (see §1.1 of migration_spec)
- **forecast.ts (SPLIT):** Move utility types to forecastPrimitives.ts, ForecastItem to forecast.ts

**Files to create/modify:**
- [ ] Copy all type files verbatim (except user.ts)
- [ ] Rewrite user.ts with canonical User interface
- [ ] Create forecastPrimitives.ts with utility types
- [ ] Create forecast.ts with ForecastItem + imports
- [ ] Create vendor.ts with VendorConfig

**Verification:**
```bash
npm run type-check -w @aida/shared  # Zero errors
```

---

#### Task 1c: Create API Envelopes (from migration_spec.md §2)
**Deliverable:** @aida/shared API envelope types  
**Time:** ~30 min

**Files to create:**
- [ ] `packages/shared/src/api/auth.ts` (LoginRequest, LoginResponse, SessionResponse)
- [ ] `packages/shared/src/api/inventory.ts` (Device/Component CRUD envelopes)
- [ ] `packages/shared/src/api/forecasting.ts` (ForecastMode, GetForecastResponse)
- [ ] `packages/shared/src/api/amazon.ts` (Amazon PO envelopes)
- [ ] `packages/shared/src/api/rma.ts` (RMA envelopes)
- [ ] `packages/shared/src/api/shipments.ts` (Shipment envelopes)
- [ ] `packages/shared/src/api/orders.ts` (Order/Refurbished envelopes)

**Verification:**
```bash
npm run type-check -w @aida/shared  # Zero errors
```

---

#### Task 1d: Create RBAC Constants (from migration_spec.md §4.1)
**Deliverable:** @aida/shared RBAC matrix  
**Time:** ~15 min

**File:**
- [ ] `packages/shared/src/constants/roles.ts`
  - `AppRole` type
  - `ModuleName` type
  - `PermissionLevel` type
  - `UserRoles` type
  - `ROLE_PERMISSIONS` constant (exact matrix from migration_spec §4.1)

**Verification:**
```bash
npm run type-check -w @aida/shared  # Zero errors
```

---

#### Task 1e: Create Barrel Exports (from migration_spec.md §1.3)
**Deliverable:** @aida/shared index.ts  
**Time:** ~10 min

**File:**
- [ ] `packages/shared/src/index.ts` (re-export all types, API envelopes, constants)

**Verification:**
```bash
npm run type-check -w @aida/shared  # Zero errors
```

---

### 1.2 Manual CSV Upload Implementation

#### Task 2a: Frontend CSV Import Component
**Deliverable:** CSVImport React component (from integration_security.md §5.2)  
**Time:** ~40 min

**File:**
- [ ] `packages/frontend/src/components/CSVImport.tsx`
  - File input + upload button
  - Real-time status display
  - Error reporting (per-row)
  - Success summary

**Dependencies:**
- React 19 hooks (useState, useRef)
- apiClient (to be created in Phase 2)

**Stub apiClient for now:**
```tsx
// packages/frontend/src/lib/apiClient.ts (stub)
export const apiClient = {
  post: async (url: string, data: any) => {
    // Will be implemented in Phase 2
    throw new Error('Not yet implemented')
  }
}
```

**Verification:**
```bash
npm run type-check -w @aida/frontend  # Zero errors
# Component renders without runtime errors (stub apiClient)
```

---

#### Task 2b: CSV Format Documentation
**Deliverable:** CSV schema + example  
**Time:** ~10 min

**File:**
- [ ] `docs/csv_schema.md`
  - CSV header: `sku,quantity,saleDate,salePrice`
  - Data type requirements
  - Example rows (3-5 samples)
  - Validation rules

**Verification:**
- Documentation is clear and actionable

---

### 1.3 Backend CSV Parser Setup

#### Task 3a: CSV Parser Utility (from integration_security.md §6.2)
**Deliverable:** CSV parsing logic  
**Time:** ~20 min

**File:**
- [ ] `packages/backend/src/lib/csvParser.ts`
  - parseCSV(csvText: string) → Record<string, any>[]
  - Handles header row + data rows
  - Ignores malformed rows (returns empty array for that row)

**Verification:**
```bash
npm run type-check -w @aida/backend  # Zero errors
# Unit test: parseCSV('sku,qty\nABC,5') → [{ sku: 'ABC', qty: '5' }]
```

---

#### Task 3b: CSV Import Route Skeleton (from integration_security.md §4.3)
**Deliverable:** POST /api/data/import route  
**Time:** ~30 min

**File:**
- [ ] `packages/backend/src/routes/csvImport.ts`
  - POST /api/data/import handler
  - Reads req.file (multipart)
  - Calls parseCSV()
  - **Stub PocketBase operations** (to be filled in Phase 2)

**Stub implementation:**
```typescript
export async function importSalesDataCSV(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'No file provided' })
    return
  }

  const records = parseCSV(file.buffer.toString('utf-8'))
  
  // TODO: Validate SKUs against inventory (Phase 2)
  // TODO: Create records in PB salesData collection (Phase 2)
  
  res.status(200).json({
    recordsImported: records.length,
    errors: []
  })
}
```

**Verification:**
```bash
npm run type-check -w @aida/backend  # Zero errors
# Integration test: POST /api/data/import with CSV file → returns { recordsImported, errors }
```

---

### 1.4 Express App Skeleton (Phase 2 entry point)

#### Task 4a: Express Setup
**Deliverable:** Minimal Express app  
**Time:** ~20 min

**File:**
- [ ] `packages/backend/src/index.ts`
  - Express app initialization
  - Middleware stack (json, urlencoded, cors, cookies)
  - Health check endpoint: GET /api/health
  - CSV import route registration
  - Error handler
  - **Stub PocketBase auth** (to be filled in Phase 2)

**Stub implementation:**
```typescript
import express from 'express'
import { importSalesDataCSV } from './routes/csvImport.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// TODO: Add auth middleware (Phase 2)
// app.use(authMiddleware)

// CSV Import
app.post('/api/data/import', importSalesDataCSV)

// Start
app.listen(PORT, () => {
  console.log(`[Express] Server running on http://localhost:${PORT}`)
})

export default app
```

**Verification:**
```bash
npm run dev -w @aida/backend
curl http://localhost:3001/api/health  # Should return { status: 'ok' }
```

---

### 1.5 Integration Testing (Manual CSV Flow)

#### Task 5a: End-to-End CSV Upload Test
**Deliverable:** Documented test procedure  
**Time:** ~20 min

**Test procedure:**
1. Start backend: `npm run dev -w @aida/backend`
2. Create test CSV file:
   ```csv
   sku,quantity,saleDate,salePrice
   DEVICE-001,5,2026-05-07T10:00:00Z,299.99
   ```
3. POST to /api/data/import with CSV
4. Verify response: `{ recordsImported: 1, errors: [] }`

**File:**
- [ ] `docs/manual_csv_test.md` (step-by-step instructions)

---

## Phase 2: Encryption + Backend Core + PB Hooks (Claude Haiku + Claude Sonnet + GPT-5)

**Goal:** Implement credential encryption, backend routes, and PocketBase hooks for WooCommerce integration.

### 2.1 Claude Haiku: Encryption + Type Updates

#### Task H1: Web Crypto API Encryption (from integration_security.md §2.1)
**Deliverable:** crypto.ts with encryptCredential/decryptCredential  
**Time:** ~60 min

**File:**
- [ ] `packages/frontend/src/lib/crypto.ts`
  - encryptCredential(plaintext, encryptionKeyHex) → encrypted blob
  - decryptCredential(blob, encryptionKeyHex) → plaintext
  - Helper functions: hexToBytes, bytesToHex
  - Uses Web Crypto API (AES-256-GCM with random IV)

**Tests:**
- [ ] Encrypt "key:secret" → different output each time (random IV)
- [ ] Decrypt output → recovers original plaintext
- [ ] Invalid key → throws error

**Verification:**
```bash
npm run type-check -w @aida/frontend  # Zero errors
# Unit tests pass
```

---

#### Task H2: IntegrationSettings Type + Updates
**Deliverable:** New types in @aida/shared  
**Time:** ~30 min

**Files:**
- [ ] `packages/shared/src/types/integration.ts` (NEW)
  ```typescript
  export interface IntegrationSettings {
    userId: string
    encryptedWoocommerceKey: string  // encrypted blob from Web Crypto
    woocommerceStoreUrl?: string
    syncLastRun?: string
    syncStatus: 'idle' | 'syncing' | 'error'
  }
  ```
- [ ] Update `packages/shared/src/api/auth.ts` to export `UpdatePreferencesRequest` type
  ```typescript
  export interface UpdatePreferencesRequest {
    encryptedWoocommerceKey?: string
    velocityOverrides?: Record<string, 'sales' | 'inventory'>
    vendorConfigs?: Record<string, VendorConfig>
  }
  ```

**Verification:**
```bash
npm run type-check -w @aida/shared  # Zero errors
```

---

#### Task H3: WoocommerceSetup Component (from integration_security.md §5.1)
**Deliverable:** Frontend UI for credential entry  
**Time:** ~40 min

**File:**
- [ ] `packages/frontend/src/components/WoocommerceSetup.tsx`
  - Consumer Key + Consumer Secret password inputs
  - "Save & Encrypt" button
  - Real-time encryption + API call
  - Error display
  - Success message

**Dependencies:**
- encryptCredential from crypto.ts
- apiClient.patch (to be implemented in Phase 2)

**Verification:**
```bash
npm run type-check -w @aida/frontend  # Zero errors
# Component renders and encrypts without errors (stub apiClient)
```

---

### 2.2 Claude Sonnet: Backend Core + PB Hooks

#### Task S1: PocketBase Singleton (from previous Phase 3 work)
**Deliverable:** PB admin client  
**Time:** ~30 min

**File:**
- [ ] `packages/backend/src/lib/pocketbase.ts`
  - PocketBase instance with _superusers auth
  - authenticatePocketBase() function
  - Error handling

---

#### Task S2: Backend Decryption Utility (from integration_security.md §4.1)
**Deliverable:** decryption.ts using Node crypto  
**Time:** ~30 min

**File:**
- [ ] `packages/backend/src/lib/decryption.ts`
  - decryptWoocommerceKey(encryptedBlob, keyHex) → plaintext
  - Uses Node.js crypto.createDecipheriv (inverse of frontend Web Crypto)
  - Error handling

**Tests:**
- [ ] Encrypt in frontend, decrypt in backend → original plaintext
- [ ] Invalid key → throws error

---

#### Task S3: PocketBase Hook: ecommerce.pb.js (from integration_security.md §3.2)
**Deliverable:** Main WooCommerce sync hook  
**Time:** ~90 min

**File:**
- [ ] `pocketbase/pb_hooks/ecommerce.pb.js`
  - beforeCreate('ecommerceSyncLog') hook
  - Reads decryptedKeyTemp from request context
  - Calls WooCommerceClient to fetch products + orders
  - Calls transformWCToSalesData()
  - Creates salesData records in PB
  - Returns sync log

**PB v0.30.0 syntax:**
- $app.db().collection('name')
- collection.create(data)
- $os.getenv() for environment vars
- http.Client() for outbound requests

---

#### Task S4: WooCommerce Client Hook (from integration_security.md §3.3)
**Deliverable:** woocommerce-client.pb.js  
**Time:** ~60 min

**File:**
- [ ] `pocketbase/pb_hooks/woocommerce-client.pb.js`
  - WooCommerceClient class
  - getProducts(perPage) → paginated products
  - getOrders(perPage) → paginated orders
  - Basic HTTP auth (consumer_key:consumer_secret)
  - Error handling + retry logic

---

#### Task S5: Transform Hook (from integration_security.md §3.4)
**Deliverable:** sales-data-transform.pb.js  
**Time:** ~40 min

**File:**
- [ ] `pocketbase/pb_hooks/sales-data-transform.pb.js`
  - transformWCToSalesData(wcProducts, wcOrders, userId) → salesData records
  - Maps WC product.sku → AIDA salesData.sku
  - Creates one record per order line item
  - Includes source: 'woocommerce' + external IDs

---

#### Task S6: E-Commerce Sync Route (from integration_security.md §4.2)
**Deliverable:** POST /api/ecommerce/sync endpoint  
**Time:** ~50 min

**File:**
- [ ] `packages/backend/src/routes/ecommerce.ts`
  - POST /api/ecommerce/sync handler
  - requireAuth() + RBAC check
  - Fetch encrypted key from userPreferences
  - Decrypt using decryptWoocommerceKey()
  - Create ecommerceSyncLog record (hook processes)
  - Return sync result

**Verification:**
```bash
POST /api/ecommerce/sync (with auth)
→ { recordsImported: N, status: 'success' }
```

---

#### Task S7: Auth Middleware + Routes (from previous Phase 3 work)
**Deliverable:** JWT auth + login/logout/session endpoints  
**Time:** ~80 min (if not already complete)

**Files:**
- [ ] `packages/backend/src/middleware/auth.ts` (authMiddleware, requireAuth)
- [ ] `packages/backend/src/routes/auth.ts` (POST /login, /logout, GET /session)
- [ ] `packages/backend/src/types/express.d.ts` (Request augmentation)

---

#### Task S8: Preferences Route Update
**Deliverable:** Extend preferences route for encrypted keys  
**Time:** ~20 min

**File:**
- [ ] Update `packages/backend/src/routes/preferences.ts`
  - PATCH /api/users/preferences accepts encryptedWoocommerceKey
  - Stores encrypted blob as-is (never decrypts)
  - Validation: blob format check

---

#### Task S9: Express App Integration
**Deliverable:** Register all routes in Express app  
**Time:** ~20 min

**File:**
- [ ] Update `packages/backend/src/index.ts`
  - Mount auth routes
  - Mount CSV import route
  - Mount ecommerce sync route
  - Mount preferences route
  - Auth middleware setup

---

### 2.3 GPT-5: Security Audit (Credential Encryption)

#### Task G1: Threat Model Validation
**Deliverable:** Security audit report  
**Time:** ~120 min

**Scope:**
1. **Database Leak (without VITE_ENCRYPTION_KEY):**
   - Verify encryptedWoocommerceKey in DB is unreadable without key ✓
   - Verify random IV prevents pattern matching ✓
   - Verify AES-256-GCM provides authenticity (no tampering) ✓

2. **Client-Side Key Extraction:**
   - Verify VITE_ENCRYPTION_KEY does NOT appear in bundle ✓
   - Verify .env.local is excluded from git ✓
   - Verify key is only used in crypto.ts ✓

3. **Network Traffic:**
   - Verify encrypted blob is sent over HTTPS only ✓
   - Verify plaintext key is NEVER transmitted ✓
   - Verify credentials are only decrypted server-side ✓

4. **Hook Security:**
   - Verify decryptedKeyTemp is not logged ✓
   - Verify PB hooks are read-only in production ✓
   - Verify WooCommerce API key rotation is supported ✓

**Deliverable:**
- [ ] `docs/security_audit_phase2.md`
  - Threat model analysis (8 scenarios)
  - Verification results (pass/fail)
  - Residual risks
  - Recommendations

**Sign-off:** All critical threats mitigated, low residual risk

---

## Phase 3: Validation & Final Commit (Claude Sonnet)

**Goal:** Run the full verification checklist and prepare production deployment.

### 3.1 Verification Checklist (from migration_spec.md §8 + integration_security.md §9)

#### Task V1: Code Validation
**Deliverable:** Comprehensive type + lint checks  
**Time:** ~30 min

**Checks:**
```bash
# Zero PocketBase imports in frontend
grep -r "pocketbase" packages/frontend/ 2>/dev/null | grep -v node_modules || echo "✓ PASS"

# Zero VITE_PB_URL references
grep -r "VITE_PB_URL" packages/frontend/ 2>/dev/null || echo "✓ PASS"

# Zero localStorage auth usage
grep -r "localStorage.*auth\|localStorage.*token\|localStorage.*key" packages/frontend/src/ 2>/dev/null || echo "✓ PASS"

# TypeScript compilation
npm run type-check

# Lint (if configured)
npm run lint
```

---

#### Task V2: Manual CSV Flow Test
**Deliverable:** E2E test results  
**Time:** ~30 min

**Test steps:**
1. Start backend: `npm run dev -w @aida/backend`
2. Upload CSV via /api/data/import
3. Verify records created in PB
4. Verify response: `{ recordsImported: N, errors: [] }`

**Test data:**
```csv
sku,quantity,saleDate,salePrice
DEVICE-001,5,2026-05-07T10:00:00Z,299.99
DEVICE-002,2,2026-05-07T11:00:00Z,199.99
```

---

#### Task V3: Encryption Flow Test
**Deliverable:** E2E encryption test results  
**Time:** ~30 min

**Test steps:**
1. Frontend encrypts "key:secret" using VITE_ENCRYPTION_KEY
2. PATCH /api/users/preferences with encrypted blob
3. Backend reads encrypted blob from DB
4. Backend decrypts using VITE_ENCRYPTION_KEY
5. Verify plaintext matches original

**Verification:** No plaintext credentials in Network tab (DevTools)

---

#### Task V4: RBAC Validation
**Deliverable:** Role-based access test results  
**Time:** ~30 min

**Test scenarios:**
- Admin user → can access all endpoints
- Manager user → can access inventory + forecasting (Editor), cannot access Admin
- Staff user → can access inventory (Viewer), inbound shipments (Editor)
- Viewer user → can access all endpoints (Viewer only)

**Endpoint to test:** GET /api/inventory/devices with role variations

---

#### Task V5: Final Git Commit
**Deliverable:** Clean git history with meaningful commits  
**Time:** ~20 min

**Commits:**
```bash
git commit -m "arch(phase-1): monorepo scaffolding + manual CSV upload"
git commit -m "arch(phase-2): encryption + backend core + PB hooks"
git commit -m "arch(phase-3): validation + security audit complete"
```

**Files included:**
- packages/shared/* (types, API envelopes, constants)
- packages/frontend/* (components, hooks, crypto utilities)
- packages/backend/* (Express routes, middleware, PB hooks)
- pocketbase/pb_hooks/* (WooCommerce integration)
- docs/integration_security.md, docs/security_audit_phase2.md, etc.

---

#### Task V6: README Update
**Deliverable:** Updated README with security section  
**Time:** ~20 min

**Sections to add:**
- Installation (monorepo setup)
- Development (running all packages)
- Security (encryption key management, .env.local)
- E-Commerce Integration (manual CSV vs WooCommerce)
- Deployment (environment variables, Docker, reverse proxy)

---

## Implementation Timeline

| Phase | Agent | Duration | Key Milestones |
|-------|-------|----------|-----------------|
| **Phase 1** | GPT-4.1 | 4-5 hours | ✓ Monorepo scaffolding ✓ Manual CSV upload ✓ Test procedure |
| **Phase 2A** | Claude Haiku | 2-3 hours | ✓ Encryption utilities ✓ Type definitions ✓ UI components |
| **Phase 2B** | Claude Sonnet | 6-8 hours | ✓ Backend routes ✓ PB hooks ✓ WooCommerce client |
| **Phase 2C** | GPT-5 | 2-3 hours | ✓ Security audit ✓ Threat validation ✓ Sign-off |
| **Phase 3** | Claude Sonnet | 3-4 hours | ✓ Verification ✓ E2E tests ✓ Final commit |
| **Total** | All | **17-23 hours** | Production-ready monorepo + encrypted e-commerce integration |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Encryption key leaked in .env.local | High | Never commit .env.local; use .env.local.example; rotate key if leaked |
| PB Hook syntax errors in v0.30.0 | Medium | Test hooks locally before deployment; reference PB docs |
| CSV parser edge cases (quotes, commas in data) | Low | Add quote handling; document CSV format clearly |
| Monorepo dependency conflicts | Medium | Use npm workspaces; test build across packages |
| Network interception of credentials | Low | Use HTTPS + Same-Site cookies; never send key over HTTP |

---

## Sign-Off Criteria (Phase 3 Complete)

- [ ] All scaffolding tasks complete (Phase 1)
- [ ] Encryption utilities tested (Phase 2A)
- [ ] All backend routes functional (Phase 2B)
- [ ] PB hooks v0.30.0 compatible (Phase 2B)
- [ ] Security audit passed (Phase 2C)
- [ ] Manual CSV upload E2E tested (Phase 3)
- [ ] Encryption flow verified (no plaintext in Network tab) (Phase 3)
- [ ] RBAC validation complete (Phase 3)
- [ ] Git history clean + commits meaningful (Phase 3)
- [ ] README + docs updated (Phase 3)
- [ ] Zero compile errors (npm run type-check passes) (Phase 3)

**Status:** Ready for Phase 1 execution on signal

---

## Next Steps

1. **Approve this plan** — Confirm task breakdown and timeline
2. **Signal Phase 1 start** — GPT-4.1 begins scaffolding
3. **Monitor Phase transitions** — Verify each phase completion before proceeding
4. **Conduct security audit** — GPT-5 validates encryption before Phase 3
5. **Final deployment prep** — Ensure production environment variables are set

---

**This plan is approved and awaits your execution signal.**
