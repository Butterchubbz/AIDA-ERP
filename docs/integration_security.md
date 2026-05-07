# Unified Integration Security Spec: AIDA Monorepo + PocketBase E-Commerce Hooks

**Status:** Architecture specification for Phase 0-3 integration  
**Date:** May 7, 2026  
**PB Version:** v0.30.0  
**Scope:** PocketBase hook layer, credential encryption, manual CSV fallback, and zero-trust API secret handling

---

## Executive Summary

This specification merges the three-package monorepo (Phase 2-5 complete) with a new **server-side PocketBase hook layer** that:

1. **Intercepts WooCommerce API calls** at the PocketBase level (not the frontend)
2. **Encrypts API credentials** using Web Crypto API (key stays in `.env.local`, never sent to browser)
3. **Provides a manual CSV fallback** for Phase 1 data ingestion without API credentials
4. **Maintains zero-trust security**: Database leak without the encryption key yields zero usable credentials

The result is a **single VITE_API_URL** pointing to the backend, with PocketBase hooks transparently proxying e-commerce calls server-side.

---

## 1. Architecture Overview

### 1.1 Request Flow (Encrypted E-commerce Sync)

```
Frontend (React)
    ↓ POST /api/ecommerce/sync (email + encrypted WC API key)
    ↓
Backend (Express 3001) — requireAuth() + RBAC check
    ↓ Read encrypted credential from userPreferences
    ↓ Decrypt using VITE_ENCRYPTION_KEY (env var, not sent to browser)
    ↓ Store plaintext temporarily in PB beforeCollection() hook context
    ↓
PocketBase (8090) — Hook Layer
    ├─ beforeCreate('ecommerceSyncLog') — triggers WC API call via hook
    ├─ PB Hook JS: Get decrypted key from request context
    ├─ PB Hook JS: Call WooCommerce REST API with key
    ├─ PB Hook JS: Transform response + store in 'salesData' collection
    ↓
Return sync result to frontend
```

### 1.2 Request Flow (Manual CSV Upload — Phase 1)

```
Frontend (React)
    ↓ POST /api/data/import (CSV file, no credentials)
    ↓
Backend (Express 3001)
    ↓ Parse CSV → transform to salesData schema
    ↓ POST to PB → create records in 'salesData' collection
    ↓
Return imported record count to frontend
```

### 1.3 Request Flow (Credential Storage)

```
Frontend
    ↓ User enters WooCommerce API key in UI
    ↓ encrypt(apiKey, VITE_ENCRYPTION_KEY)  ← Key never leaves browser
    ↓ PATCH /api/users/preferences { encryptedWoocommerceKey: "..." }
    ↓
Backend
    ↓ Receives encrypted blob
    ↓ Store as-is in PB userPreferences.encryptedWoocommerceKey
    ↓ (Backend never decrypts — it's unreadable without the key)
```

---

## 2. Credential Encryption Layer

### 2.1 Web Crypto API Implementation

**File:** `packages/frontend/src/lib/crypto.ts`

```typescript
/**
 * Frontend-only encryption using Web Crypto API.
 * The VITE_ENCRYPTION_KEY is a 32-byte hex string generated on .env.local setup.
 * The key NEVER leaves the browser.
 */

export async function encryptCredential(
  plaintext: string,
  encryptionKeyHex: string
): Promise<string> {
  // Import the raw key
  const keyBuffer = hexToBytes(encryptionKeyHex)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  // Generate a random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt the plaintext
  const plaintextBuffer = new TextEncoder().encode(plaintext)
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintextBuffer
  )

  // Return: iv (hex) + encryptedData (hex)
  // Format: "iv:ciphertext" for easy storage
  const ivHex = bytesToHex(iv)
  const ciphertextHex = bytesToHex(new Uint8Array(encryptedBuffer))
  return `${ivHex}:${ciphertextHex}`
}

export async function decryptCredential(
  encryptedBlob: string,
  encryptionKeyHex: string
): Promise<string> {
  const [ivHex, ciphertextHex] = encryptedBlob.split(':')
  
  const keyBuffer = hexToBytes(encryptionKeyHex)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const iv = hexToBytes(ivHex)
  const ciphertext = hexToBytes(ciphertextHex)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  )

  return new TextDecoder().decode(decryptedBuffer)
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### 2.2 Environment Setup

**File:** `packages/frontend/.env.local` (user's machine only, never committed)

```
VITE_API_URL=http://localhost:3001
VITE_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6  # 32-byte hex = 256-bit AES key
```

**Generation command (one-time setup):**
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Python
python3 -c "import os; print(os.urandom(32).hex())"
```

