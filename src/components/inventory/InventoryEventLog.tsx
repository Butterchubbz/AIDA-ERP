import { useState, useEffect } from 'react'
import { pb } from '../../lib/pocketbase'
import { COLLECTIONS } from '../../lib/collections'
import type { HistoryRecord } from '../../types/history'

interface Props {
  itemId: string
  itemName: string
  onClose: () => void
}

/**
 * Modal showing stock change history for an inventory item.
 * Fetches from stockHistory collection filtered by itemId.
 */
export default function InventoryEventLog({
  itemId, itemName, onClose
}: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    pb.collection(COLLECTIONS.STOCK_HISTORY)
      .getFullList({
        filter: `inventoryItemId = "${itemId}"`,
        sort: '-created',
      })
      .then(r => {
        if (!cancelled) {
          setRecords(r as unknown as HistoryRecord[])
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [itemId])

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 
      flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 
        w-full max-w-screen-lg my-8 text-slate-100">
        <h3 className="text-lg font-bold mb-4 text-cyan-400">
          Stock History - "{itemName}"
        </h3>
        {loading ? (
          <p className="text-center py-4 text-slate-400">
            Loading history...
          </p>
        ) : records.length === 0 ? (
          <p className="text-center py-4 text-slate-400">
            No history recorded yet for this item.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  {['Date', 'Field', 'Old', 'New', 'Change',
                    'Operation'].map(h => (
                    <th key={h} className="px-4 py-3 text-left 
                      text-xs font-medium text-slate-400 
                      uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {r.created
                        ? new Date(r.created).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {r.field}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {r.oldValue}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {r.newValue}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold
                      ${r.change < 0
                        ? 'text-red-400' : 'text-emerald-400'}`}>
                      {r.change > 0 ? '+' : ''}{r.change}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {r.operation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-600 
              text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
