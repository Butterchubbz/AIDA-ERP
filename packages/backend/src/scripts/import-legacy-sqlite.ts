import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import type { ReturnCondition, ReturnStatus, ShippingCarrier, ShippingItemLine, ShippingStatus } from '@aida/shared'
import pb, { authenticatePocketBase } from '../lib/pocketbase.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../../../')
const BACKEND_ENV_PATH = path.resolve(REPO_ROOT, 'packages/backend/.env')

const RETURN_TABLE_CANDIDATES = ['returns_log', 'returns', 'eu_returns', 'rma', 'rma_log']
const SHIPPING_TABLE_CANDIDATES = ['shipping_history', 'shipments', 'shipping', 'outbound_shipments']
const BATCH_SIZE = 50

type ImportType = 'returns' | 'shipping'

type SqliteRecord = Record<string, unknown>

type SqliteDatabase = {
  all: (sql: string, params?: unknown[], callback?: (err: Error | null, rows: unknown[]) => void) => unknown
  get: (sql: string, params?: unknown[], callback?: (err: Error | null, row: unknown) => void) => unknown
  close: (callback?: (err?: Error) => void) => unknown
  on?: (event: 'error' | 'open', handler: (...args: unknown[]) => void) => unknown
  filename?: string
}

type SqliteModule = {
  Database?: new (filename: string, mode?: number) => SqliteDatabase
  OPEN_READONLY?: number
  default?: {
    Database?: new (filename: string, mode?: number) => SqliteDatabase
    OPEN_READONLY?: number
  }
  open?: (options: { filename: string; driver?: unknown }) => Promise<{
    all: (sql: string, params?: unknown[]) => Promise<unknown[]>
    get: (sql: string, params?: unknown[]) => Promise<unknown>
    run: (sql: string, params?: unknown[]) => Promise<unknown>
    close: () => Promise<void>
  }>
}

interface ParsedArgs {
  type: ImportType
  file: string
  workspaceId?: string
}

function printHelp(): void {
  console.log('AIDA SQLite Legacy Import Utility\n')
  console.log('Usage:')
  console.log('  npm run import:sqlite -- --type=returns --file=./path/to/legacy.db')
  console.log('  npm run import:sqlite -- --type=shipping --file=./path/to/legacy.db --workspaceId=<optional-uuid>')
  console.log('')
  console.log('Options:')
  console.log('  --type        Required. One of: returns | shipping')
  console.log('  --file        Required. Path to the legacy SQLite database file')
  console.log('  --workspaceId Optional. Workspace UUID to attach imported records to')
}

