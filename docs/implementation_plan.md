# Implementation Plan: QC Consolidation Pass

**Source:** `docs/consolidation_spec.md`
**Status:** Pending Staging
**Approval Criteria:** 100% green build, zero `any` warnings in target directories, no duplicate modal/table shells in bundle.

---

## Agent Assignment Overview

| Agent | Role | Risk Level | Scope |
|---|---|---|---|
| GPT-4.1 | The Intern | Low | Cleanup — orphan deletion, StatusBadge swap |
| Claude Haiku | The Junior | Medium | Migration — date utils, hook factory |
| Claude Sonnet | The Senior | High | Integration — pocketbaseApi, memoization |
| GPT-5 | The Auditor | Post-Staging | Consolidation Audit |

---

## Phase 1 — Cleanup (GPT-4.1 / The Intern)

**Risk:** Low. Changes are mechanical and non-breaking.

### 1.1 Delete Orphaned Files

The following files are never imported by any active route or component. Delete them:

- `src/pages/DashboardView.tsx`
- `src/pages/LoginView.tsx`

**Verification:** Confirm no import of either file exists in `App.tsx`, any router config, or any component before deleting.

### 1.2 Replace Inline `<span>` Badges with `<StatusBadge>`

Per spec §4, inline conditional `<span>`/`<div>` elements that render status colors must be replaced with `<StatusBadge status={...} />`.

**Targets** (scan for pattern `status === '...' ? 'bg-`):
- All dashboards, table rows, and detail views that conditionally apply color classes to a status string

**Pattern to replace:**
```tsx
// BEFORE
<span className={status === 'Paid' ? 'bg-green-500' : 'bg-red-500'}>{status}</span>

// AFTER
<StatusBadge status={status} />
```

**Import to add:**
```tsx
import { StatusBadge } from '@/components/common/StatusBadge';
```

**Do not touch:** Any component that already uses `<StatusBadge>`.

---

## Phase 2 — Migration (Claude Haiku / The Junior)

**Risk:** Medium. Logic replacements must preserve display output and hook return shapes.

### 2.1 Swap Direct Date Formatting for `date.ts` Utilities

Per spec §4, direct `new Date()`, `moment()`, and `.toLocaleDateString()` calls in table rows and list views are banned.

**Required imports:**
```tsx
import { formatDate, formatDateTime, formatDateStamp } from '@/utils/date';
```

**Banned patterns to find and replace in all table row render functions:**

| Banned | Replacement |
|---|---|
| `new Date(val).toLocaleDateString()` | `formatDate(val)` |
| `new Date(val).toLocaleString()` | `formatDateTime(val)` |
| `moment(val).format('...')` | `formatDate(val)` or `formatDateStamp(val)` |

**Scope:** All `.tsx` files under `src/pages/` and `src/components/`.

### 2.2 Migrate 5 Hooks to `useCollectionCrud` Factory

Per spec §1, the following hooks must be deprecated and replaced with the `useCollectionCrud` factory.

| Hook | Collection Name |
|---|---|
| `useInvoices()` | `'invoices'` |
| `useCustomers()` | `'customers'` |
| `useVendors()` | `'vendors'` |
| `useInventory()` | `'inventory'` |
| `usePurchaseOrders()` | `'purchase_orders'` |

**Migration pattern:**
```tsx
// BEFORE (src/hooks/useInvoices.ts)
export function useInvoices() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pb.collection('invoices').getFullList().then(setItems);
  }, []);
  return { items };
}

// AFTER (delete file, use factory directly at call site)
import { useCollectionCrud } from '@/hooks/useCollectionCrud';
const { items, add, update, remove } = useCollectionCrud('invoices');
```

**Rules:**
- Verify the return shape at every call site before deleting the old hook file.
- If any call site destructures properties not provided by `useCollectionCrud`, flag for senior review before proceeding.
- Do not alter any component logic beyond the hook import and destructuring.

---

## Phase 3 — Integration (Claude Sonnet / The Senior)

**Risk:** High. These hooks involve complex data transformation, filtered queries, and memoization. Regressions here break core inventory and forecasting views.

### 3.1 Migrate `useInventoryModules` to `pocketbaseApi` Helpers

