import type { Request, Response } from 'express'
import pb from '../lib/pocketbase.js'

/**
 * GET /api/shipments/inbound
 * List all inbound shipments.
 */
export async function listInboundShipments(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const shipments = await pb.collection('inboundShipments').getFullList()
    res.status(200).json(shipments)
  } catch (err: unknown) {
    console.error('[Shipments] GET inbound failed:', err)
    res.status(500).json({ error: 'Failed to fetch inbound shipments' })
  }
}

/**
 * POST /api/shipments/inbound
 * Create a new inbound shipment.
 */
export async function createInboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const shipment = await pb.collection('inboundShipments').create(data)
    res.status(201).json(shipment)
  } catch (err: unknown) {
    console.error('[Shipments] POST inbound failed:', err)
    res.status(400).json({ error: 'Failed to create inbound shipment' })
  }
}

/**
 * PATCH /api/shipments/inbound/:id
 * Update an inbound shipment.
 */
export async function updateInboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const shipment = await pb.collection('inboundShipments').update(id, data)
    res.status(200).json(shipment)
  } catch (err: unknown) {
    console.error('[Shipments] PATCH inbound failed:', err)
    res.status(400).json({ error: 'Failed to update inbound shipment' })
  }
}

/**
 * DELETE /api/shipments/inbound/:id
 * Delete an inbound shipment.
 */
export async function deleteInboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('inboundShipments').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Shipments] DELETE inbound failed:', err)
    res.status(400).json({ error: 'Failed to delete inbound shipment' })
  }
}

/**
 * POST /api/shipments/inbound/:id/push
 * Push inbound shipment items to inventory.
 * This is a multi-step operation that updates inventory and marks shipment as processed.
 */
export async function pushInboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params

    // TODO: Implement logic to parse items and update inventory
    // For now, just fetch to verify it exists
    await pb.collection('inboundShipments').getOne(id)

    // TODO: Implement the logic to:
    // 1. Parse items from shipment
    // 2. Update inventory quantities
    // 3. Create inventory events
    // 4. Mark shipment as processed
    // For now, just mark as processed
    const updated = await pb.collection('inboundShipments').update(id, {
      status: 'processed',
      processedDate: new Date().toISOString(),
    })

    res.status(200).json(updated)
  } catch (err: unknown) {
    console.error('[Shipments] POST push inbound failed:', err)
    res.status(400).json({ error: 'Failed to push inbound shipment' })
  }
}

/**
 * GET /api/shipments/outbound
 * List all outbound shipments.
 */
export async function listOutboundShipments(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const shipments = await pb.collection('outboundShipments').getFullList()
    res.status(200).json(shipments)
  } catch (err: unknown) {
    console.error('[Shipments] GET outbound failed:', err)
    res.status(500).json({ error: 'Failed to fetch outbound shipments' })
  }
}

/**
 * POST /api/shipments/outbound
 * Create a new outbound shipment.
 */
export async function createOutboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const data = req.body
    const shipment = await pb.collection('outboundShipments').create(data)
    res.status(201).json(shipment)
  } catch (err: unknown) {
    console.error('[Shipments] POST outbound failed:', err)
    res.status(400).json({ error: 'Failed to create outbound shipment' })
  }
}

/**
 * PATCH /api/shipments/outbound/:id
 * Update an outbound shipment.
 */
export async function updateOutboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    const data = req.body
    const shipment = await pb.collection('outboundShipments').update(id, data)
    res.status(200).json(shipment)
  } catch (err: unknown) {
    console.error('[Shipments] PATCH outbound failed:', err)
    res.status(400).json({ error: 'Failed to update outbound shipment' })
  }
}

/**
 * DELETE /api/shipments/outbound/:id
 * Delete an outbound shipment.
 */
export async function deleteOutboundShipment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { id } = req.params
    await pb.collection('outboundShipments').delete(id)
    res.status(204).send()
  } catch (err: unknown) {
    console.error('[Shipments] DELETE outbound failed:', err)
    res.status(400).json({ error: 'Failed to delete outbound shipment' })
  }
}
