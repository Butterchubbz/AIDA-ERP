# Integrations Page — Functional Spec & Implementation Plan

## Context

The backend integration framework is complete:
- `GET /api/integrations/registry` — lists available adapters with credential field definitions
- `GET /api/integrations` — lists user's connected integrations (status/sync metadata only, no credentials)
- `POST /api/integrations/:type/connect` — encrypts and saves credentials server-side
- `DELETE /api/integrations/:type` — removes credentials
- `POST /api/integrations/:type/sync` — triggers sync, updates last sync metadata

WooCommerce is the first implemented adapter. Adding future adapters (Shopify, etc.) requires only a new file in `packages/backend/src/integrations/` and one registry entry — no route or frontend changes needed.

`WoocommerceSetup.tsx` exists but is orphaned (not routed, not in nav).

---

## Functional Specification

### Purpose

A self-contained page where users can:
1. See all available integrations at a glance
2. Connect an integration by filling in its credential fields
3. Trigger a manual sync and see the result
4. Disconnect an integration

Non-technical users must be able to use this without reading documentation. Every field must have a label and helper text. Errors must be in plain English.

### Design Constraints

- **Internal tool only.** AIDA is not designed for internet-exposed deployments. The UI should reinforce this — no "share" features, no external-facing sync hooks, and an advisory notice on the page that credentials are stored for local/network use only.
- **Read-only sync only.** WooCommerce integration pulls stock from WooCommerce into AIDA. There is no write-back to the store. The UI must make this direction explicit ("Import from WooCommerce" not "Sync with WooCommerce") to prevent user confusion and discourage anyone attempting bidirectional sync.
- **Credentials never visible.** Once saved, credentials cannot be retrieved or displayed — only replaced or deleted. The form never pre-fills with stored values.

### User Stories

| As a... | I want to... | So that... |
|---|---|---|
| User | See which integrations are available | I know what I can connect |
| User | Connect WooCommerce with my API key | Stock levels sync from my store |
| User | See when the last sync ran and whether it succeeded | I can tell if something broke |
| User | Trigger a sync manually | I can pull fresh data on demand |
| User | Disconnect an integration | I can revoke access or switch credentials |
| Admin | Know that credentials are encrypted | I can trust the system with API keys |

### Page Layout

```
/integrations

┌─────────────────────────────────────────────────────┐
│ Integrations                                        │
│ Connect external services to sync data into AIDA.  │
│ ⓘ AIDA is designed for internal network use only.  │
│   Keep this dashboard off the public internet.      │
└─────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────┐
│ WooCommerce              │  │ (Future adapter)      │
│ Import product stock     │  │                       │
│ from a WooCommerce store │  │                       │
│                          │  │                       │
│ ● Connected              │  │ ○ Not connected        │
│ Last sync: 3 min ago     │  │                       │
│ Status: success          │  │                       │
│                          │  │                       │
│ [Import Now] [Settings]  │  │ [Connect]             │
└──────────────────────────┘  └──────────────────────┘
```

#### Connect modal (generic, driven by adapter.credentialFields)

```
┌────────────────────────────────────────────┐
│ Connect WooCommerce                        │
│ ─────────────────────────────────────────  │
│ Store URL *                                │
│ [https://yourstore.com           ]         │
│ The full URL of your WooCommerce site.     │
│                                            │
│ Consumer Key *                             │
│ [ck_•••••••••••••••••••••        ]         │
│ WooCommerce → Settings → Advanced → API   │
│                                            │
│ Consumer Secret *                          │
│ [cs_•••••••••••••••••••••        ]         │
│ Shown once when you create the API key.   │
│                                            │
│ 🔒 Credentials are encrypted on the       │
│    server and never sent back to you.      │
│                                            │
│             [Cancel]  [Connect]            │
└────────────────────────────────────────────┘
```

#### Sync result inline feedback

- Success: "Imported 42 items." (green)
- Partial: "Imported 38 items. 4 SKUs not found in inventory." (amber, expandable list)
- Error: "WooCommerce API rejected the credentials. Check your Consumer Key." (red)

---

## Implementation Plan

### Step assignments

