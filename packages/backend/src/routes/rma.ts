import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

/**
 * GET /api/rma/tickets
 * List all RMA tickets.
 */
export async function listRMATickets(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const tickets = await pb.collection('rmaEntries').getFullList()
    res.status(200).json(tickets)
  } catch (err: unknown) {
    console.error('[RMA] GET tickets failed:', err)
    res.status(500).json({ error: 'Failed to fetch RMA tickets' })
  }
}

/**
 * POST /api/rma/tickets
 * Create a new RMA ticket.
 */
export async function createRMATicket(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const ticket = await pb.collection('rmaEntries').create(data)
    res.status(201).json(ticket)
  } catch (err: unknown) {
    console.error('[RMA] POST ticket failed:', err)
    res.status(400).json({ error: 'Failed to create RMA ticket' })
  }
}

/**
 * PATCH /api/rma/tickets/:id
 * Update an RMA ticket.
 */
export async function updateRMATicket(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const ticket = await pb.collection('rmaEntries').update(id, data)
    res.status(200).json(ticket)
  } catch (err: unknown) {
    console.error('[RMA] PATCH ticket failed:', err)
    res.status(400).json({ error: 'Failed to update RMA ticket' })
  }
}

/**
 * DELETE /api/rma/tickets/:id
 * Delete an RMA ticket.
 */
export async function deleteRMATicket(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('rmaEntries').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[RMA] DELETE ticket failed:', err)
    res.status(400).json({ error: 'Failed to delete RMA ticket' })
  }
}
