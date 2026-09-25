import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

export async function listAuditRecords(req: Request, res: Response): Promise<void> {
  if (!req.user || !['Admin', 'Manager'].includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(String(req.query.perPage ?? '50'), 10) || 50))
  const options: { sort: string; filter?: string } = { sort: '-timestamp' }
  if (req.user.role === 'Manager') {
    options.filter = pb.filter('actor = {:actor}', { actor: req.user.email })
  }

  try {
    const records = await pb.collection('auditLog').getList(page, perPage, options)
    if (req.user.role === 'Manager') {
      res.status(200).json({
        ...records,
        items: records.items.map(({ changes: _changes, ip: _ip, userAgent: _userAgent, ...record }) => record),
      })
      return
    }

    res.status(200).json(records)
  } catch (err: unknown) {
    console.error('[Audit] GET failed:', err)
    res.status(500).json({ error: 'Failed to fetch audit records' })
  }
}