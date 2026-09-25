import type { Request, Response, NextFunction } from 'express'
import type { ModuleName, PermissionLevel } from '@aida/shared'

/**
 * Permission hierarchy: Editor > Viewer > None
 */
function hasPermission(actual: PermissionLevel, required: PermissionLevel): boolean {
  const rank: Record<PermissionLevel, number> = { Editor: 2, Viewer: 1, None: 0 }
  return rank[actual] >= rank[required]
}

/**
 * Require a specific role/permission level for a module.
 * Returns 403 Forbidden if user lacks the required permission.
 * Assumes req.user is already set by authMiddleware.
 */
export function requireRole(module: ModuleName, required: PermissionLevel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const actual = user.roles[module] ?? 'None'
    if (!hasPermission(actual, required)) {
      res
        .status(403)
        .json({
          error: `Forbidden: requires ${required} on ${module}, you have ${actual}`,
        })
      return
    }

    next()
  }
}
