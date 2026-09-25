import type { Request, Response, NextFunction } from 'express'
import type { ModuleName, PermissionLevel } from '@aida/shared'

const PERMISSION_RANK: Record<PermissionLevel, number> = {
  None: 0,
  Viewer: 1,
  Editor: 2,
}

/**
 * Require a minimum permission for a shared application module.
 * Authentication must run before this middleware.
 */
export function requireModule(moduleName: ModuleName, minAccess: PermissionLevel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const access = req.user.roles[moduleName] ?? 'None'
    if (PERMISSION_RANK[access] < PERMISSION_RANK[minAccess]) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    next()
  }
}