Per spec §2, direct `pb.collection('...')` calls are prohibited. `useInventoryModules` contains:
- Multi-collection fetches
- Conditional upsert logic
- Dependent derived state built with `useMemo`

**Required approach:**
- Replace each `pb.collection('...').getFullList()` with `listRecords<T>(COLLECTION, options)`
- Replace `pb.collection('...').create()` with `createRecord<T>(COLLECTION, payload)`
- Replace `pb.collection('...').update()` with `updateRecord<T>(COLLECTION, id, payload)`
- Replace `pb.collection('...').delete()` with `deleteRecord(COLLECTION, id)`
- Retain all `useMemo` and derived state logic — do not flatten or simplify
- Confirm TypeScript generics are correctly threaded through (`DeviceRecord`, `ComponentRecord`, etc.)

**Retain `pb` import only** for any filtered expand queries that `pocketbaseApi` helpers cannot express. Document these as `// TODO: migrate when pocketbaseApi supports expand` inline comments.

### 3.2 Migrate `useForecasting` to `pocketbaseApi` Helpers

`useForecasting` performs multiple `getFullList()` calls whose results feed memoized chart data arrays.

**Required approach:**
- Replace `pb.collection('...').getFullList()` with `listRecords<T>(COLLECTION)`
- Preserve all memoized derivations that transform raw records into chart-ready arrays
- Do not change the hook's return shape — consuming components (`ForecastingWorkspace`, `ComponentForecastingView`, `DeviceForecastingView`) must not require changes

### 3.3 Validate `pocketbaseApi.ts` Payload Types

Confirm the payload type signature in `pocketbaseApi.ts` accepts typed interface objects without requiring index signatures:

```ts
// Must accept typed interfaces (e.g., Partial<DeviceRecord>) without TS error
type Payload = FormData | Record<string, unknown> | object;
```

If any migrated call site produces a type error on payload, widen the type here rather than adding `as any` at call sites.

---

## Phase 4 — Consolidation Audit (GPT-5 / The Auditor)

**Trigger:** After Phase 1–3 are complete and changes are staged.

**Task:** Run a full `Consolidation Audit` against the staged branch.

### Audit Checklist

#### PocketBase Relation Integrity
- [ ] Confirm all `expand` fields used in `listRecords` calls match the actual PocketBase collection schema in `pb_data/types.d.ts`
- [ ] Verify no collection name string has been mistyped (cross-reference `src/lib/collections.ts`)
- [ ] Confirm `deleteRecord` calls on parent records do not orphan child records with required relations

#### TypeScript Regression Check
- [ ] Run `tsc --noEmit` — must produce zero errors
- [ ] Confirm zero `any` escapes in: `src/hooks/`, `src/lib/`, `src/pages/`, `src/components/`
- [ ] Verify all hook return types are explicitly declared (no implicit `any` inference)

#### UI Regression Check
- [ ] Confirm `StatusBadge` renders correctly for all status values present in the application (`'Paid'`, `'Pending'`, `'Cancelled'`, `'Processing'`, `'Approved'`, `'Rejected'`, and any others in data)
- [ ] Confirm date output format is visually consistent across all table views
- [ ] Confirm `ModalShell` and `TableShell` render without layout regressions in all migrated components

#### Build Validation
- [ ] `npm run build` must complete with zero errors
- [ ] Bundle must contain zero duplicate `ModalShell`-equivalent components (check bundle report)
- [ ] Chunk sizes must not regress significantly from baseline (ref: `bundle-report.json`)

### Audit Output Format

The auditor must produce a short report with:
1. **PASS / FAIL** for each checklist section
2. A list of any flagged files with the specific issue
3. A final **MERGE READY** or **BLOCKED — RETURN TO [PHASE]** verdict

---

## Execution Order

```
Phase 1 (GPT-4.1)  ──► Phase 2 (Claude Haiku)  ──► Phase 3 (Claude Sonnet)  ──► Phase 4 (GPT-5 Audit)
   Cleanup                  Migration                    Integration                  Staging Audit
```

Phases 1 and 2 may run in parallel if a clean branch is available. Phase 3 must not begin until Phase 2 hook migrations are complete (shared hooks may conflict). Phase 4 is strictly post-staging.
