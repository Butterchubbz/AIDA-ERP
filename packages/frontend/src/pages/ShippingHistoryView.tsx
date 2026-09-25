import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { ShippingCarrier, ShippingRecord, ShippingStatus } from '@aida/shared'
import ModalShell from '../components/common/ModalShell'
import StatusBadge from '../components/common/StatusBadge'
import TableShell from '../components/common/TableShell'
import { useAuth } from '../context/AuthContext'
import { useCollectionCrud } from '../hooks/useCollectionCrud'
import { formatISODate } from '../utils/date'

type ShippingRow = ShippingRecord & { id?: string; created?: string; updated?: string }

type ShippingFormState = {
  trackingNumber: string
  carrier: string
  destination: string
  shipDate: string
  status: 'label_created' | 'in_transit' | 'delivered' | 'exception'
  packageWeight: string
  postageCost: string
  itemsShipped: string
}

const defaultFormState: ShippingFormState = {
  trackingNumber: '',
  carrier: 'DHL',
  destination: '',
  shipDate: new Date().toISOString().slice(0, 10),
  status: 'label_created',
  packageWeight: '0',
  postageCost: '0',
  itemsShipped: 'SKU-1:2, SKU-2:1',
}

function sortShipping(left: ShippingRow, right: ShippingRow): number {
  const leftSku = String(left.itemsShipped?.[0]?.sku ?? '').trim().toLowerCase()
  const rightSku = String(right.itemsShipped?.[0]?.sku ?? '').trim().toLowerCase()

  if (leftSku !== rightSku) return leftSku.localeCompare(rightSku)

  const leftRaw = String(left.itemsShipped?.[0]?.sku ?? '').trim()
  const rightRaw = String(right.itemsShipped?.[0]?.sku ?? '').trim()
  if (leftRaw !== rightRaw) return leftRaw.localeCompare(rightRaw)

  const leftCreated = String(left.created ?? '').trim()
  const rightCreated = String(right.created ?? '').trim()
  if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated)

  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
}

function getStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'label_created':
      return 'info'
    case 'in_transit':
      return 'warning'
    case 'delivered':
      return 'success'
    case 'exception':
      return 'danger'
    default:
      return 'neutral'
  }
}

function parseItemsShipped(raw: string) {
  if (!raw.trim()) return []

  return raw
    .split(/[|,\n]/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [sku, qty] = part.split(':')
      return {
        sku: (sku ?? '').trim().toUpperCase(),
        qty: Number.parseInt(qty ?? '1', 10) || 1,
      }
    })
    .filter(item => item.sku)
}

export default function ShippingHistoryView() {
  const { userRoles } = useAuth()
  const canView = userRoles?.['Inbound Shipments'] !== 'None'
  const canEdit = userRoles?.['Inbound Shipments'] === 'Editor'

  const { items, loading, error, createItem, updateItem } = useCollectionCrud<ShippingRow>({
    collection: 'shipping',
    fetchErrorMessage: 'Failed to load shipping history.',
    addErrorMessage: 'Failed to create shipping record.',
    updateErrorMessage: 'Failed to update shipping record.',
    mapRecords: records => [...records].sort(sortShipping),
  })

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<ShippingFormState>(defaultFormState)

  const sortedRecords = useMemo(() => items, [items])

  const onFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setDraft(prev => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.trackingNumber.trim() || !draft.carrier.trim() || !draft.destination.trim()) {
      return
    }

    await createItem({
      trackingNumber: draft.trackingNumber.trim(),
      carrier: draft.carrier as ShippingCarrier,
      destination: draft.destination.trim(),
      shipDate: draft.shipDate || new Date().toISOString(),
      status: draft.status as ShippingStatus,
      packageWeight: Number.parseFloat(draft.packageWeight) || 0,
      postageCost: Number.parseFloat(draft.postageCost) || 0,
      itemsShipped: parseItemsShipped(draft.itemsShipped),
    })

    setDraft(defaultFormState)
    setCreateOpen(false)
  }

  const handleStatusChange = async (recordId: string, nextStatus: ShippingStatus) => {
    if (!recordId || !canEdit) return
    await updateItem(recordId, { status: nextStatus })
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-6 text-amber-100">
        You do not have access to the shipping history log.
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 text-slate-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Logistics</p>
          <h1 className="text-2xl font-bold text-white">Shipping History</h1>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Log shipment
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/50 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <TableShell wrapperClassName="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
        <thead className="bg-slate-800/80 text-left text-xs uppercase tracking-[0.15em] text-slate-300">
          <tr>
            <th className="px-4 py-3">Tracking Number</th>
            <th className="px-4 py-3">Carrier</th>
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3">Ship Date</th>
            <th className="px-4 py-3">Weight (kg)</th>
            <th className="px-4 py-3">Postage Cost</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Shipped Items</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                Loading shipments…
              </td>
            </tr>
          )}

          {!loading && sortedRecords.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                No shipping records found.
              </td>
            </tr>
          )}

          {!loading && sortedRecords.map(record => (
            <tr key={record.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 font-medium text-cyan-200">{record.trackingNumber}</td>
              <td className="px-4 py-3">{record.carrier}</td>
              <td className="px-4 py-3">{record.destination}</td>
              <td className="px-4 py-3">{record.shipDate ? formatISODate(record.shipDate) : '—'}</td>
              <td className="px-4 py-3">{record.packageWeight ?? 0}</td>
              <td className="px-4 py-3">{record.postageCost ?? 0}</td>
              <td className="px-4 py-3">
                {canEdit ? (
                  <select
                    value={record.status || 'label_created'}
                    onChange={event => void handleStatusChange(String(record.id), event.target.value as ShippingStatus)}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none ring-0"
                  >
                    <option value="label_created">label_created</option>
                    <option value="in_transit">in_transit</option>
                    <option value="delivered">delivered</option>
                    <option value="exception">exception</option>
                  </select>
                ) : (
                  <StatusBadge text={record.status || 'label_created'} tone={getStatusTone(record.status || 'label_created')} />
                )}
              </td>
              <td className="px-4 py-3">
                {Array.isArray(record.itemsShipped) && record.itemsShipped.length > 0
                  ? record.itemsShipped.map(item => `${item.sku ?? 'ITEM'}:${item.qty ?? 1}`).join(', ')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {isCreateOpen && (
        <ModalShell onClose={() => setCreateOpen(false)} panelClassName="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Log shipment</h2>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Tracking Number</span>
                <input
                  name="trackingNumber"
                  value={draft.trackingNumber}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                  placeholder="1Z12345"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Carrier</span>
                <select
                  name="carrier"
                  value={draft.carrier}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                >
                  <option value="DHL">DHL</option>
                  <option value="DPD">DPD</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
                <span>Destination</span>
                <input
                  name="destination"
                  value={draft.destination}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                  placeholder="United States"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Ship Date</span>
                <input
                  type="date"
                  name="shipDate"
                  value={draft.shipDate}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Status</span>
                <select
                  name="status"
                  value={draft.status}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                >
                  <option value="label_created">label_created</option>
                  <option value="in_transit">in_transit</option>
                  <option value="delivered">delivered</option>
                  <option value="exception">exception</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Weight (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  name="packageWeight"
                  value={draft.packageWeight}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Postage Cost</span>
                <input
                  type="number"
                  step="0.01"
                  name="postageCost"
                  value={draft.postageCost}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
                <span>Items Shipped</span>
                <textarea
                  name="itemsShipped"
                  value={draft.itemsShipped}
                  onChange={onFieldChange}
                  rows={3}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                  placeholder="SKU-1:2, SKU-2:1"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                Save shipment
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  )
}
