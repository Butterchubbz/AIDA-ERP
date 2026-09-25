import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

/**
 * GET /api/orders
 * List all orders.
 */
export async function listOrders(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const orders = await pb.collection('quoteApprovedOrders').getFullList()
    res.status(200).json(orders)
  } catch (err: unknown) {
    console.error('[Orders] GET orders failed:', err)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
}

/**
 * POST /api/orders
 * Create a new order.
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const order = await pb.collection('quoteApprovedOrders').create(data)
    res.status(201).json(order)
  } catch (err: unknown) {
    console.error('[Orders] POST order failed:', err)
    res.status(400).json({ error: 'Failed to create order' })
  }
}

/**
 * PATCH /api/orders/:id
 * Update an order.
 */
export async function updateOrder(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const order = await pb.collection('quoteApprovedOrders').update(id, data)
    res.status(200).json(order)
  } catch (err: unknown) {
    console.error('[Orders] PATCH order failed:', err)
    res.status(400).json({ error: 'Failed to update order' })
  }
}

/**
 * DELETE /api/orders/:id
 * Delete an order.
 */
export async function deleteOrder(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('quoteApprovedOrders').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Orders] DELETE order failed:', err)
    res.status(400).json({ error: 'Failed to delete order' })
  }
}
