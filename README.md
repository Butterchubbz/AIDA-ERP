# AIDA ERP

AIDA ERP is a self-hosted inventory and refurbishment operations platform for small teams. It combines inventory, inbound shipments, Amazon stock, returns, forecasting, sales data, integrations, and role-based access in one application.

## Features

- Inventory for devices, components, accessories, and refurbished items
- Inbound and outbound shipment tracking
- Amazon purchase orders, variants, stock, and history
- RMA and return workflows
- Forecasting from sales and stock history
- CSV sales-data import
- WooCommerce and Shopify integrations
- Admin, Manager, Staff, and Viewer roles
- PocketBase-backed storage behind an Express API
- Audit logging for successful changes and authentication failures

## Quick Start with Docker

Requirements:

- Docker Engine with Compose v2
- A machine with at least 2 GB of available memory

Create an environment file from the example and set strong values for every secret:

```sh
cp .env.example .env
```

Start the application:

```sh
docker compose up --build
```

Open `http://localhost:3001`. PocketBase is available to the backend on the internal network; the browser uses only the AIDA web application.

The first-run wizard creates the required application collections. Create the first application user in the PocketBase Admin UI, then sign in through AIDA. Keep the generated setup token in the backend environment if you need to rerun setup after completion.

## Local Development

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- PocketBase 0.30.0

Install dependencies:

```sh
npm install
```

Start PocketBase in one terminal:

```sh
./pocketbase serve --dir ./pb_data
```

Start the backend and frontend in separate terminals:

```sh
npm run start:backend
npm run dev
```

The backend runs at `http://localhost:3001` and the frontend at `http://localhost:5173`.

## Configuration

Copy `.env.example` to `.env`. At minimum configure:

- `PB_ADMIN_EMAIL` and `PB_ADMIN_PASSWORD` for the PocketBase superuser
- `JWT_SECRET` with at least 32 random characters
- `AIDA_ENCRYPTION_KEY` as a 64-character hexadecimal key after setup
- `AIDA_SETUP_TOKEN` after the first setup completion
- `ALLOWED_ORIGIN` for the browser origin

Never commit `.env`, PocketBase data, credentials, tokens, or production backups.

## Security Model

The browser never connects directly to PocketBase. Express authenticates users, enforces module permissions, and uses a PocketBase superuser connection for data access. PocketBase application collections are locked to superuser-only API rules so the Express API remains the only application data path.

Mutating API requests require the appropriate module Editor permission. Audit entries include successful changes, real update diffs, delete record IDs, login events, and failed login events. Secrets and credential fields are redacted from audit payloads.

## Validation

```sh
npm run typecheck
npm run test --workspace=@aida/backend
npm run check:shared-build
```

Before upgrading a live instance, back up `pb_data` and run the migration chain against a copy first:

```sh
pocketbase migrate up --dir ./pb_data_backup --migrationsDir pb_migrations
pocketbase migrate up --dir ./pb_data --migrationsDir pb_migrations
```

## Repository Layout

- `packages/frontend` - React and Vite browser application
- `packages/backend` - Express API and PocketBase integration
- `packages/shared` - shared TypeScript types and permission constants
- `pb_migrations` - PocketBase schema migrations
- `pb_public` - PocketBase public assets
- `pocketbase/pb_hooks` - optional PocketBase server hooks

## Ownership

Made by Patrick Walton with AI. See [COPYRIGHT.md](COPYRIGHT.md) for ownership details.
