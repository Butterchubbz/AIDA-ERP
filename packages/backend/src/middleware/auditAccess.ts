import type { NextFunction, Request, Response } from 'express'

/** Allows audit access to Admins and Managers without granting the Admin module to Managers. */
export function requireAuditReadAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!['Admin', 'Manager'].includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  next()
}