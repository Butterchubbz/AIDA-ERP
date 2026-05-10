import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

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

  try {
    const { id } = req.params
    const data = req.body
    const user = await pb.collection('users').update(id, data)
    res.status(200).json(user)
  } catch (err: unknown) {
    console.error('[Users] PATCH failed:', err)
    res.status(400).json({ error: 'Failed to update user' })
  }
}
