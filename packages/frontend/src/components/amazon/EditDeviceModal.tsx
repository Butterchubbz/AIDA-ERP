import { useEffect, useState } from 'react'
import ModalShell from '../common/ModalShell'
import type { AmazonDeviceFull, AmazonVariantFull } from '../../hooks/useAmazonDevices'

interface StockDraft {
  newStock: string
  reason: string
  saving: boolean
  error: string | null
}

interface VariantDraft {
  label: string
  sku: string
  asin: string
  packSize: string
  lowStockThreshold: string
  saving: boolean
  error: string | null
}

interface EditDeviceModalProps {
  device: AmazonDeviceFull | null
  onClose: () => void
  onUpdateDevice: (id: string, body: { name?: string; inventorySku?: string }) => Promise<void>
  onDeleteDevice: (id: string) => Promise<void>
  onAddVariant: (
    deviceId: string,
    body: { label: string; sku: string; asin?: string; packSize?: number; lowStockThreshold?: number }
  ) => Promise<void>
  onUpdateVariant: (
    variantId: string,
    body: { label?: string; sku?: string; asin?: string; packSize?: number; lowStockThreshold?: number }
  ) => Promise<void>
  onDeleteVariant: (variantId: string) => Promise<void>
  onAdjustStock: (variantId: string, fbaStock: number, reason?: string) => Promise<void>
}