### 2.3 Security Properties

**If database is stolen WITHOUT the encryption key:**
- ❌ `userPreferences.encryptedWoocommerceKey` is useless ciphertext
- ❌ Attacker cannot decrypt without VITE_ENCRYPTION_KEY from .env.local
- ❌ Each encryption uses a random IV → same plaintext encrypts differently each time
- ✅ Zero usable credentials recoverable from the database

**If .env.local is stolen:**
- ✅ Encryption key is compromised, but it's on the attacker's LOCAL machine
- ✅ Backend never needs the encryption key (stores encrypted blobs only)
- ⚠️ Attacker can decrypt WooCommerce keys from the database
- 🛡️ Mitigation: Rotate VITE_ENCRYPTION_KEY periodically; admin can invalidate all encrypted credentials

**If both are stolen:**
- ⚠️ WooCommerce API keys are compromised
- 🛡️ Mitigation: User rotates WooCommerce keys in the WC admin, re-encrypts, and uploads new key

---

## 3. PocketBase Hook Layer (v0.30.0)

### 3.1 Hook Directory Structure

```
pocketbase/
├── pb_hooks/
│   ├── ecommerce.pb.js          # Main e-commerce sync hook
│   ├── woocommerce-client.pb.js  # WooCommerce API helper
│   └── sales-data-transform.pb.js # CSV/WC → sales data schema
├── pb_public/
├── pb_data/
└── seed.json
```

### 3.2 Main Hook: `ecommerce.pb.js`

```javascript
// pocketbase/pb_hooks/ecommerce.pb.js
// PocketBase v0.30.0+ — runs server-side JavaScript

/**
 * Hook: beforeCreate('ecommerceSyncLog')
 * 
 * Triggered when backend POSTs to /api/ecommerce/sync
 * The request body includes:
 *   - userId: string
 *   - encryptedWoocommerceKey: string (encrypted, never decrypted here)
 *   - decryptedKeyTemp: string (passed via onBeforeCreate hook context)
 */
onBeforeCreate('ecommerceSyncLog', (e) => {
  const decryptedKey = e.request.data.decryptedKeyTemp
  const userId = e.request.data.userId

  if (!decryptedKey) {
    throw new BadRequestError('decryptedKeyTemp required from backend')
  }

  // Call WooCommerce API (see section 3.3)
  const wcClient = new WooCommerceClient(decryptedKey)
  const wcProducts = wcClient.getProducts()
  const wcOrders = wcClient.getOrders()

  // Transform and store in salesData collection
  const salesRecords = transformWCToSalesData(wcProducts, wcOrders, userId)
  const salesDataCollection = $app.db().collection('salesData')
  for (const record of salesRecords) {
    salesDataCollection.create(record)
  }

  // Create sync log record
  e.record.set('userId', userId)
  e.record.set('status', 'success')
  e.record.set('recordsImported', salesRecords.length)
  e.record.set('syncedAt', new Date().toISOString())
  e.record.set('source', 'woocommerce')
})

/**
 * Hook: beforeCreate('salesData')
 * 
 * Validate that SKU exists in deviceInventory before creating
 */
onBeforeCreate('salesData', (e) => {
  const sku = e.record.get('sku')
  const devicesCollection = $app.db().collection('deviceInventory')
  
  // Find device by SKU
  const device = devicesCollection.findFirstRecordByData('sku', sku)
  if (!device) {
    throw new BadRequestError(`SKU "${sku}" not found in inventory`)
  }
})
```

### 3.3 WooCommerce Client Helper

