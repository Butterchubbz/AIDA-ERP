import VariantRow from './VariantRow'
import type { AmazonDeviceFull } from '../../hooks/useAmazonDevices'

interface DeviceCardProps {
  device: AmazonDeviceFull
  isEditor: boolean
  onEdit: () => void
  onHistory: () => void
}

export default function DeviceCard({ device, isEditor, onEdit, onHistory }: DeviceCardProps) {
  const updatedLabel = device.updatedAt
    ? new Date(device.updatedAt).toLocaleDateString(undefined, {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Never'

  return (
    <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg">
      {/* Card header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-cyan-300 leading-tight">{device.name}</h3>
          <p className="font-mono text-xs text-slate-400">{device.inventorySku}</p>
        </div>
        <p className="shrink-0 text-xs text-slate-500 pt-0.5">Updated: {updatedLabel}</p>
      </div>

      {/* Variants */}
      {device.variants.length === 0 ? (
        <p className="flex-1 py-4 text-center text-sm text-slate-500">No variants configured.</p>
      ) : (
        <div className="flex-1 divide-y divide-slate-700/60">
          {device.variants.map((v) => (
            <VariantRow key={v.id} variant={v} />
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-4 flex gap-2 border-t border-slate-700/60 pt-3">
        {isEditor && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            <i className="fas fa-pen-to-square text-xs" />
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={onHistory}
          className="flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
        >
          <i className="fas fa-clock-rotate-left text-xs" />
          History
        </button>
      </div>
    </div>
  )
}