function parseArguments(argv: string[]): ParsedArgs {
  const parsed: Record<string, string> = {}

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, rawValue] = arg.slice(2).split('=', 2)
    if (key) {
      parsed[key] = rawValue ?? 'true'
    }
  }

  const typeValue = parsed.type?.trim().toLowerCase()
  const fileValue = parsed.file?.trim()
  const workspaceId = parsed.workspaceId?.trim() || undefined

  if (!typeValue || (typeValue !== 'returns' && typeValue !== 'shipping')) {
    throw new Error('Invalid or missing --type. Supported values: returns, shipping.')
  }

  if (!fileValue) {
    throw new Error('Missing --file. Provide a path to the legacy SQLite database file.')
  }

  return { type: typeValue as ImportType, file: fileValue, workspaceId }
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (value === null || value === undefined) {
    return undefined
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeLower(value: unknown): string {
  return normalizeString(value)?.toLowerCase() ?? ''
}

function toIsoDate(value: unknown, fallbackNow = true): string {
  const raw = normalizeString(value)
  if (!raw) {
    return fallbackNow ? new Date().toISOString() : ''
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return fallbackNow ? new Date().toISOString() : ''
}

function findInRow(row: SqliteRecord, keys: string[]): unknown {
  const normalizedKeyMap = new Map<string, unknown>()
  for (const [key, value] of Object.entries(row)) {
    normalizedKeyMap.set(key.toLowerCase().replace(/[^a-z0-9]/g, ''), value)
  }

  for (const key of keys) {
    const match = normalizedKeyMap.get(key.toLowerCase().replace(/[^a-z0-9]/g, ''))
    if (match !== undefined) return match
  }

  return undefined
}

function normalizeRmaNumber(value: unknown): string {
  const normalized = normalizeString(value)
  if (!normalized) {
    throw new Error('Legacy row is missing a required rmaNumber value.')
  }

  return normalized
}

function normalizeSku(value: unknown): string {
  const normalized = normalizeString(value)
  if (!normalized) {
    throw new Error('Legacy row is missing a required SKU value.')
  }

  return normalized.toUpperCase()
}

function normalizeReturnCondition(value: unknown): ReturnCondition {
  const normalized = normalizeLower(value)

  if (['unopened', 'new', 'sealed', 'neverused'].includes(normalized)) return 'unopened'
  if (['opened_functional', 'functional', 'opened', 'good'].includes(normalized)) return 'opened_functional'
  if (['refurbishable', 'repairable', 'repair', 'rework'].includes(normalized)) return 'refurbishable'
  if (['scrap', 'damaged', 'broken', 'defective'].includes(normalized)) return 'scrap'

  return 'opened_functional'
}

function normalizeReturnStatus(value: unknown): ReturnStatus {
  const normalized = normalizeLower(value)

  if (['pending_receipt', 'pending', 'awaiting', 'new'].includes(normalized)) return 'pending_receipt'
  if (['received', 'arrived', 'accepted'].includes(normalized)) return 'received'
  if (['under_test', 'testing', 'in_test', 'inspection'].includes(normalized)) return 'under_test'
  if (['refurbished', 'repaired', 'restored'].includes(normalized)) return 'refurbished'
  if (['scrapped', 'disposed', 'discarded', 'scrap'].includes(normalized)) return 'scrapped'

  return 'received'
}

function normalizeShippingCarrier(value: unknown): ShippingCarrier {
  const normalized = normalizeLower(value)

  if (['dhl'].includes(normalized)) return 'DHL'
  if (['dpd'].includes(normalized)) return 'DPD'
  if (['ups'].includes(normalized)) return 'UPS'
  if (['fedex', 'fed ex', 'fedexexpress'].includes(normalized)) return 'FedEx'

  return 'Other'
}

function normalizeShippingStatus(value: unknown): ShippingStatus {
  const normalized = normalizeLower(value)

  if (['label_created', 'created', 'labelcreated', 'ready', 'awaiting'].includes(normalized)) return 'label_created'
  if (['in_transit', 'intransit', 'transit', 'shipping', 'dispatched'].includes(normalized)) return 'in_transit'
  if (['delivered', 'complete', 'completed'].includes(normalized)) return 'delivered'
  if (['exception', 'problem', 'delayed', 'hold'].includes(normalized)) return 'exception'

  return 'delivered'
}

function safeFloat(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback

  const parsed = Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseShippingItems(value: unknown): ShippingItemLine[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (isObjectLike(entry)) {
          const sku = normalizeString(entry.sku ?? entry.SKU ?? entry.item ?? entry.product)
          const qty = Number(entry.qty ?? entry.quantity ?? entry.count ?? 1)
          if (!sku) return null
          return { sku: sku.toUpperCase(), qty: Number.isFinite(qty) ? qty : 1 }
        }

        if (typeof entry === 'string') {
          const parts = entry.split(':')
          if (parts.length >= 2) {
            return { sku: parts[0].trim().toUpperCase(), qty: Number.parseInt(parts[1], 10) || 1 }
          }
        }

        return null
      })
      .filter((entry): entry is ShippingItemLine => entry !== null)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return [{ sku: 'LEGACY-ITEM', qty: 1 }]

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parseShippingItems(parsed)
    } catch {
      // ignore malformed JSON and fall through below
    }

    const segments = trimmed.split(/[|,;]/)
    const items: ShippingItemLine[] = []

    for (const segment of segments) {
      const pair = segment.trim()
      if (!pair) continue
      const match = pair.match(/^([^:]+):\s*(\d+)$/i)
      if (match) {
        items.push({ sku: match[1].trim().toUpperCase(), qty: Number.parseInt(match[2], 10) || 1 })
      } else {
        items.push({ sku: pair.toUpperCase(), qty: 1 })
      }
    }

    return items.length > 0 ? items : [{ sku: 'LEGACY-ITEM', qty: 1 }]
  }

  return [{ sku: 'LEGACY-ITEM', qty: 1 }]
}

