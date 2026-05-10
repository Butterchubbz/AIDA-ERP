# AIDA ERP — Implementation Plan

**Date:** 2026-05-09  
**Spec:** docs/functional_spec.md  
**Agent roster:** GPT 4.1 (intern), Claude Haiku (junior), Claude Sonnet (senior)

---

## Agent Capability Reference

| Agent | Role | Assigned to |
|-------|------|-------------|
| GPT 4.1 | Intern — mechanical duplication, type definitions with no logic | Simple file clones, interface additions |
| Claude Haiku | Junior — route wiring, context/hook additions, UI component clones | Backend CRUD routes, frontend view/context |
| Claude Sonnet | Senior — multi-file architectural changes, complex adapter logic, wizard flow | WooCommerce adapter, setup wizard, review UI |

---

## Step 1 — Shared Types  `[GPT 4.1 — Intern]`

**Files:**
- `packages/shared/src/types/accessory.ts` — new file, `AccessoryItem` interface
- `packages/shared/src/index.ts` — add export for `accessory.ts`

Create `AccessoryItem` by copying `DeviceItem` verbatim and renaming the interface. Add export to `index.ts`. No logic changes. Purely additive.

---

## Step 2 — Backend: Accessories CRUD Routes  `[Claude Haiku — Junior]`

**Files:**
- `packages/backend/src/routes/inventory.ts` — add 6 accessory handler functions
- `packages/backend/src/index.ts` — register new routes

Add `listAccessories`, `createAccessory`, `updateAccessory`, `deleteAccessory`, `batchUpdateAccessories`, `getAccessoryHistory` using `inventoryAccessory` PB collection. Register at `/api/inventory/accessories/*`. Extend `searchInventory` to include `inventoryAccessory`.

---

## Step 3 — Backend: Unknown SKU Routes  `[Claude Haiku — Junior]`

**Files:**
- `packages/backend/src/routes/integrations.ts` — add 2 route handlers
- `packages/backend/src/index.ts` — register new routes

Add `listUnknownSkus` (`GET /api/integrations/woocommerce/unknown-skus`) and `dismissUnknownSku` (`POST /api/integrations/woocommerce/unknown-skus/:id/dismiss`). Both require auth.

---

## Step 4 — Backend: Setup Routes Expansion  `[Claude Sonnet — Senior]`

**Files:**
- `packages/backend/src/routes/setup.ts`
- `packages/backend/src/index.ts`

1. Expand `initCollections` to scaffold all 7 collections: `userPreferences`, `integrations`, `inventoryDevice`, `inventoryComponent`, `inventoryAccessory`, `stockHistory`, `wcUnknownSkus`.
2. Expand `evaluateSetupState` to check all 7. `setupComplete` requires all 7.
3. Add `setWorkspaceMode` handler (`POST /api/setup/set-workspace-mode`): upserts `workspaceMode` into `userPreferences` for calling user.

---

## Step 5 — WooCommerce Adapter Refactor  `[Claude Sonnet — Senior]`

**Files:**
- `packages/backend/src/integrations/woocommerce.ts`
- `packages/backend/src/integrations/registry.ts`

1. Add `unknownSkuCount: number` to `SyncResult`.
2. Build three SKU maps (device, component, accessory), each entry tagged with its source collection.
3. Change sync target from `webStock` to `onlineStock`.
4. Route unmatched SKUs to `wcUnknownSkus` PB collection (upsert by SKU); return count in `SyncResult`.
5. After sync: write one `stockHistory` record per evaluated SKU with `operation: 'weekly_snapshot'`.

---

## Step 6 — Frontend: Accessories Hook + Context + View  `[Claude Haiku — Junior]`

**Files:**
- `packages/frontend/src/hooks/useInventoryModules.ts` — add `useAccessoryInventory`
- `packages/frontend/src/context/AccessoryContext.tsx` — new
- `packages/frontend/src/pages/InventoryAccessoriesView.tsx` — new
- `packages/frontend/src/App.tsx` — route + provider
- `packages/frontend/src/components/common/Sidebar.tsx` — Accessories entry

Add `useAccessoryInventory` via the existing `createInventoryHook` factory. Create `AccessoryContext` and `InventoryAccessoriesView` mirroring the Device equivalents. Wire route and sidebar.

---

## Step 7 — Frontend: Setup Wizard Expansion  `[Claude Sonnet — Senior]`

**Files:**
- `packages/frontend/src/pages/SetupPage.tsx`

Add "Workspace Mode" step (step index 4, before Finish). UI: Solo / Team radio group. Calls `POST /api/setup/set-workspace-mode`. Expand step 3 StatusIndicators to show all 7 collections.

---

## Step 8 — Frontend: Unknown SKU Review UI  `[Claude Sonnet — Senior]`

**Files:**
- `packages/frontend/src/pages/IntegrationsView.tsx`

After sync with `unknownSkuCount > 0`: amber persistent banner with "Review" button. Panel fetches and lists unknown SKUs; each row has "Dismiss" button. Banner clears when all dismissed.

---

## Step 9 — Code Review  `[Claude Opus 4.7 — scheduled]`

After all steps staged: spawn Opus review agent to check type safety, adapter correctness, wizard step ordering, no regressions.

---

## Parallel Execution Map

```
Phase A (parallel):  Step 1, 2, 3
Phase B (sequential after A): Steps 4, 5
Phase C (parallel after B): Steps 6, 7, 8
Phase D: Step 9 (review)
```
