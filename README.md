# AIDA ERP

AIDA ERP is a React + TypeScript application built with Vite and backed by PocketBase.

## Requirements

- Node.js 18+
- npm
- PocketBase

## Local Setup

1. Install dependencies:

```powershell
npm install
```

2. Start PocketBase in the repository root so local data is stored in `pb_data/`:

```powershell
.\pocketbase.exe serve --dir .\pb_data
```

3. Start the frontend:

```powershell
npm run dev
```

The Vite app runs on the local development port shown in the terminal. PocketBase defaults to `http://127.0.0.1:8090`.

## Environment

Copy values from `.env.example` into a local environment file if needed.

Important variables:

- `VITE_LOCAL_OWNER_PASSWORD`
- `VITE_DEBUG`
- `VITE_SENTRY_DSN`

## Available Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - run TypeScript project builds and create a production bundle
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint
- `npm run test` - run Vitest
- `npm run smoke:test` - run the Playwright smoke suite
- `npm run format` - format supported source files with Prettier

## Data and Backups

- PocketBase runtime data is stored in `pb_data/`
- Public PocketBase assets are stored in `pb_public/`
- Import/export and maintenance tasks are available in the app under AIDA Management

## Testing

Type-check before pushing:

```powershell
npx tsc --noEmit
```

Build verification:

```powershell
npm run build
```

Smoke tests:

```powershell
npm run smoke:test
```

## Architecture

### PocketBase Access Layer

All database interactions must route through `src/lib/pocketbaseApi.ts`. Direct `pb.collection('...')` calls are prohibited outside of this module.

```ts
// Correct
import { listRecords, createRecord, updateRecord, deleteRecord } from '../lib/pocketbaseApi'
const items = await listRecords<MyType>(COLLECTIONS.my_collection)

// Prohibited
pb.collection('my_collection').getFullList()  // ❌ bypass
```

All collection name strings are centralized in `src/lib/collections.ts`. Never use raw string literals for collection names.

**Exceptions:** `useShippingModules.ts` retains direct `pb` access for complex filtered queries (`searchSKU`, `pushShipmentToInventory`) and `DataManagementView.tsx` retains it for bulk backup/restore. All other code must use the helpers.

### Hook Factory

Simple CRUD hooks must not be written by hand. Use the `useCollectionCrud<T>` factory from `src/hooks/useCollectionCrud.ts`:

```ts
import { useCollectionCrud } from '../hooks/useCollectionCrud'

const { items, createItem, updateItem, removeItem, refetch } = useCollectionCrud<MyType>({
  collection: COLLECTIONS.my_collection,
  fetchErrorMessage: 'Failed to load items.',
})
```

Hooks that use this factory: `useQuoteApproved`, `useRefurbishedDevices`, `useUsers`, `useRMAs`, `useRMATracker`.

Complex hooks with multi-collection fetches or derived state (`useInventoryModules`, `useShippingModules`, `useForecasting`) call `pocketbaseApi` helpers directly.

### UI Primitives

| Component | File | Use for |
|---|---|---|
| `ModalShell` | `src/components/common/ModalShell.tsx` | All modal dialogs |
| `TableShell` | `src/components/common/TableShell.tsx` | All data tables |
| `StatusBadge` | `src/components/common/StatusBadge.tsx` | All status indicators |
| `chartConfig` | `src/components/common/chartConfig.ts` | Recharts style constants |

**Rules:**
- Never render inline conditional `<span className={status === '...' ? 'bg-green' : 'bg-red'}>` — use `<StatusBadge text={status} tone="success|warning|danger|neutral|info" />` instead.
- Never write one-off modal wrappers — use `<ModalShell title="..." onClose={...}>`.

### Date Formatting

All date/time display must use utilities from `src/utils/date.ts`:

```ts
import { formatLocalDate, formatLocalDateTime } from '../utils/date'

formatLocalDate(record.created)    // date only
formatLocalDateTime(record.created) // date + time
```

**Prohibited:** `new Date(x).toLocaleDateString()`, `new Date(x).toLocaleString()`, `moment(x).format(...)`.

### Validation Checklist (before every PR)

```powershell
npx tsc --noEmit   # must produce zero output
npm run build      # must complete with zero errors
```

## Project Notes

- Main application source lives in `src/`
- Legacy and reference material is kept elsewhere in the workspace and is not the active frontend
- Release and utility scripts live in `scripts/`

## Related Docs

- `AIDA_SETUP_GUIDE.md`
- `POCKETBASE_SETUP_GUIDE.md`
- `docs/consolidation_spec.md`
- `docs/implementation_plan.md`
- `scripts/README.md`