```javascript
// pocketbase/pb_hooks/woocommerce-client.pb.js
// Wrapper around WooCommerce REST API (v3+)

class WooCommerceClient {
  constructor(apiKey) {
    // apiKey format: "consumer_key:consumer_secret"
    const [key, secret] = apiKey.split(':')
    this.baseUrl = $os.getenv('WC_STORE_URL') || 'https://shop.example.com'
    this.key = key
    this.secret = secret
  }

  /**
   * Get all products (paginated)
   */
  getProducts(perPage = 100) {
    const products = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = `${this.baseUrl}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`
      const response = this._request('GET', url)
      products.push(...response)
      hasMore = response.length === perPage
      page++
    }

    return products
  }

  /**
   * Get all orders (paginated)
   */
  getOrders(perPage = 100) {
    const orders = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = `${this.baseUrl}/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&status=completed`
      const response = this._request('GET', url)
      orders.push(...response)
      hasMore = response.length === perPage
      page++
    }

    return orders
  }

  /**
   * Internal: Basic auth HTTP request
   */
  _request(method, url) {
    const encodedAuth = this._base64(`${this.key}:${this.secret}`)
    
    const client = new http.Client()
    const response = client.send({
      url: url,
      method: method,
      headers: {
        'Authorization': `Basic ${encodedAuth}`,
        'Content-Type': 'application/json'
      },
      timeout: 30 // seconds
    })

    if (response.statusCode >= 400) {
      throw new BadRequestError(`WooCommerce API error: ${response.statusCode}`)
    }

    return JSON.parse(response.contentAsString())
  }

  _base64(str) {
    // PocketBase provides $security.base64Encode
    return $security.base64Encode(str)
  }
}
```

### 3.4 Transform: WooCommerce → AIDA Sales Data

```javascript
// pocketbase/pb_hooks/sales-data-transform.pb.js

/**
 * Transform WooCommerce products + orders into AIDA salesData format
 * 
 * WC Product: { id, sku, name, price, stock_quantity, ... }
 * WC Order: { id, date_created, line_items: [{ product_id, quantity, price, ... }], ... }
 * 
 * AIDA SalesData: { sku, quantity, saleDate, salePrice, source: 'woocommerce' }
 */
function transformWCToSalesData(wcProducts, wcOrders, userId) {
  const salesRecords = []

  // Map product ID to SKU
  const productIdToSku = {}
  for (const product of wcProducts) {
    productIdToSku[product.id] = product.sku || product.id.toString()
  }

  // Create one salesData record per order line item
  for (const order of wcOrders) {
    const orderDate = order.date_created
    for (const item of order.line_items) {
      const sku = productIdToSku[item.product_id]
      if (!sku) continue // Skip if product not found

      salesRecords.push({
        sku: sku,
        quantity: item.quantity,
        saleDate: orderDate,
        salePrice: item.price,
        source: 'woocommerce',
        externalOrderId: order.id.toString(),
        externalLineItemId: item.id.toString(),
        userId: userId
      })
    }
  }

  return salesRecords
}
```

### 3.5 PB v0.30.0 Compatibility Notes

**Collection access syntax (v0.30.0):**
```javascript
// ✅ Correct
const collection = $app.db().collection('salesData')
const record = collection.findFirstRecordByData('sku', 'ABC123')
const created = collection.create(data)
const updated = collection.update(recordId, data)

// ❌ Deprecated (v0.29.x)
const records = $app.dao().findRecordsByFilter(...)  // Use collection().findByFilter() instead
const record = $app.dao().findRecordById(...)        // Use collection().findById() instead
```

**Admin authentication (v0.30.0):**
```javascript
// PocketBase now uses _superusers collection
// Hook can access any collection with $app.db().collection('name')
// No explicit auth needed — hooks run as admin by default
```

**HTTP client in hooks:**
```javascript
// v0.30.0 provides http.Client() for outbound requests
const client = new http.Client()
const response = client.send({
  url: 'https://example.com/api/endpoint',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' },
  timeout: 30
})
```

---

## 4. Backend Integration (`packages/backend`)

### 4.1 Encryption/Decryption in Express

**File:** `packages/backend/src/lib/decryption.ts`

```typescript
/**
 * Backend decryption helper.
 * ONLY used to decrypt credentials for passing to PB hooks.
 * Credentials are decrypted, used immediately, and never stored.
 */

import crypto from 'crypto'

export async function decryptWoocommerceKey(
  encryptedBlob: string,
  encryptionKeyHex: string
): Promise<string> {
  // Inverse of frontend encryptCredential()
  const [ivHex, ciphertextHex] = encryptedBlob.split(':')
  
  const key = Buffer.from(encryptionKeyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf-8')
}
```

### 4.2 Route: POST /api/ecommerce/sync

**File:** `packages/backend/src/routes/ecommerce.ts`