function loadEnvironmentFile(): void {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(BACKEND_ENV_PATH)
  }
}

async function resolveSqliteModule(): Promise<SqliteModule> {
  const candidates = ['sqlite3', 'sqlite']

  for (const candidate of candidates) {
    try {
      const mod = await new Function('specifier', 'return import(specifier)')(candidate)
      if (mod && typeof mod === 'object') {
        return mod as SqliteModule
      }
    } catch {
      // try the next SQLite driver candidate
    }
  }

  throw new Error('sqlite3/sqlite is not installed. Install one of them before running the import job.')
}

function getSqliteCtor(moduleValue: SqliteModule): new (filename: string, mode?: number) => SqliteDatabase {
  const defaultModule = moduleValue.default ?? moduleValue
  const ctor = defaultModule.Database
  if (!ctor) {
    throw new Error('The SQLite driver does not expose a Database class.')
  }
  return ctor
}

function createDatabase(dbPath: string, moduleValue: SqliteModule): Promise<SqliteDatabase> {
  const DatabaseCtor = getSqliteCtor(moduleValue)
  const mode = moduleValue.default?.OPEN_READONLY ?? moduleValue.OPEN_READONLY

  return new Promise((resolve, reject) => {
    const db = new DatabaseCtor(dbPath, mode)
    db.on?.('error', (err: unknown) => reject(err))
    db.on?.('open', () => resolve(db))
  })
}

function dbAll(db: SqliteDatabase, sql: string, params: unknown[] = []): Promise<SqliteRecord[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: unknown[]) => {
      if (err) {
        reject(err)
        return
      }
      resolve(rows as SqliteRecord[])
    })
  })
}

function dbClose(db: SqliteDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err?: Error) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

async function getLegacyTableName(db: SqliteDatabase, type: ImportType): Promise<string> {
  const candidates = type === 'returns' ? RETURN_TABLE_CANDIDATES : SHIPPING_TABLE_CANDIDATES
  const tableNames: string[] = await dbAll(db, "SELECT name FROM sqlite_master WHERE type = 'table'")
    .then((rows) => rows.map((row) => String(row.name ?? '')))
    .catch(() => [] as string[])

  const match = candidates.find((candidate) => tableNames.includes(candidate))
  if (!match) {
    throw new Error(`No compatible legacy ${type} table was found in ${db.filename ?? 'the SQLite file'}. Expected one of: ${candidates.join(', ')}`)
  }

  return match
}

function renderProgress(current: number, total: number): string {
  const percent = total === 0 ? 0 : Math.round((current / total) * 100)
  const filled = Math.max(0, Math.min(20, Math.round((percent / 100) * 20)))
  const bar = `${'='.repeat(filled)}${'-'.repeat(20 - filled)}`
  return `Importing: [${bar}] ${percent}% | ${current}/${total} records migrated successfully.`
}

