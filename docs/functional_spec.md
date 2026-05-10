# AIDA ERP — Functional Specification

**Date:** 2026-05-09  
**Status:** Approved for implementation  
**Scope:** Setup wizard expansion, Accessories collection, WooCommerce sync improvements

---

## 1. Setup Wizard Expansion

### 1.1 Problem

The current 5-step wizard only initialises two PocketBase collections (`userPreferences`, `integrations`) and saves the encryption key. Nothing configures workspace mode, and a fresh install has no indication that other required collections (inventory, history, unknown SKUs) are absent until a runtime error occurs.

### 1.2 Target Behaviour

The wizard becomes the single authoritative setup path. On completion, AIDA is fully operational with no manual PocketBase configuration needed.

**Step progression:**

| # | Name | What happens |
|---|------|--------------|
| 0 | Welcome | Entry point, starts setup |
| 1 | Health Check | Probes backend + PocketBase (unchanged) |
| 2 | Generate Key | Creates + saves `AIDA_ENCRYPTION_KEY` (unchanged) |
| 3 | Initialize Collections | Creates **all** required PB collections (expanded) |
| 4 | Workspace Mode | User selects Solo or Team; saved to `userPreferences` |
| 5 | Done | Redirects to `/login` |

**Collections scaffolded in Step 3:**

- `userPreferences` — existing
- `integrations` — existing
- `inventoryDevice` — device inventory items
- `inventoryComponent` — component inventory items
- `inventoryAccessory` — accessory inventory items (new)
- `stockHistory` — stock change audit trail
- `wcUnknownSkus` — WooCommerce SKUs not matched in AIDA (new)

**Workspace Mode (Step 4):**

- Solo mode: single-user, no multi-user role management shown
- Team mode: user management + role-based access shown in sidebar
- Selection stored in `userPreferences.workspaceMode` (text field: `'solo'` | `'team'`)
- Backend endpoint: `POST /api/setup/set-workspace-mode` — persists to `userPreferences` for the calling user

### 1.3 Health check extension

`GET /api/setup/check-health` now reports the status of all 7 required collections. `setupComplete` requires all 7 to exist and the encryption key to be valid.

---

## 2. Accessories Collection

### 2.1 Problem

Accessories (cables, adapters, peripherals) are neither devices nor components. They need their own inventory bucket so stock, online levels, and history are tracked separately from the other two categories.

### 2.2 Target Behaviour

Accessories are a first-class inventory type, fully parallel to Devices.

**PocketBase collection: `inventoryAccessory`**

Identical schema to `inventoryDevice`:

| Field | Type | Notes |
|-------|------|-------|
| `name` | text | required |
| `sku` | text | required |
| `barcode` | text | optional |
| `webStock` | number | manual / warehouse figure |
| `warehouseStock` | number | |
| `productionStock` | number | |
| `reserveStock` | number | |
| `onlineStock` | number | WooCommerce writes here |
| `countedStock` | number | manual physical count |
| `location` | text | optional |
| `quantity` | number | optional |

**Shared type: `AccessoryItem`**

Identical interface to `DeviceItem` (same fields). Exported from `@aida/shared`.