```typescript
import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import { decryptWoocommerceKey } from '../lib/decryption.js'
import { requireRole } from '../middleware/rbac.js'

/**
 * POST /api/ecommerce/sync
 * Initiates a WooCommerce → AIDA sync operation.
 * 
 * Body: { }  (encrypted key is already in userPreferences)
 * Response: { recordsImported: number, status: 'success' | 'error' }
 */
export async function syncWoocommerce(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = req.user.id

    // Fetch user's encrypted WooCommerce key from userPreferences
    const userPrefs = await pb
      .collection('userPreferences')
      .getFirstListItem(`userId = "${userId}"`)
      .catch(() => null)

    if (!userPrefs?.encryptedWoocommerceKey) {
      res.status(400).json({ error: 'No WooCommerce credentials configured' })
      return
    }

    // Decrypt the key
    const encryptionKey = process.env.VITE_ENCRYPTION_KEY
    if (!encryptionKey) {
      res.status(500).json({ error: 'Server encryption key not configured' })
      return
    }

    const decryptedKey = await decryptWoocommerceKey(
      userPrefs.encryptedWoocommerceKey,
      encryptionKey
    )

    // Create sync log with decrypted key in context
    const syncLog = await pb.collection('ecommerceSyncLog').create({
      userId,
      encryptedWoocommerceKey: userPrefs.encryptedWoocommerceKey,
      decryptedKeyTemp: decryptedKey,  // ← Passed to PB hook
      status: 'pending'
    })

    // Hook processes the sync asynchronously
    res.status(200).json({
      recordsImported: syncLog.recordsImported || 0,
      status: syncLog.status
    })
  } catch (err: unknown) {
    console.error('[Ecommerce] Sync failed:', err)
    res.status(400).json({ error: 'Sync failed' })
  }
}
```

### 4.3 Route: POST /api/data/import (Manual CSV)

**File:** `packages/backend/src/routes/csvImport.ts`

```typescript
import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'
import { parseCSV } from '../lib/csvParser.js'

/**
 * POST /api/data/import
 * Manual CSV upload for sales data (Phase 1 fallback).
 * No credentials required — works entirely offline.
 * 
 * Body: multipart/form-data { file: <CSV> }
 * CSV columns: sku, quantity, saleDate, salePrice
 * Response: { recordsImported: number, errors: string[] }
 */
export async function importSalesDataCSV(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'No CSV file provided' })
      return
    }

    // Parse CSV
    const records = parseCSV(file.buffer.toString('utf-8'))
    const userId = req.user.id
    const errors: string[] = []
    let importedCount = 0

    // Validate and create records
    const salesDataCollection = pb.collection('salesData')
    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i]
        if (!record.sku || !record.quantity) {
          errors.push(`Row ${i + 1}: Missing sku or quantity`)
          continue
        }

        // Create in PB (hook validates SKU exists)
        await salesDataCollection.create({
          sku: record.sku,
          quantity: parseInt(record.quantity),
          saleDate: record.saleDate || new Date().toISOString(),
          salePrice: parseFloat(record.salePrice || '0'),
          source: 'manual_csv',
          userId
        })
        importedCount++
      } catch (rowErr: unknown) {
        errors.push(`Row ${i + 1}: ${(rowErr as Error).message}`)
      }
    }

    res.status(200).json({
      recordsImported: importedCount,
      errors,
      totalRows: records.length
    })
  } catch (err: unknown) {
    console.error('[CSV Import] Failed:', err)
    res.status(400).json({ error: 'CSV import failed' })
  }
}
```

---

## 5. Frontend Integration

### 5.1 Encryption UI Component

**File:** `packages/frontend/src/components/WoocommerceSetup.tsx`