export default function EditDeviceModal({
  device,
  onClose,
  onUpdateDevice,
  onDeleteDevice,
  onAddVariant,
  onUpdateVariant,
  onDeleteVariant,
  onAdjustStock,
}: EditDeviceModalProps) {
  const [deviceName, setDeviceName] = useState('')
  const [deviceSku, setDeviceSku] = useState('')
  const [savingDevice, setSavingDevice] = useState(false)
  const [deviceError, setDeviceError] = useState<string | null>(null)

  const [stockDrafts, setStockDrafts] = useState<Record<string, StockDraft>>({})
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>({})
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null)

  const [showAddVariant, setShowAddVariant] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newSku, setNewSku] = useState('')
  const [newAsin, setNewAsin] = useState('')
  const [newPackSize, setNewPackSize] = useState('1')
  const [newThreshold, setNewThreshold] = useState('10')
  const [addingVariant, setAddingVariant] = useState(false)
  const [addVariantError, setAddVariantError] = useState<string | null>(null)

  const [confirmDeleteDevice, setConfirmDeleteDevice] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState(false)

  useEffect(() => {
    if (!device) return
    setDeviceName(device.name)
    setDeviceSku(device.inventorySku)
    setDeviceError(null)
    setConfirmDeleteDevice(false)

    // Initialize drafts for all variants
    const sd: Record<string, StockDraft> = {}
    const vd: Record<string, VariantDraft> = {}
    for (const v of device.variants) {
      sd[v.id] = { newStock: String(v.fbaStock), reason: '', saving: false, error: null }
      vd[v.id] = {
        label: v.label,
        sku: v.sku,
        asin: v.asin ?? '',
        packSize: String(v.packSize),
        lowStockThreshold: String(v.lowStockThreshold ?? 10),
        saving: false,
        error: null,
      }
    }
    setStockDrafts(sd)
    setVariantDrafts(vd)
    setShowAddVariant(false)
    setNewLabel('')
    setNewSku('')
    setNewAsin('')
    setNewPackSize('1')
    setNewThreshold('10')
    setAddVariantError(null)
    setDeletingVariantId(null)
  }, [device])

  if (!device) return null

  // ── Device info save ──────────────────────────────────────────────────────
  const handleSaveDevice = async () => {
    setSavingDevice(true)
    setDeviceError(null)
    try {
      await onUpdateDevice(device.id, { name: deviceName.trim(), inventorySku: deviceSku.trim() })
    } catch (err: unknown) {
      setDeviceError(err instanceof Error ? err.message : 'Failed to save device')
    } finally {
      setSavingDevice(false)
    }
  }

  // ── Stock adjustment ──────────────────────────────────────────────────────
  const patchStock = (id: string, patch: Partial<StockDraft>) =>
    setStockDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const handleAdjustStock = async (variant: AmazonVariantFull) => {
    const draft = stockDrafts[variant.id]
    if (!draft) return
    const parsed = parseInt(draft.newStock, 10)
    if (isNaN(parsed) || parsed < 0) {
      patchStock(variant.id, { error: 'Enter a valid non-negative number' })
      return
    }
    patchStock(variant.id, { saving: true, error: null })
    try {
      await onAdjustStock(variant.id, parsed, draft.reason.trim() || undefined)
      patchStock(variant.id, { saving: false, reason: '' })
    } catch (err: unknown) {
      patchStock(variant.id, { saving: false, error: err instanceof Error ? err.message : 'Failed' })
    }
  }

  // ── Variant metadata save ─────────────────────────────────────────────────
  const patchVariant = (id: string, patch: Partial<VariantDraft>) =>
    setVariantDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const handleSaveVariant = async (variantId: string) => {
    const draft = variantDrafts[variantId]
    if (!draft) return
    patchVariant(variantId, { saving: true, error: null })
    try {
      await onUpdateVariant(variantId, {
        label: draft.label.trim(),
        sku: draft.sku.trim(),
        asin: draft.asin.trim() || undefined,
        packSize: parseInt(draft.packSize, 10) || 1,
        lowStockThreshold: parseInt(draft.lowStockThreshold, 10) || 10,
      })
      patchVariant(variantId, { saving: false })
    } catch (err: unknown) {
      patchVariant(variantId, { saving: false, error: err instanceof Error ? err.message : 'Failed' })
    }
  }

  // ── Delete variant ────────────────────────────────────────────────────────
  const handleDeleteVariant = async (variantId: string) => {
    setDeletingVariantId(variantId)
    try {
      await onDeleteVariant(variantId)
    } finally {
      setDeletingVariantId(null)
    }
  }

  // ── Add variant ───────────────────────────────────────────────────────────
  const handleAddVariant = async () => {
    if (!newLabel.trim() || !newSku.trim()) return
    setAddingVariant(true)
    setAddVariantError(null)
    try {
      await onAddVariant(device.id, {
        label: newLabel.trim(),
        sku: newSku.trim(),
        asin: newAsin.trim() || undefined,
        packSize: parseInt(newPackSize, 10) || 1,
        lowStockThreshold: parseInt(newThreshold, 10) || 10,
      })
      setShowAddVariant(false)
      setNewLabel('')
      setNewSku('')
      setNewAsin('')
      setNewPackSize('1')
      setNewThreshold('10')
    } catch (err: unknown) {
      setAddVariantError(err instanceof Error ? err.message : 'Failed to add variant')
    } finally {
      setAddingVariant(false)
    }
  }

  // ── Delete device ─────────────────────────────────────────────────────────
  const handleDeleteDevice = async () => {
    setDeletingDevice(true)
    try {
      await onDeleteDevice(device.id)
      onClose()
    } finally {
      setDeletingDevice(false)
    }
  }

  return (
    <ModalShell panelClassName="w-full max-w-2xl rounded-xl border border-slate-600 bg-slate-800 p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto" onClose={onClose}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-cyan-400">Edit Device</h2>
          <p className="font-mono text-xs text-slate-400 mt-0.5">{device.inventorySku}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 mt-0.5">
          <i className="fas fa-xmark text-lg" />
        </button>
      </div>

      {/* ── Section: Adjust Stock ── */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Adjust Stock
        </h3>
        {device.variants.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No variants — add one below.</p>
        ) : (
          <div className="space-y-3">
            {device.variants.map((v) => {
              const draft = stockDrafts[v.id] ?? { newStock: String(v.fbaStock), reason: '', saving: false, error: null }
              const changed = parseInt(draft.newStock, 10) !== v.fbaStock
              return (
                <div key={v.id} className="rounded-lg border border-slate-700 bg-slate-700/30 p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-sm font-semibold text-slate-200">{v.label}</p>
                    <p className="font-mono text-xs text-slate-400">{v.sku}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Current</label>
                      <div className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-semibold text-cyan-300">
                        {v.fbaStock}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">New Stock</label>
                      <input
                        type="number"
                        min={0}
                        value={draft.newStock}
                        onChange={(e) => patchStock(v.id, { newStock: e.target.value })}
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Reason</label>
                      <input
                        type="text"
                        value={draft.reason}
                        onChange={(e) => patchStock(v.id, { reason: e.target.value })}
                        placeholder="optional"
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {draft.error && (
                    <p className="mt-1 text-xs text-red-400">{draft.error}</p>
                  )}
                  <button
                    type="button"
                    disabled={!changed || draft.saving}
                    onClick={() => void handleAdjustStock(v)}
                    className="mt-2 rounded bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {draft.saving ? 'Saving…' : 'Save Adjustment'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Section: Variant Settings ── */}
      <section className="mb-6 border-t border-slate-700 pt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Variant Settings
        </h3>
        <div className="space-y-3">
          {device.variants.map((v) => {
            const draft = variantDrafts[v.id]
            if (!draft) return null
            return (
              <div key={v.id} className="rounded-lg border border-slate-700 bg-slate-700/30 p-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Label</label>
                    <input
                      type="text"
                      value={draft.label}
                      onChange={(e) => patchVariant(v.id, { label: e.target.value })}
                      className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">SKU</label>
                    <input
                      type="text"
                      value={draft.sku}
                      onChange={(e) => patchVariant(v.id, { sku: e.target.value })}
                      className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">ASIN</label>
                    <input
                      type="text"
                      value={draft.asin}
                      onChange={(e) => patchVariant(v.id, { asin: e.target.value })}
                      placeholder="B0XXXXXXX"
                      className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pack Size</label>
                    <input
                      type="number"
                      min={1}
                      value={draft.packSize}
                      onChange={(e) => patchVariant(v.id, { packSize: e.target.value })}
                      className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Low Stock Threshold</label>
                    <input
                      type="number"
                      min={1}
                      value={draft.lowStockThreshold}
                      onChange={(e) => patchVariant(v.id, { lowStockThreshold: e.target.value })}
                      className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
                {draft.error && <p className="text-xs text-red-400 mb-1">{draft.error}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={draft.saving}
                    onClick={() => void handleSaveVariant(v.id)}
                    className="rounded bg-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-500 disabled:opacity-40 transition-colors"
                  >
                    {draft.saving ? 'Saving…' : 'Save'}
                  </button>
                  {deletingVariantId === v.id ? (
                    <span className="text-xs text-slate-400">Deleting…</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleDeleteVariant(v.id)}
                      className="rounded border border-red-700/40 px-3 py-1 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                      Delete Variant
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Add variant */}
        {showAddVariant ? (
          <div className="mt-3 rounded-lg border border-slate-600 bg-slate-700/40 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">New Variant</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Label *</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="FBA Base"
                  className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">SKU *</label>
                <input
                  type="text"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="SKU-001-BASE"
                  className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ASIN</label>
                <input
                  type="text"
                  value={newAsin}
                  onChange={(e) => setNewAsin(e.target.value)}
                  placeholder="B0XXXXXXX"
                  className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Pack Size</label>
                <input
                  type="number"
                  min={1}
                  value={newPackSize}
                  onChange={(e) => setNewPackSize(e.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Low Stock Threshold</label>
                <input
                  type="number"
                  min={1}
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            {addVariantError && <p className="text-xs text-red-400 mb-2">{addVariantError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={addingVariant || !newLabel.trim() || !newSku.trim()}
                onClick={() => void handleAddVariant()}
                className="rounded bg-cyan-700 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40 transition-colors"
              >
                {addingVariant ? 'Adding…' : 'Add Variant'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddVariant(false)}
                className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddVariant(true)}
            className="mt-3 flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
          >
            <i className="fas fa-plus text-xs" /> Add Variant
          </button>
        )}
      </section>

      {/* ── Section: Device Info ── */}
      <section className="mb-6 border-t border-slate-700 pt-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Device Info
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Parent SKU</label>
            <input
              type="text"
              value={deviceSku}
              onChange={(e) => setDeviceSku(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        {deviceError && <p className="text-xs text-red-400 mb-2">{deviceError}</p>}
        <button
          type="button"
          disabled={savingDevice}
          onClick={() => void handleSaveDevice()}
          className="rounded bg-slate-600 px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-500 disabled:opacity-40 transition-colors"
        >
          {savingDevice ? 'Saving…' : 'Save Device Info'}
        </button>
      </section>

      {/* ── Danger Zone ── */}
      <section className="border-t border-red-900/40 pt-5 mb-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-400">
          Danger Zone
        </h3>
        {confirmDeleteDevice ? (
          <div className="rounded-lg border border-red-700/40 bg-red-900/10 p-4">
            <p className="text-sm text-red-300 mb-3">
              Delete <span className="font-semibold">{device.name}</span> and all{' '}
              {device.variants.length} variant{device.variants.length !== 1 ? 's' : ''}? This
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deletingDevice}
                onClick={() => void handleDeleteDevice()}
                className="rounded bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingDevice ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteDevice(false)}
                className="rounded border border-slate-600 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDeleteDevice(true)}
            className="flex items-center gap-2 rounded border border-red-700/40 px-4 py-1.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <i className="fas fa-trash text-xs" /> Delete Device
          </button>
        )}
      </section>
      {/* ── Sticky close ── */}
      <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-slate-700 bg-slate-800 px-6 py-3 mt-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-slate-600 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Close
        </button>
      </div>
    </ModalShell>
  )
}
