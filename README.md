# AIDA ERP

AIDA ERP is a self-hosted inventory, logistics, and refurbishment operations platform designed for small teams and solo refurbishers. It combines inventory control, inbound/outbound shipment tracking, Amazon FBA stock and PO processing, RMA/returns management, demand forecasting, sales data analytics, e-commerce integrations, and role-based access control in one unified application.

## Features

- **Inventory Management**: Comprehensive tracking for devices, components, accessories, and refurbished stock.
- **Shipment & Logistics**: Inbound shipment receiving, tracking numbers, and shipping history.
- **Amazon Operations**: Purchase orders, variants, FBA stock tracking, and inventory sync.
- **RMA & Returns**: End-to-end return merchandise authorization and EU return workflows.
- **Forecasting & Analytics**: Sales velocity modeling, stock forecasting, and purchase order recommendations.
- **Integrations**: Direct sync with WooCommerce and Shopify with encrypted credential storage.
- **Flexible Workspace Modes**: Choose between multi-user **Team Mode** with fine-grained RBAC or streamlined **Personal (Solo) Mode**.
- **Self-Hosted & Private**: PocketBase SQLite database behind an Express API; your business data never leaves your infrastructure.
- **Audit Logging**: Comprehensive mutation audits, diff tracking, and authentication logging with automatic secret redaction.

---

## Quick Start with Docker

### Requirements

- Docker Engine with Docker Compose v2
- A machine or VPS with at least 2 GB of available RAM

### 1. Configure Environment

Copy the example environment file:

```sh
cp .env.example .env
```

Open `.env` and set a secure value for `JWT_SECRET` (minimum 32 characters):

```sh
# Generate a random 32-character base64 secret:
openssl rand -base64 32
```

*(All other values have sensible defaults. PocketBase superuser credentials and integration encryption keys can be created directly in the browser during the first-run wizard).*

### 2. Start the Containers

Launch the application using Docker Compose:

```sh
docker compose up -d --build
```

The database container (`aida-database`) and application container (`aida-application`) will start.

### 3. Complete the In-Browser Setup Wizard

Open your browser to:

```
http://localhost:3001
```

On a fresh installation, AIDA automatically launches the interactive Setup Wizard:

1. **Health Check**: Verifies internal connectivity between Express and PocketBase.
2. **Superuser Bootstrap**: Creates your database administrative credentials securely without exposing the PocketBase admin UI.
3. **Encryption Key**: Generates a 64-character hexadecimal key to protect integration secrets (stored in a persistent Docker volume).
4. **Initialize Collections**: Automatically creates and verifies all required database tables, fields, and API rules.
5. **Workspace Mode**: Select your operational model (**Team** or **Solo**).
6. **First Admin Account**: Creates your primary AIDA user account (role: Admin).
7. **Complete**: Locks the setup endpoints against tampering and redirects to login.

Sign in with your newly created admin credentials to access the AIDA dashboard.

> [!NOTE]
> **Database Access**: For security, PocketBase port 8090 is bound to `127.0.0.1:8090` by default. The browser communicates exclusively with the Express application on port 3001. If you need remote access to the PocketBase Admin UI, use an SSH tunnel (`ssh -L 8090:127.0.0.1:8090 user@host`).

---

## Workspace Modes

AIDA adapts to how you run your business:

### Team Mode
Designed for multi-operator teams. Provides granular Role-Based Access Control (RBAC) across four tiers:
- **Admin**: Full access, including user management, role assignments, and system preferences.
- **Manager**: Module management, inventory alterations, forecasting adjustments, and order processing.
- **Staff**: Operational access to scan items, update shipment statuses, and record inventory changes.
- **Viewer**: Read-only oversight across inventory, forecasting, and reports.

### Personal (Solo Operator) Mode
Built for independent refurbishers and single-operator technicians:
- Selecting **Solo Mode** in the setup wizard or logging in with `owner@local.aida` activates Personal Mode.
- Personal Mode streamlines the user interface by hiding unnecessary multi-user administrative views, keeping your workflow centered on inventory, logistics, forecasting, and e-commerce integrations.
- For local development with personal mode, set `VITE_LOCAL_OWNER_PASSWORD` in your frontend configuration.