**Backend API: `/api/inventory/accessories`**

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/inventory/accessories` | List all |
| POST | `/api/inventory/accessories` | Create |
| PATCH | `/api/inventory/accessories/:id` | Update |
| DELETE | `/api/inventory/accessories/:id` | Delete |
| PATCH | `/api/inventory/accessories/batch` | Batch update |
| GET | `/api/inventory/accessories/:id/history` | Stock history |

**Frontend:**

- `useAccessoryInventory` hook (via `createInventoryHook` factory, `apiPath: 'inventory/accessories'`)
- `AccessoryContext.tsx` wrapping `useAccessoryInventory`
- `InventoryAccessoriesView.tsx` — standalone page (no DeviceList re-use to avoid coupling)
- Route: `inventory/accessories`
- Sidebar: "Accessories" added under the Inventory collapsible group (after Components, before Refurbished/RMA)
- `AccessoryProvider` added to `App.tsx` alongside `DeviceProvider`

**Search:** `GET /api/inventory/search` extended to include `inventoryAccessory` results.

---

## 3. WooCommerce Sync Improvements

### 3.1 Stock Field: Online Stock

**Current:** WooCommerce sync writes to `webStock` on `inventoryDevice`.  
**Target:** WooCommerce sync writes to `onlineStock` on all three collections. `countedStock` remains manual only.

Rationale: "Online Stock" is the semantically correct field for stock numbers sourced from the online store. `webStock` was a legacy naming artifact.

### 3.2 Multi-Collection Support

The sync now queries SKUs from all three AIDA collections:

1. `inventoryDevice` — existing
2. `inventoryComponent` — new
3. `inventoryAccessory` — new

All three share the same normalized SKU map (`Map<normalizedSku, { id, onlineStock, collection }>`). If a WooCommerce SKU matches a record in any collection, that record's `onlineStock` is updated. The `collection` field on each map entry is used to call the correct PocketBase update.

### 3.3 Unknown SKU Review System

**Problem:** Currently, unmatched WooCommerce SKUs are silently appended to `errors[]`, making them hard to action.

**Target behaviour:**

1. Unmatched SKUs are tracked separately from adapter errors.
2. After each sync, unmatched SKUs are upserted into the `wcUnknownSkus` PB collection.
3. `SyncResult` gains an `unknownSkuCount` number field.
4. The Integrations page shows a banner/badge after sync if `unknownSkuCount > 0`.
5. Clicking the badge opens a review drawer listing each unknown SKU with its WC product name and stock quantity.
6. The user can dismiss individual entries (marks `dismissed: true`). Dismissed SKUs are hidden from future review but not deleted (audit trail).

**`wcUnknownSkus` PB collection schema:**

| Field | Type | Notes |
|-------|------|-------|
| `sku` | text | required |
| `productName` | text | |
| `wcStock` | number | last-seen WC stock |
| `seenAt` | date | timestamp of last sync that found this SKU |
| `dismissed` | bool | default false |

**Backend routes:**

| Method | Route | Action |
|--------|-------|--------|
| GET | `/api/integrations/woocommerce/unknown-skus` | List non-dismissed unknown SKUs |
| POST | `/api/integrations/woocommerce/unknown-skus/:id/dismiss` | Mark dismissed |

**SyncResult extension:**

```typescript
interface SyncResult {
  recordsImported: number
  errors: string[]
  unknownSkuCount: number   // new — count of SKUs not found in any AIDA collection
}
```

### 3.4 Weekly Inventory Snapshot for Forecasting

After every sync completes, for each SKU whose `onlineStock` was evaluated (changed or unchanged), write one `stockHistory` record tagged `operation: 'weekly_snapshot'`. This gives forecasting a time-series of absolute stock values — not just deltas — to calculate velocity and depletion trends.

Snapshot record shape:

```typescript
{
  inventoryItemId: string,       // PB record ID
  inventoryCollection: string,   // 'inventoryDevice' | 'inventoryComponent' | 'inventoryAccessory'
  timestamp: ISO8601,
  field: 'onlineStock',
  newValue: number,              // current onlineStock after this sync
  oldValue: null,                // null signals this is a snapshot, not a delta
  change: null,
  operation: 'weekly_snapshot',
}
```

Note: `stockHistory` requires `inventoryCollection` field to be added (or the existing `field` meta used). Implementation adds `inventoryCollection` as a new optional text field on the collection if not present. Forecasting reads this field to distinguish sources.

---

## 4. Non-Goals (out of scope for this sprint)

- Implementing the forecasting velocity engine against snapshot data (engine is currently stubbed)
- WooCommerce push (write stock back to WC from AIDA)
- Multiple WooCommerce store connections
- Accessories forecasting view (sidebar entry added, page is a placeholder)
