import { useState } from 'react'
import ModalShell from '../common/ModalShell'

interface AddDeviceModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (name: string, inventorySku: string) => Promise<void>
}

export default function AddDeviceModal({ isOpen, onClose, onAdd }: AddDeviceModalProps) {
  const [name, setName] = useState('')
  const [inventorySku, setInventorySku] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setName('')
    setInventorySku('')
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !inventorySku.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(name.trim(), inventorySku.trim())
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add device')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell panelClassName="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-6 text-slate-100 shadow-2xl" onClose={handleClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-cyan-400">Add Device</h2>
        <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-200">
          <i className="fas fa-xmark text-lg" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Device Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product A"
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Parent SKU <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={inventorySku}
            onChange={(e) => setInventorySku(e.target.value)}
            placeholder="e.g. SKU-001"
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            The base SKU for this device. Variants will have their own child SKUs.
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim() || !inventorySku.trim()}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add Device'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
