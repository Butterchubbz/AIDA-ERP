import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { EUReturnItem, ReturnStatus } from '@aida/shared'
import LabelPrinter from '../components/common/LabelPrinter'
import ModalShell from '../components/common/ModalShell'
import StatusBadge from '../components/common/StatusBadge'
import TableShell from '../components/common/TableShell'
import { useAuth } from '../context/AuthContext'
import { useCollectionCrud } from '../hooks/useCollectionCrud'
import { formatISODate } from '../utils/date'

type ReturnRecord = EUReturnItem & { id?: string; created?: string }

type ReturnFormState = {
  rmaNumber: string
  sku: string
  serialNumber: string
  returnReason: string
  condition: 'unopened' | 'opened_functional' | 'refurbishable' | 'scrap'
  status: 'pending_receipt' | 'received' | 'under_test' | 'refurbished' | 'scrapped'
}

const defaultFormState: ReturnFormState = {
  rmaNumber: '',
  sku: '',
  serialNumber: '',
  returnReason: 'damaged',
  condition: 'opened_functional',
  status: 'pending_receipt',
}

const returnReasonOptions = ['damaged', 'defective', 'not_as_described', 'wrong_item', 'customer_return']

function sortReturns(left: ReturnRecord, right: ReturnRecord): number {
  const leftSku = String(left.sku ?? '').trim().toLowerCase()
  const rightSku = String(right.sku ?? '').trim().toLowerCase()

  if (leftSku !== rightSku) return leftSku.localeCompare(rightSku)

  const leftRaw = String(left.sku ?? '').trim()
  const rightRaw = String(right.sku ?? '').trim()
  if (leftRaw !== rightRaw) return leftRaw.localeCompare(rightRaw)

  const leftCreated = String(left.created ?? '').trim()
  const rightCreated = String(right.created ?? '').trim()
  if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated)

  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
}

function getStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'pending_receipt':
      return 'warning'
    case 'received':
      return 'info'
    case 'under_test':
      return 'neutral'
    case 'refurbished':
      return 'success'
    case 'scrapped':
      return 'danger'
    default:
      return 'neutral'
  }
}

