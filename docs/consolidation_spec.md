# Architecture Specification: QC Consolidation Pass

**Objective:** Achieve zero duplicate logic and a 100% green build by enforcing strict usage of the newly established shared infrastructure.

## 1. Hook Consolidation: `useCollectionCrud`
**Mandate:** All direct data-fetching hooks must be deprecated and migrated to the centralized `useCollectionCrud` factory. This ensures consistent loading states, error handling, and cache invalidation.

### Target Migrations
- `useInvoices()` -> `useCollectionCrud('invoices')`
- `useCustomers()` -> `useCollectionCrud('customers')`
- `useVendors()` -> `useCollectionCrud('vendors')`
- `useInventory()` -> `useCollectionCrud('inventory')`
- `usePurchaseOrders()` -> `useCollectionCrud('purchase_orders')`

*Action Item:* Search the codebase for isolated `useQuery` or `useMutation` implementations wrapping PocketBase calls and replace them with the `useCollectionCrud` factory.

## 2. Type Safety Enforcement: `pocketbaseApi.ts`
**Mandate:** Direct invocations of the untyped `pb.collection('...')` client are strictly prohibited. All database interactions must route through the typed abstractions in `pocketbaseApi.ts`.

### Standard
- **Invalid:** `pb.collection('users').getFullList()`
- **Valid:** `pocketbaseApi.users.getAll()`

By strictly adhering to `pocketbaseApi.ts`, we leverage our generated TypeScript definitions to guarantee build-time type safety for all payloads and responses. Any PRs bypassing `pocketbaseApi.ts` will be blocked during review.

## 3. UI Standardization: `ModalShell` & `TableShell`
**Mandate:** Custom, one-off table and modal implementations contribute to UI inconsistency and technical debt. All views must utilize the generic `TableShell` and `ModalShell` wrappers.

### Target Migrations
**Modals to migrate to `ModalShell`:**
- `CreateInvoiceModal.tsx`
- `EditCustomerModal.tsx`
- `PaymentConfirmationModal.tsx`
- `SettingsDialog.tsx`

**Tables to migrate to `TableShell`:**
- `CustomerDataGrid.tsx`
- `InvoiceListTable.tsx`
- `InventoryTrackingTable.tsx`
- `RecentOrdersTable.tsx`

*Action Item:* Strip internal state, pagination, and sorting logic from these components and map their columns/actions to the `TableShell` and `ModalShell` API props.

## 4. Date and Status Logic Standardization
**Mandate:** Business logic for dates and statuses must be unified to prevent localization bugs and visual inconsistencies.

### Temporal Data (`date.ts`)
- **Banned:** Direct usage of `new Date()`, `moment()`, or manual string formatting (e.g., `date.toLocaleDateString()`).
- **Required:** Import formatting and parsing utilities strictly from `src/utils/date.ts` (e.g., `formatISODate`, `toRelativeTime`).

### Status Indicators (`StatusBadge.tsx`)
- **Banned:** Inline styled `div` or `span` elements conditionally rendering colors based on string statuses (e.g., `<span className={status === 'Paid' ? 'bg-green' : 'bg-red'}>`).
- **Required:** Use `<StatusBadge status={data.status} />` across all dashboards, tables, and detail views. `StatusBadge` must be the single source of truth for variant mapping (colors, icons, text).

---
**Approval Criteria:** The consolidation pass will be considered complete when the build runs 100% green, no TypeScript `any` warnings remain in the targeted directories, and zero duplicate modal/table shells exist in the application bundle.