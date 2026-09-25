import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

const USER_UPDATE_FIELDS = new Set(['name', 'email', 'role', 'roles'])

/**
 * GET /api/users
 * List all users (admin only — requires superuser PB auth).
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const users = await pb.collection('users').getFullList()
    res.status(200).json(users)
  } catch (err: unknown) {
    console.error('[Users] GET failed:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
}

/**
 * PATCH /api/users/:id
 * Update a user record (e.g. roles, display name).
 */
export async function updateUser(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { id } = req.params
  let data = Object.fromEntries(
    Object.entries(req.body ?? {}).filter(([field]) => USER_UPDATE_FIELDS.has(field))
  )
  const changesRole = 'role' in data || 'roles' in data

  if (req.user.role !== 'Admin' && id !== req.user.id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  if (changesRole && req.user.role !== 'Admin') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  if (changesRole && id === req.user.id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  if (req.user.role !== 'Admin' && 'email' in data) {
    const { email: _email, ...nameOnly } = data
    data = nameOnly

    if (!('name' in data)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
  }

  try {
    const user = await pb.collection('users').update(id, data)
    res.status(200).json(user)
  } catch (err: unknown) {
    console.error('[Users] PATCH failed:', err)
    res.status(400).json({ error: 'Failed to update user' })
  }
}