async function importReturns(db: SqliteDatabase, tableName: string, workspaceId?: string): Promise<number> {
  const rows = await dbAll(db, `SELECT * FROM "${tableName}"`)
  const total = rows.length
  let imported = 0

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      const rmaNumber = normalizeRmaNumber(findInRow(row, ['rma_number', 'rma', 'rmaNo', 'rma_num']))
      const sku = normalizeSku(findInRow(row, ['sku', 'part_number', 'item_sku']))
      const serialNumber = normalizeString(findInRow(row, ['serial_number', 'serial', 'sn']))
      const returnReason = normalizeString(findInRow(row, ['reason', 'defect_description', 'defect', 'reason_code']))
      const condition = normalizeReturnCondition(findInRow(row, ['condition_state', 'condition', 'state']))
      const status = normalizeReturnStatus(findInRow(row, ['status', 'return_status']))
      const processedBy = normalizeString(findInRow(row, ['operator', 'agent', 'processed_by'])) ?? 'system_import'
      const receivedAt = toIsoDate(findInRow(row, ['received_date', 'timestamp', 'receivedAt']), true)

      const payload: Record<string, unknown> = {
        rmaNumber,
        sku,
        serialNumber,
        customerName: normalizeString(findInRow(row, ['customer_name', 'customer', 'customerName'])) ?? 'Legacy import',
        returnReason,
        condition,
        status,
        processedBy,
        receivedAt,
        historyLogs: [
          {
            timestamp: new Date().toISOString(),
            status,
            changedBy: processedBy,
            notes: 'Imported from legacy SQLite database',
          },
        ],
      }

      if (workspaceId) {
        payload.workspaceId = workspaceId
      }

      await pb.collection('euReturns').create(payload)
      imported += 1
      console.log(renderProgress(imported, total))
    }
  }

  return imported
}

async function importShipping(db: SqliteDatabase, tableName: string, workspaceId?: string): Promise<number> {
  const rows = await dbAll(db, `SELECT * FROM "${tableName}"`)
  const total = rows.length
  let imported = 0

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      const trackingNumber = normalizeString(findInRow(row, ['tracking_number', 'tracking', 'trackingNo']))
      if (!trackingNumber) {
        continue
      }

      const carrier = normalizeShippingCarrier(findInRow(row, ['carrier_name', 'carrier', 'courier']))
      const destination = normalizeString(findInRow(row, ['country', 'city', 'destination', 'dest'])) ?? 'UNKNOWN'
      const shipDate = toIsoDate(findInRow(row, ['ship_date', 'date_shipped', 'shipDate']), true)
      const status = normalizeShippingStatus(findInRow(row, ['shipping_status', 'status', 'shipment_status']))
      const itemsShipped = parseShippingItems(findInRow(row, ['items_json', 'items', 'shipment_items', 'itemsShipped']))
      const packageWeight = safeFloat(findInRow(row, ['weight_kg', 'weight', 'package_weight']), 0.1)
      const postageCost = safeFloat(findInRow(row, ['postage_cost', 'cost', 'shipping_cost']), 0)

      const payload: Record<string, unknown> = {
        trackingNumber,
        carrier,
        destination,
        shipDate,
        status,
        itemsShipped,
        packageWeight,
        postageCost,
      }

      if (workspaceId) {
        payload.workspaceId = workspaceId
      }

      await pb.collection('shippingHistory').create(payload)
      imported += 1
      console.log(renderProgress(imported, total))
    }
  }

  return imported
}

async function runMigration(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const resolvedPath = path.resolve(process.cwd(), args.file)

  if (!existsSync(resolvedPath)) {
    throw new TypeError(`SQLite file was not found: ${resolvedPath}`)
  }

  loadEnvironmentFile()
  await authenticatePocketBase()

  const runtimeModule = await resolveSqliteModule()
  const db = await createDatabase(resolvedPath, runtimeModule)

  try {
    const tableName = await getLegacyTableName(db, args.type)
    const count = args.type === 'returns'
      ? await importReturns(db, tableName, args.workspaceId)
      : await importShipping(db, tableName, args.workspaceId)

    console.log('')
    console.log(`Migration complete: ${count} ${args.type} records imported into PocketBase.`)
    console.log(`Source database: ${resolvedPath}`)
    console.log(`Destination collection: ${args.type === 'returns' ? 'euReturns' : 'shippingHistory'}`)
    console.log(`Table parsed: ${tableName}`)
  } finally {
    await dbClose(db)
  }
}

async function main(): Promise<void> {
  try {
    await runMigration()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('\nImport failed:')
    console.error(message)
    console.error('')
    printHelp()
    process.exitCode = 1
  }
}

void main()