| Label | Agent | Role |
|---|---|---|
| 🔵 Intern | GPT-4.1 | Boilerplate, wiring, simple components with no logic traps |
| 🟡 Junior | Claude Haiku | Self-contained components, hooks, clear spec |
| 🔴 Senior | Claude Sonnet | State machines, error boundaries, cross-cutting concerns |
| ⬛ Review | GPT-5 | Post-implementation code review |

---

### Step 1 — `useIntegrations` hook 🟡 Junior (Haiku)

**File:** `packages/frontend/src/hooks/useIntegrations.ts`

Fetch both registry and user connection status; expose connect/disconnect/sync actions.

```typescript
// Shape expected by components
interface RegistryEntry {
  id: string
  name: string
  description: string
  credentialFields: CredentialField[]
}

interface IntegrationStatus {
  type: string
  connected: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'error' | null
  lastSyncMessage: string | null
}

interface CredentialField {
  key: string
  label: string
  type: 'text' | 'url' | 'password'
  placeholder?: string
  helpText?: string
}

// Hook returns
{
  registry: RegistryEntry[]
  statuses: Record<string, IntegrationStatus>  // keyed by type
  loading: boolean
  connect(type: string, credentials: Record<string, string>): Promise<void>
  disconnect(type: string): Promise<void>
  sync(type: string): Promise<{ recordsImported: number; errors: string[] }>
  refetch(): void
}
```

Rules:
- `registry` comes from `GET /api/integrations/registry` (no auth, cached for session)
- `statuses` comes from `GET /api/integrations` (auth required, refetched after every connect/disconnect/sync)
- `sync()` must resolve with the result object so the UI can display it inline
- Never swallow errors — throw so the caller handles display

---

### Step 2 — `IntegrationCard.tsx` component 🟡 Junior (Haiku)

**File:** `packages/frontend/src/components/integrations/IntegrationCard.tsx`

Props:
```typescript
interface IntegrationCardProps {
  adapter: RegistryEntry
  status: IntegrationStatus | undefined
  onConnect: () => void       // opens modal
  onDisconnect: () => void
  onSync: () => Promise<void>
}
```

- Shows adapter name + description
- Shows connected/not connected badge
- Shows last sync time (relative, e.g. "3 min ago") and status pill (success/partial/error/never)
- Shows "Import Now" button when connected (disabled while syncing)
- Shows "Connect" button when not connected
- Shows "Settings" / "Disconnect" when connected (can be a dropdown or two buttons)
- Sync result displayed inline below the card for 10s then fades — not a toast

---

### Step 3 — `ConnectModal.tsx` component 🔴 Senior (Sonnet)

**File:** `packages/frontend/src/components/integrations/ConnectModal.tsx`

This is the generic credential form. It must:
- Render each field from `adapter.credentialFields` with label, input type, placeholder, and helpText
- Validate all required fields before submitting (all fields are required)
- Show field-level errors on submit attempt
- Show a lock icon + "Credentials are encrypted on the server and never returned to you."
- Handle the submit → loading → success/error state machine cleanly
- On success: close modal and call `onConnected()`
- On error: stay open, show the error message from the API in plain English
- Trap focus inside the modal (accessibility)
- Close on Escape key or backdrop click (but not while submitting)

State machine:
```
idle → submitting → success (close)
              └──→ error (stay open, show message, allow retry)
```

---

### Step 4 — `IntegrationsView.tsx` page 🔴 Senior (Sonnet)

**File:** `packages/frontend/src/pages/IntegrationsView.tsx`

Assembles the page:
- Page title + internal-use advisory notice (non-alarming, informational tone)
- `useIntegrations()` hook
- Renders one `IntegrationCard` per registry entry
- Owns the `ConnectModal` — tracks which adapter's modal is open (`activeConnect: string | null`)
- Handles sync result display: after `sync()` resolves, attaches result to that card for 10s
- Loading state: skeleton cards while registry/statuses load
- Error state: if registry fails to load, show a simple retry button

The page must be self-contained — no context or provider required beyond what's already in the app layout.

---

### Step 5 — Route + nav wiring 🔵 Intern (GPT-4.1)