export default function EUReturnsView() {
  const { userRoles } = useAuth()
  const canView = userRoles?.['RMA Tracker'] !== 'None'
  const canEdit = userRoles?.['RMA Tracker'] === 'Editor'

  const { items, loading, error, createItem, updateItem } = useCollectionCrud<ReturnRecord>({
    collection: 'returns',
    fetchErrorMessage: 'Failed to load EU returns.',
    addErrorMessage: 'Failed to create EU return record.',
    updateErrorMessage: 'Failed to update EU return record.',
    mapRecords: records => [...records].sort(sortReturns),
  })

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<ReturnFormState>(defaultFormState)

  const sortedRecords = useMemo(() => items, [items])

  const onFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target
    setDraft(prev => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.rmaNumber.trim() || !draft.sku.trim()) {
      return
    }

    await createItem({
      ...draft,
      sku: draft.sku.trim().toUpperCase(),
      rmaNumber: draft.rmaNumber.trim(),
      serialNumber: draft.serialNumber.trim(),
      returnReason: draft.returnReason,
      condition: draft.condition,
      status: draft.status,
      processedBy: 'ui',
      receivedAt: new Date().toISOString(),
      historyLogs: [
        {
          timestamp: new Date().toISOString(),
          status: draft.status,
          changedBy: 'system',
          notes: 'Created from the AIDA EU returns log.',
        },
      ],
    })

    setDraft(defaultFormState)
    setCreateOpen(false)
  }

  const handleStatusChange = async (recordId: string, nextStatus: ReturnStatus) => {
    if (!recordId || !canEdit) return

    const record = sortedRecords.find(item => item.id === recordId)
    const previousStatus = record?.status ?? 'pending_receipt'

    await updateItem(recordId, {
      status: nextStatus,
      historyLogs: [
        ...(Array.isArray(record?.historyLogs) ? record.historyLogs : []),
        {
          timestamp: new Date().toISOString(),
          status: nextStatus,
          changedBy: 'ui',
          notes: `Status updated from ${previousStatus} to ${nextStatus}.`,
        },
      ],
    })
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-6 text-amber-100">
        You do not have access to the EU returns log.
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 text-slate-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Logistics</p>
          <h1 className="text-2xl font-bold text-white">EU Returns Log</h1>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            Log return
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
            <th className="px-4 py-3">RMA Number</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Serial Number</th>
            <th className="px-4 py-3">Return Reason</th>
            <th className="px-4 py-3">Condition</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Processed By</th>
            <th className="px-4 py-3">Received Date</th>
            <th className="px-4 py-3 text-right">Print</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                Loading returns…
              </td>
            </tr>
          )}

          {!loading && sortedRecords.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                No return records found.
              </td>
            </tr>
          )}

          {!loading && sortedRecords.map(record => (
            <tr key={record.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 font-medium text-cyan-200">{record.rmaNumber}</td>
              <td className="px-4 py-3">{record.sku}</td>
              <td className="px-4 py-3">{record.serialNumber || '—'}</td>
              <td className="px-4 py-3">{record.returnReason || '—'}</td>
              <td className="px-4 py-3 capitalize">{record.condition || 'opened_functional'}</td>
              <td className="px-4 py-3">
                {canEdit ? (
                  <select
                    value={record.status || 'pending_receipt'}
                    onChange={event => void handleStatusChange(String(record.id), event.target.value as ReturnStatus)}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none ring-0"
                  >
                    <option value="pending_receipt">pending_receipt</option>
                    <option value="received">received</option>
                    <option value="under_test">under_test</option>
                    <option value="refurbished">refurbished</option>
                    <option value="scrapped">scrapped</option>
                  </select>
                ) : (
                  <StatusBadge text={record.status || 'pending_receipt'} tone={getStatusTone(record.status || 'pending_receipt')} />
                )}
              </td>
              <td className="px-4 py-3">{record.processedBy || 'system'}</td>
              <td className="px-4 py-3">{record.receivedAt ? formatISODate(record.receivedAt) : '—'}</td>
              <td className="px-4 py-3 text-right">
                <LabelPrinter
                  labelData={{
                    sku: record.sku || 'N/A',
                    name: record.returnReason || 'EU Return',
                    description: record.condition || 'return item',
                    location: 'RMA intake',
                    workspace: 'EU Returns',
                    serialNumber: record.serialNumber,
                  }}
                  labelSize="50x100mm"
                  buttonLabel="Print Label"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {isCreateOpen && (
        <ModalShell onClose={() => setCreateOpen(false)} panelClassName="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Create return</h2>
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
                <span>RMA Number</span>
                <input
                  name="rmaNumber"
                  value={draft.rmaNumber}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                  placeholder="RMA-1042"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>SKU</span>
                <input
                  name="sku"
                  value={draft.sku}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                  placeholder="SKU-123"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
                <span>Serial Number</span>
                <input
                  name="serialNumber"
                  value={draft.serialNumber}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                  placeholder="SN123456"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Return Reason</span>
                <select
                  name="returnReason"
                  value={draft.returnReason}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                >
                  {returnReasonOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Condition</span>
                <select
                  name="condition"
                  value={draft.condition}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                >
                  <option value="unopened">unopened</option>
                  <option value="opened_functional">opened_functional</option>
                  <option value="refurbishable">refurbishable</option>
                  <option value="scrap">scrap</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Status</span>
                <select
                  name="status"
                  value={draft.status}
                  onChange={onFieldChange}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0"
                >
                  <option value="pending_receipt">pending_receipt</option>
                  <option value="received">received</option>
                  <option value="under_test">under_test</option>
                  <option value="refurbished">refurbished</option>
                  <option value="scrapped">scrapped</option>
                </select>
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
                Save return
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  )
}
