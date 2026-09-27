import type { NextFunction, Request, Response } from 'express'
import { isModuleAllowed } from '@aida/shared'

/** Allows audit access to Admins and Managers without granting the Admin module to Managers. */
export function requireAuditReadAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Derive from shared single-source ROLE_MODULES (Admin and Manager allowed)
  if (!isModuleAllowed(req.user.role, 'ForecastingSettings')) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  next()
}