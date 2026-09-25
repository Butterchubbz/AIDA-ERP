import { useEffect, useState } from 'react'
import ModalShell from '../common/ModalShell'
import type { EnrichedHistoryEntry } from '../../hooks/useAmazonDevices'

interface StockHistoryModalProps {
  deviceName: string
  deviceId: string | null
  onClose: () => void
  fetchHistory: (deviceId: string) => Promise<EnrichedHistoryEntry[]>
}

export default function StockHistoryModal({
  deviceName,
  deviceId,
  onClose,
  fetchHistory,
}: StockHistoryModalProps) {
  const [entries, setEntries] = useState<EnrichedHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!deviceId) return
    setLoading(true)
    setError(null)
    fetchHistory(deviceId)
      .then(setEntries)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load history')
      })
      .finally(() => setLoading(false))
  }, [deviceId, fetchHistory])

  if (!deviceId) return null

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <ModalShell panelClassName="w-full max-w-3xl rounded-xl border border-slate-600 bg-slate-800 p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto" onClose={onClose}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-cyan-400">Stock History</h2>
          <p className="text-sm text-slate-400 mt-0.5">{deviceName}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 mt-0.5">
          <i className="fas fa-xmark text-lg" />
        </button>
      </div>

      {loading && (
        <p className="py-8 text-center text-sm text-slate-400">Loading history…</p>
      )}

      {error && (
        <p className="py-8 text-center text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No stock adjustments recorded yet.
        </p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wide">
                <th className="pb-2 text-left font-medium">Date</th>
                <th className="pb-2 text-left font-medium">Variant</th>
                <th className="pb-2 text-right font-medium">Old</th>
                <th className="pb-2 text-right font-medium">New</th>
                <th className="pb-2 text-right font-medium">Change</th>
                <th className="pb-2 text-left font-medium pl-4">Reason</th>
                <th className="pb-2 text-left font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {entries.map((entry) => {
                const change = entry.newValue - entry.oldValue
                return (
                  <tr key={entry.id} className="text-xs hover:bg-slate-700/30">
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
                      {formatDate(entry.timestamp)}
                    </td>
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-slate-200">{entry.variantLabel}</p>
                      <p className="font-mono text-slate-400">{entry.variantSku}</p>
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-400">{entry.oldValue}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-slate-200">
                      {entry.newValue}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">
                      <span
                        className={
                          change > 0
                            ? 'text-emerald-400'
                            : change < 0
                              ? 'text-red-400'
                              : 'text-slate-500'
                        }
                      >
                        {change > 0 ? `+${change}` : change}
                      </span>
                    </td>
                    <td className="py-2 pl-4 pr-3 text-slate-300 max-w-[160px] truncate">
                      {entry.reason ?? <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="py-2 text-slate-400 max-w-[140px] truncate">
                      {entry.changedBy ?? <span className="text-slate-600 italic">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  )
}