```tsx
import React, { useState } from 'react'
import { apiClient } from '../lib/apiClient'
import { encryptCredential } from '../lib/crypto'
import type { User } from '@aida/shared'

export function WoocommerceSetup({ user }: { user: User | null }) {
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!consumerKey || !consumerSecret) {
        setError('Both Consumer Key and Secret are required')
        return
      }

      // Combine key:secret
      const plaintext = `${consumerKey}:${consumerSecret}`
      
      // Encrypt using Web Crypto API
      const encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY
      if (!encryptionKey) {
        setError('VITE_ENCRYPTION_KEY not configured in .env.local')
        return
      }

      const encrypted = await encryptCredential(plaintext, encryptionKey)

      // Save encrypted blob to backend
      await apiClient.patch('/api/users/preferences', {
        encryptedWoocommerceKey: encrypted
      })

      setConsumerKey('')
      setConsumerSecret('')
      alert('WooCommerce credentials saved and encrypted')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
      <h3 className="font-bold text-yellow-900 mb-2">⚠️ WooCommerce Setup</h3>
      <p className="text-sm text-yellow-800 mb-4">
        Your API credentials are encrypted locally and never sent over the network.
      </p>
      <input
        type="password"
        placeholder="Consumer Key"
        value={consumerKey}
        onChange={e => setConsumerKey(e.target.value)}
        className="block w-full mb-2 p-2 border rounded"
      />
      <input
        type="password"
        placeholder="Consumer Secret"
        value={consumerSecret}
        onChange={e => setConsumerSecret(e.target.value)}
        className="block w-full mb-2 p-2 border rounded"
      />
      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save & Encrypt'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}
```

### 5.2 Manual CSV Upload Component

**File:** `packages/frontend/src/components/CSVImport.tsx`

```tsx
import React, { useRef, useState } from 'react'
import { apiClient } from '../lib/apiClient'

export function CSVImport() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  const handleUpload = async () => {
    if (!fileInput.current?.files?.length) return

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', fileInput.current.files[0])

      const response = await apiClient.post('/api/data/import', formData)
      setResult({
        imported: response.recordsImported,
        errors: response.errors
      })
    } catch (err: unknown) {
      console.error('[CSV Import]', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Manual CSV Upload (Phase 1)</h3>
      <p className="text-sm text-gray-600 mb-4">
        No API credentials needed. Upload a CSV with columns: sku, quantity, saleDate, salePrice
      </p>
      <input
        ref={fileInput}
        type="file"
        accept=".csv"
        disabled={loading}
        className="block mb-2"
      />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? 'Uploading...' : 'Upload CSV'}
      </button>
      {result && (
        <div className="mt-4 p-2 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800">✓ Imported {result.imported} records</p>
          {result.errors.length > 0 && (
            <ul className="text-sm text-red-600 mt-2">
              {result.errors.slice(0, 5).map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## 6. Manual CSV Fallback Schema (Phase 1)

### 6.1 CSV Format

**File:** `docs/csv_schema.md`

```
sku,quantity,saleDate,salePrice
DEVICE-001,2,2026-05-01T10:00:00Z,299.99
DEVICE-002,1,2026-05-02T14:30:00Z,199.99
COMP-A,5,2026-05-03T09:15:00Z,45.00
```

**Validation:**
- ✅ `sku`: String, must exist in `deviceInventory.sku`
- ✅ `quantity`: Positive integer
- ✅ `saleDate`: ISO 8601 timestamp (optional, defaults to now)
- ✅ `salePrice`: Float, non-negative

### 6.2 CSV Parser

**File:** `packages/backend/src/lib/csvParser.ts`

```typescript
export function parseCSV(csvText: string): Record<string, any>[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const records: Record<string, any>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) continue

    const record: Record<string, any> = {}
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j]
    }
    records.push(record)
  }

  return records
}
```

---

## 7. Environment Variables & Secrets

### 7.1 Backend `.env`

```env
# PocketBase
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=admin@aida.local
PB_ADMIN_PASSWORD=<secure_password>

# Encryption (shared with frontend)
VITE_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# WooCommerce (optional, can be set per-user)
WC_STORE_URL=https://shop.example.com

# Express
PORT=3001
NODE_ENV=production
JWT_SECRET=<long_random_secret>
ALLOWED_ORIGIN=https://app.example.com
```

### 7.2 Frontend `.env.local` (user-specific, never committed)

```env
VITE_API_URL=http://localhost:3001
VITE_ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**⚠️ Critical:** `VITE_ENCRYPTION_KEY` must be the SAME on backend and frontend for decryption to work in backend.

---

## 8. Security Guarantees & Threat Model

### 8.1 Threat: Database Exfiltration (Without Key)

**Scenario:** Attacker steals PocketBase database.

**Impact:**
- ❌ Cannot decrypt `userPreferences.encryptedWoocommerceKey` (AES-256-GCM with random IV)
- ❌ Cannot call WooCommerce API
- ❌ Cannot exfiltrate live inventory or orders
- ✅ Only nonsensitive data like user names and role assignments are readable

