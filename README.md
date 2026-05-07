# AIDA ERP

AIDA ERP is a three-package npm monorepo for managing device inventory, refurbished sales, forecasting, RMA tracking, Amazon POs, and e-commerce integration. Built with React 19 + TypeScript 5.8, backed by PocketBase v0.30.0 and an Express 4 API layer with JWT + HttpOnly cookie authentication.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@aida/shared` | `packages/shared/` | TypeScript types, API envelopes, RBAC constants — shared by frontend and backend |
| `@aida/frontend` | `packages/frontend/` | React 19 + Vite 7 SPA — zero PocketBase SDK dependency |
| `@aida/backend` | `packages/backend/` | Express 4 API server — all PocketBase access, JWT signing, RBAC enforcement |

## Requirements

- Node.js 20+
- npm 10+ (workspaces support)
- PocketBase v0.30.0 (`pocketbase.exe` in repo root)

## Local Development

### 1. Install all dependencies

```powershell
npm install
```

### 2. Configure environment variables

Backend (create `packages/backend/.env`):

```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:5173
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=your-admin-password
JWT_SECRET=generate-a-strong-random-string-here
VITE_ENCRYPTION_KEY=generate-64-hex-chars-here
WC_STORE_URL=https://your-woocommerce-store.com
```

Frontend (create `packages/frontend/.env.local`):

```env
VITE_API_URL=http://localhost:3001
VITE_ENCRYPTION_KEY=same-64-hex-value-as-backend
```

> **Security:** `VITE_ENCRYPTION_KEY` must be the same 64-character hex string (32 bytes) in both files. Never commit either `.env` file. Rotate the key and re-encrypt stored credentials if the key is ever exposed.

### 3. Start PocketBase

```powershell
.\pocketbase.exe serve --dir .\pb_data
```

PocketBase Admin UI: `http://127.0.0.1:8090/_/`

### 4. Start backend

```powershell
npm run dev -w @aida/backend
```

Express server: `http://localhost:3001`

### 5. Start frontend

```powershell
npm run dev -w @aida/frontend
```

Vite dev server: `http://localhost:5173`

## Architecture

### Request Flow

```
Browser → packages/frontend (React + apiClient)
       → packages/backend (Express + JWT auth + RBAC)
       → PocketBase (data layer, admin auth only)
```

The frontend SDK for PocketBase is **not installed**. All database access goes through the Express backend using the PocketBase Admin SDK, which is never exposed to the browser.

### Authentication

- Login: `POST /api/auth/login` → PocketBase validates credentials → backend signs JWT → sets `aida_session` (15 min) + `aida_refresh` (7 days) as `HttpOnly; Secure; SameSite=Strict` cookies
- Session restore: `GET /api/auth/session` → returns `User | null`
- No tokens in localStorage. No PocketBase client in the browser.

### RBAC

Four roles: `Admin`, `Manager`, `Staff`, `Viewer`. Eight modules with three permission levels: `Editor`, `Viewer`, `None`. The full matrix lives in `packages/shared/src/constants/roles.ts`.

Backend middleware `requireRole(module, level)` enforces 403 on insufficient permission. The `roles` map is derived server-side on every request — never stored in the JWT.

### E-Commerce Integration

Two data ingestion paths:

**Manual CSV** (no credentials required):
- Upload a CSV with columns `sku, quantity, saleDate, salePrice` via the CSVImport component
- `POST /api/data/import` validates SKUs and creates `salesData` records with `source: "manual_csv"`
- See [docs/csv_schema.md](docs/csv_schema.md)

**WooCommerce Sync** (requires API credentials):
- Enter Consumer Key + Consumer Secret in the WoocommerceSetup component
- Credentials are encrypted **in the browser** (AES-256-GCM, random IV) before being sent to the backend
- Backend stores the encrypted blob in `userPreferences.encryptedWoocommerceKey` — never the plaintext
- Sync: `POST /api/ecommerce/sync` → backend decrypts → creates `ecommerceSyncLog` record → PocketBase hook performs WooCommerce API calls → `salesData` records created

### Security