---

## Configuration Reference

The root `.env` file controls Docker Compose and container runtime settings:

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `JWT_SECRET` | **Yes** | — | Secret key used to sign session tokens (min 32 characters). |
| `PORT` | No | `3001` | External HTTP port exposed by the web container. |
| `ALLOWED_ORIGIN` | No | `http://localhost:3001` | Allowed browser origins for CORS and CSRF guards (comma-separated). |
| `PB_URL` | No | `http://pocketbase:8090` | Internal URL used by Express to reach PocketBase. |
| `PB_ADMIN_EMAIL` | No | *(empty)* | Optional. Pre-seeds a superuser on first boot, bypassing the wizard step. |
| `PB_ADMIN_PASSWORD` | No | *(empty)* | Optional. Password for pre-seeded superuser (min 8 characters). |
| `AIDA_ENCRYPTION_KEY` | No | *(wizard-generated)* | 64-character hex key (32 bytes) for integration secrets. |

*Never commit `.env`, `pb_data`, or backup files to git.*

---

## Security Model

- **Reverse-Proxied Database**: The browser never makes direct API requests to PocketBase. Express enforces authentication, CSRF origin verification, and permission checks before querying PocketBase over an isolated internal Docker network.
- **Superuser-Locked Rules**: PocketBase collection rules are set to superuser-only access, ensuring that no client can bypass the backend API logic.
- **Comprehensive Audit Trail**: Mutating operations (creates, updates, deletes) automatically record actor details, timestamps, IP addresses, and exact before/after field diffs. Sensitive fields (passwords, encryption keys, integration tokens) are systematically redacted.
- **Tamper-Resistant Setup**: Setup endpoints permanently lock once completed, verifying database state and hashed tokens before allowing any maintenance actions.

---

## Local Development

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PocketBase 0.30.0 binary in your PATH or project folder

### Setup & Run

1. Install dependencies across the monorepo:
   ```sh
   npm install
   ```

2. Start PocketBase locally:
   ```sh
   ./pocketbase serve --dir ./pb_data
   ```

3. In separate terminal windows, start the backend API and frontend dev server:
   ```sh
   npm run start:backend
   npm run dev
   ```

- Backend API: `http://localhost:3001`
- Frontend Vite Server: `http://localhost:5173`

---

## Database Migrations & Upgrades

Before updating a live instance or switching releases, always create a copy of your `pb_data` directory and test the migration sequence:

```sh
# 1. Back up your live data
cp -r pb_data pb_data_backup

# 2. Rehearse migrations against the copy
pocketbase migrate up --dir ./pb_data_backup --migrationsDir pb_migrations

# 3. Apply to live database
pocketbase migrate up --dir ./pb_data --migrationsDir pb_migrations
```

AIDA's migrations are designed to be idempotent and safe to apply against both fresh installations and existing databases.

---

## Verification & Testing

Run the automated test suites and typechecks across the monorepo:

```sh
# Run backend unit & integration tests (41 tests)
npm test --workspace=@aida/backend

# Run frontend test suite
npm test --workspace=@aida/frontend -- --run

# Run TypeScript checks across all workspaces
npm run typecheck
npm run check:shared-build
```

---

## Repository Layout

- `packages/frontend/`: React 18, Vite, Tailwind CSS, Lucide icons.
- `packages/backend/`: Node.js, Express, PocketBase SDK, JWT auth, audit middleware.
- `packages/shared/`: Shared TypeScript models, contracts, and permission definitions.
- `pb_migrations/`: PocketBase Go/JS database migration files.
- `pocketbase/pb_hooks/`: PocketBase JavaScript hooks (bootstrap, WooCommerce sync).
- `docker-compose.yml`: Production container orchestration.

---

## Ownership & License

Made by Patrick Walton with AI. See [COPYRIGHT.md](COPYRIGHT.md) and [LICENSE](LICENSE) for details.
