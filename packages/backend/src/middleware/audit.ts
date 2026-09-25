import type { NextFunction, Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

const REDACTED_FIELDS = new Set([
  'password',
  'passwordconfirm',
  'oldpassword',
  'key',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'aida_session',
  'aida_refresh',
  'setuptoken',
  'encryptedcredentials',
  'encryptedwoocommercekey',
  'consumersecret',
  'consumerkey',
])
const MAX_CHANGES_BYTES = 8 * 1024

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'failed-login'

export interface AuditDetails {
  actor: string
  action: AuditAction
  collection: string
  recordId?: string
  changes?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

function redact(value: unknown, fieldName?: string): unknown {
  if (fieldName && REDACTED_FIELDS.has(fieldName.toLowerCase())) {
    return '[REDACTED]'
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redact(item, key)])
    )
  }

  return value
}

export function sanitizeAuditChanges(changes: Record<string, unknown> = {}): Record<string, unknown> {
  const redacted = redact(changes) as Record<string, unknown>
  const serialized = JSON.stringify(redacted)
  if (Buffer.byteLength(serialized, 'utf8') <= MAX_CHANGES_BYTES) {
    return redacted
  }

  return {
    truncated: true,
    preview: serialized.slice(0, MAX_CHANGES_BYTES - 64),
  }
}

export async function writeAuditRecord(details: AuditDetails): Promise<void> {
  try {
    await pb.collection('auditLog').create({
      actor: details.actor,
      action: details.action,
      collection: details.collection,
      recordId: details.recordId ?? '',
      changes: sanitizeAuditChanges(details.changes),
      ip: details.ip ?? '',
      userAgent: details.userAgent ?? '',
    })
  } catch (err: unknown) {
    console.error('[Audit] Failed to write audit record:', err)
  }
}

function collectionForPath(path: string): string {
  return path.replace(/^\/api\//, '').split('/').slice(0, 2).join('/') || 'unknown'
}

function recordIdForRequest(req: Request, responseBody: unknown): string {
  if (req.method === 'DELETE') {
    const segments = req.path.split('/').filter(Boolean)
    const candidate = segments.at(-1)
    return candidate && !['batch', 'move', 'sync', 'push', 'forecast', 'import', 'upsert', 'connect', 'dismiss'].includes(candidate)
      ? candidate
      : ''
  }

  if (responseBody && typeof responseBody === 'object' && 'id' in responseBody) {
    return String((responseBody as { id: unknown }).id)
  }

  const segments = req.path.split('/').filter(Boolean)
  const candidate = segments.at(-1)
  return candidate && !['batch', 'move', 'sync', 'push', 'forecast', 'import', 'upsert', 'connect', 'dismiss'].includes(candidate)
    ? candidate
    : ''
}

function pocketBaseCollectionForPath(path: string): string | null {
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean)
  const twoSegmentKey = segments.slice(0, 2).join('/')
  const collections: Record<string, string> = {
    'users': 'users',
    'inventory/devices': 'inventoryDevice',
    'inventory/components': 'inventoryComponent',
    'inventory/accessories': 'inventoryAccessory',
    'amazon/pos': 'amazonPOs',
    'amazon/devices': 'amazonDevices',
    'amazon/variants': 'amazonVariants',
    'shipments/inbound': 'inboundShipments',
    'shipments/outbound': 'shipments',
    'rma/tickets': 'rmaEntries',
    'orders': 'orders',
    'refurbished': 'refurbishedDevices',
    'returns': 'euReturns',
    'shipping': 'shippingHistory',
  }

  return collections[twoSegmentKey] ?? collections[segments[0] ?? ''] ?? null
}

function changesForRequest(req: Request, previousRecord: Record<string, unknown> | null): Record<string, unknown> {
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
  if (req.method === 'PATCH') {
    return Object.fromEntries(
      Object.entries(body).map(([field, to]) => [field, { from: previousRecord?.[field] ?? null, to }])
    )
  }

  return body
}

/** Records successful API mutations after their response has been sent. */
export async function auditMutations(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method) || !req.path.startsWith('/api/') || req.path === '/api/auth/login') {
    next()
    return
  }

  let previousRecord: Record<string, unknown> | null = null
  if (req.method === 'PATCH') {
    const recordId = recordIdForRequest(req, null)
    const collection = pocketBaseCollectionForPath(req.path)
    if (recordId && collection) {
      try {
        previousRecord = await pb.collection(collection).getOne<Record<string, unknown>>(recordId)
      } catch (err: unknown) {
        console.error('[Audit] Failed to read pre-update record:', err)
      }
    }
  }

  let responseBody: unknown
  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    responseBody = body
    return originalJson(body)
  }) as Response['json']

  res.once('finish', () => {
    if (res.statusCode >= 400) {
      return
    }

    void writeAuditRecord({
      actor: req.user?.email ?? req.user?.id ?? 'anonymous',
      action: req.method === 'POST' ? 'create' : req.method === 'PATCH' ? 'update' : 'delete',
      collection: collectionForPath(req.path),
      recordId: recordIdForRequest(req, responseBody),
      changes: changesForRequest(req, previousRecord),
      ip: req.ip,
      userAgent: req.get('user-agent') ?? '',
    })
  })

  next()
}