- See [docs/integration_security.md](docs/integration_security.md) for the full threat model
- See [docs/security_audit_phase2.md](docs/security_audit_phase2.md) for the Phase 2 audit (8/8 threats mitigated)
- CSRF: origin guard middleware (fail-closed) on all non-GET requests
- No credentials, tokens, or encryption keys in the browser bundle

## Available Scripts

### Root workspace

```powershell
npm install              # install all packages
```

### Backend (`-w @aida/backend`)

```powershell
npm run dev -w @aida/backend      # tsx watch — hot reload
npm run start -w @aida/backend    # production-like start
npm run typecheck -w @aida/backend
```

### Frontend (`-w @aida/frontend`)

```powershell
npm run dev -w @aida/frontend
npm run build -w @aida/frontend
npm run preview -w @aida/frontend
npm run lint -w @aida/frontend
npm run typecheck -w @aida/frontend
npm run smoke:test -w @aida/frontend
```

### Shared (`-w @aida/shared`)

```powershell
npm run typecheck -w @aida/shared
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/logout` | Clear session cookies |
| GET | `/api/auth/session` | Return current user or null |

### Inventory
| Method | Path | RBAC |
|--------|------|------|
| GET | `/api/inventory/devices` | Inventory: Viewer |
| POST | `/api/inventory/devices` | Inventory: Editor |
| PATCH | `/api/inventory/devices/:id` | Inventory: Editor |
| DELETE | `/api/inventory/devices/:id` | Inventory: Editor |
| POST | `/api/inventory/devices/:id/adjust` | Inventory: Editor |
| GET | `/api/inventory/components` | Inventory: Viewer |
| POST | `/api/inventory/components` | Inventory: Editor |

### Forecasting
| Method | Path | RBAC |
|--------|------|------|
| GET | `/api/forecasting?mode=device\|component` | Forecasting: Viewer |
| GET | `/api/forecasting/vendor-configs` | Forecasting: Viewer |
| POST | `/api/forecasting/vendor-configs` | Forecasting: Editor |

### E-Commerce
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/data/import` | Import sales data from CSV |
| POST | `/api/ecommerce/sync` | Trigger WooCommerce sync |

### Preferences
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/preferences` | Fetch user preferences |
| PATCH | `/api/users/preferences` | Update preferences (including encrypted WooCommerce key) |

## PocketBase Hooks

PocketBase server-side hooks live in `pocketbase/pb_hooks/`:

| File | Purpose |
|------|---------|
| `ecommerce.pb.js` | `beforeCreate(ecommerceSyncLog)` — runs WooCommerce sync, strips `decryptedKeyTemp` |
| `woocommerce-client.pb.js` | Paginated WooCommerce REST API v3 client |
| `sales-data-transform.pb.js` | Maps WC order line items → `salesData` records |

## Verification Checklist

Run before every production deploy:

```powershell
# Zero PocketBase SDK imports in frontend
grep -r "pocketbase" packages/frontend/src/ --include="*.ts" --include="*.tsx"

# TypeScript passes all three packages
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit -p packages/frontend/tsconfig.app.json

# Encryption key not in built bundle (run after npm run build -w @aida/frontend)
grep -r "VITE_ENCRYPTION_KEY" packages/frontend/dist/ 2>$null || Write-Host "PASS: key not in bundle"
```

## Related Docs

| Doc | Description |
|-----|-------------|
| [docs/integration_security.md](docs/integration_security.md) | E-commerce integration security spec + threat model |
| [docs/security_audit_phase2.md](docs/security_audit_phase2.md) | Phase 2 security audit results |
| [docs/csv_schema.md](docs/csv_schema.md) | CSV import format + validation rules |
| [docs/implementation_plan.md](docs/implementation_plan.md) | Phase 1-3 implementation plan |
| [docs/migration_spec.md](docs/migration_spec.md) | Monorepo migration functional specification |
| [AIDA_SETUP_GUIDE.md](AIDA_SETUP_GUIDE.md) | PocketBase collection setup |
| [POCKETBASE_SETUP_GUIDE.md](POCKETBASE_SETUP_GUIDE.md) | PocketBase configuration guide |

## Data

- PocketBase runtime data: `pb_data/`
- PocketBase public assets: `pb_public/`
- PocketBase hooks: `pocketbase/pb_hooks/`
- Frontend build output: `packages/frontend/dist/`

