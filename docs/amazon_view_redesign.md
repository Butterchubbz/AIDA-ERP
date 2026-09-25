# Amazon View Redesign -- FBA Stock Levels Card Layout

## Goal

Replace the current bar-chart + localStorage Amazon View with a persistent, card-based "FBA Stock
Levels" layout. Each card represents one device. Each card shows its variant SKUs (e.g., FBA Base,
FBA 250 Pack, FBA 500 Pack) with current stock, inbound quantity, and a colored health bar. Editors
can add or remove devices and manage the variant SKUs within each device card.

---

## Current State (pre-redesign)

| Concern | Previous behavior |
|---|---|
| Storage | Listings lived in `localStorage` only -- lost on browser clear, not shared across users |
| Structure | `AmazonListing` was flat; variants were per-listing (multi-SKU grouping was manual) |
| Visualization | Recharts horizontal bar chart, one bar per SKU |
| Admin CRUD | `AddListingModal` (4-step wizard) + `ManageListingModal` -- both operated on localStorage |
| Backend | `GET /api/amazon/inventory` read `inventoryDevice` (not FBA-specific); `POST /api/amazon/sync` was a 501 stub |

### Types kept as-is

`AmazonPO`, `AmazonPOItem` -- unchanged; POs stay as-is.

---

## Target Design

```
+------------------------------+  +------------------------------+
| Product A      Data Updated: |  | Product B      Data Updated: |
| SKU-001        5/12/2026     |  | SKU-002        5/12/2026     |
|                              |  |                              |
| FBA Base                     |  | FBA Base                     |
|  Stock: 42   Inbound: 0      |  |  Stock: 8    Inbound: 24     |
|  [################......] ok |  |  [###.................] low   |
|                              |  |                              |
| FBA 250 Pack                 |  | FBA 250 Pack                 |
|  Stock: 15   Inbound: 0      |  |  Stock: 0    Inbound: 0      |
|  [########...............] . |  |  [....................] empty |
| [Edit]  [History]            |  | [Edit]  [History]            |
+------------------------------+  +------------------------------+
```

2-column grid (`md:grid-cols-2`), dark card style matching the rest of AIDA.

---

## Data Model

### New PocketBase collections (bootstrapped at startup via RUNTIME_COLLECTIONS)

#### `amazonDevices`

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | Display name, e.g., "Product A" |
| `inventorySku` | text, required | Parent/base SKU, e.g., "SKU-001" |
| `inventoryId` | text | Optional FK to `inventoryDevice.id` |
| `updatedAt` | date | Timestamp of last stock update |

#### `amazonVariants`

| Field | Type | Notes |
|---|---|---|
| `deviceId` | text, required | FK to `amazonDevices.id` |
| `label` | text, required | Display name, e.g., "FBA Base", "FBA 250 Pack" |
| `sku` | text, required | Full Amazon child SKU, e.g., "SKU-001-BASE" |
| `asin` | text | Amazon ASIN |
| `packSize` | number | Units per pack (1, 250, 500, etc.) |
| `fbaStock` | number | Current FBA stock -- manually entered |
| `lowStockThreshold` | number | Default 10. Below this = red; 10-29 = yellow; >= 30 = green |

Inbound qty is computed at query time from `amazonPOs` (Shipped/Delivered + movedToOutgoing = true).

#### `amazonStockHistory`

| Field | Type | Notes |
|---|---|---|
| `variantId` | text, required | FK to `amazonVariants.id` |
| `timestamp` | date | When the adjustment was made |
| `oldValue` | number | Stock before adjustment |
| `newValue` | number | Stock after adjustment |
| `reason` | text | Optional note from the user |
| `changedBy` | text | Email of the user who made the change |

### New shared types (`@aida/shared`)

```typescript
export interface AmazonDevice {
  id: string
  name: string
  inventorySku: string
  inventoryId?: string
  updatedAt?: string
}

export interface AmazonVariant {
  id: string
  deviceId: string
  label: string
  sku: string
  asin?: string
  packSize: number
  fbaStock: number
  lowStockThreshold?: number
}

export interface AmazonStockHistoryEntry {
  id: string
  variantId: string
  timestamp: string
  oldValue: number
  newValue: number
  reason?: string
  changedBy?: string
}
```

---

## Backend API

All new routes under `/api/amazon/devices` and `/api/amazon/variants`.

```
GET    /api/amazon/devices                 -- list all devices with variants + inbound qty
POST   /api/amazon/devices                 -- create device
PATCH  /api/amazon/devices/:id             -- update device name/sku
DELETE /api/amazon/devices/:id             -- delete device + cascade-delete variants + history
GET    /api/amazon/devices/:id/history     -- all stock history for a device (all variants)
POST   /api/amazon/devices/:id/variants    -- add variant to device
PATCH  /api/amazon/variants/:id            -- update variant metadata (label, sku, asin, threshold)
DELETE /api/amazon/variants/:id            -- delete variant + its history
POST   /api/amazon/variants/:id/stock      -- manual stock adjustment; writes history record
GET    /api/amazon/variants/:id/history    -- stock history for one variant
```

All routes require auth (`requireAuth`). Write operations are gated on `Amazon: Editor` role in the
frontend; the backend validates `req.user` is present but does not enforce role-level restrictions
(role enforcement is frontend-only for now, matching the pattern used elsewhere in AIDA).

---

## Frontend Component Architecture

```
packages/frontend/src/
  pages/
    AmazonView.tsx                    -- rewritten; card grid + modals
  components/amazon/
    StockBar.tsx                      -- colored progress bar (green/yellow/red)
    VariantRow.tsx                    -- one row per variant in a card
    DeviceCard.tsx                    -- full card for one device
    AddDeviceModal.tsx                -- single-step form: name + parent SKU
    EditDeviceModal.tsx               -- stock adjustment + variant metadata + device info + delete
    StockHistoryModal.tsx             -- read-only history table for a device
  hooks/
    useAmazonDevices.ts               -- fetch/mutate amazonDevices + variants
```

### Role gating

- `Amazon: Editor` (Admin, Manager) -- can adjust stock, add/remove devices and variants
- `Amazon: Viewer` (Staff, Viewer) -- read-only; no Edit button, History button visible

---

## Progress Bar Health Thresholds

Default `lowStockThreshold` per variant: 10 units.

| Condition | Color |
|---|---|
| `stock === 0` or `stock < threshold` | Red |
| `stock < threshold * 3` | Yellow |
| `stock >= threshold * 3` | Green |

Bar width: `min(100, stock / (threshold * 6) * 100)%`

---

## Migration from localStorage

Old data (`aida_amazon_listings` key) is not automatically imported. On first load, if the key
exists, a dismissible banner appears prompting the user to re-enter devices using the new form and
then clear the old data. The banner includes a "Clear old data" button that removes the key.

---

## Open Questions

- **Inbound source**: Should `inboundQty` also draw from the main `inboundShipment` collection, or
  only from `amazonPOs`?
- **SP-API sync**: `POST /api/amazon/sync` remains a 501 stub. FBA stock is manually entered until
  SP-API integration is built.

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.