**Files:** `packages/frontend/src/App.tsx`, nav/sidebar component

1. Add to `App.tsx`:
   ```tsx
   const IntegrationsView = React.lazy(() => import('./pages/IntegrationsView'))
   // ...
   <Route path="integrations" element={<IntegrationsView />} />
   ```

2. Find the sidebar nav component (likely in `packages/frontend/src/components/common/Layout.tsx` or similar) and add:
   - Label: "Integrations"
   - Icon: plug or link icon (match existing icon style)
   - Path: `/integrations`
   - Position: near bottom of nav, above Profile/Settings

---

### Step 6 — WooCommerce variation support 🔴 Senior (Sonnet)

**File:** `packages/backend/src/integrations/woocommerce.ts`

WooCommerce variable products (e.g. a product with size/color variants) store SKUs on the child variations, not the parent product. The current adapter skips these.

After the initial product page loop, for any product with `type === 'variable'` and no SKU at the parent level:
1. Fetch `GET /wp-json/wc/v3/products/{id}/variations?per_page=100`
2. For each variation that has a SKU, apply the same inventory update logic
3. Count each updated variation as one imported record

Constraints:
- Same 15s timeout per request
- Errors per variation should be collected and returned in `errors[]`, not thrown
- Do not create new inventory records — only update existing matches by SKU (same as current behavior)

---

### Step 7 — Scheduled auto-sync 🔴 Senior (Sonnet)

**Files:** 
- `packages/backend/src/lib/syncScheduler.ts` (new)
- `packages/backend/src/index.ts` (wire scheduler on startup)
- `packages/backend/src/routes/integrations.ts` (add GET/PATCH preference endpoints)
- `packages/frontend/src/components/integrations/IntegrationCard.tsx` (add schedule UI)

Design:
- Use `node:timers` `setInterval` — no external cron dependency
- Scheduler runs in the backend process, reads sync interval preference per-user integration record
- Interval options: Off / Every 1h / Every 6h / Every 24h
- Store `syncIntervalHours: number | null` on the `integrations` PB record (add field in setup)
- On startup, load all integration records with a non-null interval and schedule them
- On connect/update interval: cancel existing timer for that record, schedule new one
- Sync is the same `adapter.sync()` call as manual — no special path

Frontend:
- Add a small "Auto-sync" selector to `IntegrationCard` when connected
- Dropdown: Off / Every hour / Every 6 hours / Daily
- PATCH to a new `PATCH /api/integrations/:type/schedule` endpoint

---

### Step 8 — Code review ⬛ GPT-5

Review focus areas:
1. `ConnectModal` — state machine correctness, no credential leaks in error messages or console logs
2. `useIntegrations` — race conditions if sync is triggered while a refetch is in flight
3. `woocommerce.ts` variation support — pagination of variations, error isolation per variation
4. `syncScheduler.ts` — timer cleanup on process shutdown, what happens if PB is unavailable at scheduled time
5. General: no credentials in log output anywhere in the new code

---

## Execution Order

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 (parallel with 3/4 ok)
                                         ↓
                                      Step 6
                                         ↓
                                      Step 7
                                         ↓
                                      Step 8 (review all)
```

Steps 1–5 are the MVP (Integrations page working end-to-end).  
Steps 6–7 are the nice-to-haves.  
Step 8 reviews everything before committing.

---

## Definition of Done

- [ ] `/integrations` route renders without errors
- [ ] WooCommerce can be connected, synced, and disconnected through the UI
- [ ] Sync result (imported count + any warnings) displays inline
- [ ] Variable product SKUs sync correctly
- [ ] Auto-sync schedule can be set per integration
- [ ] No credentials appear in browser DevTools Network tab responses
- [ ] No credentials appear in backend terminal logs
- [ ] GPT-5 code review passed with no blocking findings
- [ ] Changes staged, tested manually, committed

---
## Ownership and Rights
Made by Patrick Walton with AI.
Copyright (c) 2026 Patrick Walton. All rights reserved.
This project is privately owned by Patrick Walton and is not company-owned unless explicitly stated in a signed written agreement.