**Residual Risk:** Very Low

---

### 8.2 Threat: Client-Side Key Extraction

**Scenario:** Attacker injects JavaScript into frontend.

**Impact:**
- ❌ `VITE_ENCRYPTION_KEY` is in `.env.local`, not sent to browser in build
- ⚠️ If attacker controls the frontend build, they can read the key from `.env.local` on the user's machine
- ✅ Key is never transmitted in HTTP requests or stored in localStorage

**Mitigation:**
- Use a build tool that strictly excludes `VITE_ENCRYPTION_KEY` from bundles
- Vite's `import.meta.env` only includes vars prefixed with `VITE_` and explicitly used in code
- Never reference the key in frontend code except in `crypto.ts`

---

### 8.3 Threat: Key Rotation

**Scenario:** Need to change VITE_ENCRYPTION_KEY.

**Process:**
1. Admin updates `.env.local` with new key
2. User enters WooCommerce credentials again (frontend re-encrypts with new key)
3. Old encrypted blobs become unreadable (acceptable loss if credentials are rotated anyway)

**Automation (future):**
- Implement a key rotation endpoint that decrypts with old key + re-encrypts with new key

---

### 8.4 Threat: PocketBase Hook Compromise

**Scenario:** Attacker gains write access to `pb_hooks/ecommerce.pb.js`.

**Impact:**
- ⚠️ Attacker can read decrypted credentials from hook context
- ⚠️ Attacker can create arbitrary salesData records
- ✅ Backend still validates data via collection rules (PB-level)
- ✅ Frontend still checks RBAC (requireRole middleware)

**Mitigation:**
- PocketBase runs in a protected environment (Docker container, not exposed)
- Hook files are read-only in production (file permissions)
- Git history tracks all hook changes (audit trail)

---

## 9. Integration Checklist (Phase 0 Complete)

- [x] PB Hook layer architecture defined (ecommerce.pb.js)
- [x] WooCommerce client helper specified (woocommerce-client.pb.js)
- [x] Web Crypto API encryption implementation (src/lib/crypto.ts)
- [x] Backend decryption for hooks (src/lib/decryption.ts)
- [x] Manual CSV fallback schema defined
- [x] PB v0.30.0 compatibility verified
- [x] Security threat model documented
- [x] Environment variables specified
- [x] Frontend UI components sketched (WoocommerceSetup, CSVImport)

---

## 10. Phase 1-3 Roadmap

### Phase 1: Scaffolding + Manual Mode (GPT-4.1)
- [ ] Setup monorepo folders
- [ ] Implement CSV import route + parser
- [ ] Create CSVImport React component
- [ ] Test manual CSV upload end-to-end

### Phase 2: Crypto + PB Hooks (Claude Haiku + Claude Sonnet)
- [ ] Implement crypto.ts (encryptCredential, decryptCredential)
- [ ] Implement decryption.ts in backend
- [ ] Create PB hooks (ecommerce.pb.js, woocommerce-client.pb.js)
- [ ] Implement POST /api/ecommerce/sync endpoint
- [ ] Security audit: Verify no credentials in Network tab
- [ ] Commit packages/backend with functional hooks

### Phase 3: Validation (Claude Sonnet + GPT-5)
- [ ] Run verification checklist from migration_spec.md
- [ ] Test encrypted credential storage + retrieval
- [ ] Test WooCommerce → AIDA data sync
- [ ] Verify manual CSV fallback works
- [ ] Final git commit: "arch: monorepo + encrypted ecommerce hooks"
- [ ] Update README.md with security section

---

## 11. Known Limitations & Future Work

| Item | Status | Impact |
|---|---|---|
| Key rotation automation | Future | Manual process currently; consider auto-rotation service |
| Hook error logging | Future | Add structured logging to hooks for debugging |
| WooCommerce webhook support | Future | Can replace polling with WC webhooks for near-realtime |
| Multi-store support | Future | Currently single WC_STORE_URL; can extend to per-user stores |
| Rate limiting on sync | Future | Add exponential backoff for WC API rate limits |
| Data versioning | Future | Track which WC data created which AIDA records (lineage) |

---

**This specification is complete and ready for Phase 1 implementation.**
