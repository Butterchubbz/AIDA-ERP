import { useState } from 'react'
import ModalShell from '../common/ModalShell'
import { apiClient } from '../../lib/apiClient'

type InventoryCollection = 'devices' | 'components' | 'accessories'

interface UnknownSku {
  id: string
  sku: string
  productName: string
  wcStock: number
}

interface AddToInventoryModalProps {
  item: UnknownSku | null
  onClose: () => void
  onAdded: (id: string) => void
}

const COLLECTION_LABELS: Record<InventoryCollection, string> = {
  devices: 'Device',
  components: 'Component',
  accessories: 'Accessory',
}

export default function AddToInventoryModal({ item, onClose, onAdded }: AddToInventoryModalProps) {
  const [collection, setCollection] = useState<InventoryCollection>('devices')
  const [sku, setSku] = useState(item?.sku ?? '')
  const [name, setName] = useState(item?.productName ?? '')
  const [barcode, setBarcode] = useState('')
  const [location, setLocation] = useState('')
  const [warehouseStock, setWarehouseStock] = useState('0')
  const [productionStock, setProductionStock] = useState('0')
  const [reserveStock, setReserveStock] = useState('0')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!item) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sku.trim() || !name.trim()) {
      setError('SKU and Name are required.')
      return
    }

    setSubmitting(true)
    setError(null)

    const base = {
      sku: sku.trim(),
      name: name.trim(),
      onlineStock: item.wcStock,
      barcode: barcode.trim() || undefined,
    }

    const payload =
      collection === 'components'
        ? { ...base, category: category.trim() || undefined, subcategory: subcategory.trim() || undefined }
        : {
            ...base,
            warehouseStock: Number(warehouseStock) || 0,
            productionStock: Number(productionStock) || 0,
            reserveStock: Number(reserveStock) || 0,
            location: location.trim() || undefined,
          }

    try {
      await apiClient.post(`/api/inventory/${collection}`, payload)
      onAdded(item.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell panelClassName="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-800 p-6 text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-cyan-300">Add to Inventory</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Creating a new record from WooCommerce SKU{' '}
            <span className="font-mono text-slate-200">{item.sku}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200"
          aria-label="Close"
        >
          <i className="fas fa-xmark text-lg" />
        </button>
      </div>

      {/* Collection selector */}
      <div className="mt-5 flex gap-2">
        {(Object.keys(COLLECTION_LABELS) as InventoryCollection[]).map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => setCollection(col)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              collection === col
                ? 'border-cyan-500 bg-cyan-600/20 text-cyan-300'
                : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
            }`}
          >
            {COLLECTION_LABELS[col]}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
        {/* Always-visible fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              SKU <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Online Stock
            </label>
            <input
              type="number"
              value={item.wcStock}
              readOnly
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Barcode
          </label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={submitting}
            placeholder="optional"
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Device / Accessory specific */}
        {collection !== 'components' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Warehouse
                </label>
                <input
                  type="number"
                  min="0"
                  value={warehouseStock}
                  onChange={(e) => setWarehouseStock(e.target.value)}
                  disabled={submitting}
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Production
                </label>
                <input
                  type="number"
                  min="0"
                  value={productionStock}
                  onChange={(e) => setProductionStock(e.target.value)}
                  disabled={submitting}
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reserve
                </label>
                <input
                  type="number"
                  min="0"
                  value={reserveStock}
                  onChange={(e) => setReserveStock(e.target.value)}
                  disabled={submitting}
                  className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={submitting}
                placeholder="optional"
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Component specific */}
        {collection === 'components' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
                placeholder="optional"
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Subcategory
              </label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={submitting}
                placeholder="optional"
                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
          >
            {submitting ? 'Adding…' : `Add as ${COLLECTION_LABELS[collection]}`}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
