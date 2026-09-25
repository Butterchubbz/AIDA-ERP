import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAmazonDevices } from '../hooks/useAmazonDevices'
import DeviceCard from '../components/amazon/DeviceCard'
import AddDeviceModal from '../components/amazon/AddDeviceModal'
import EditDeviceModal from '../components/amazon/EditDeviceModal'
import StockHistoryModal from '../components/amazon/StockHistoryModal'
import type { AmazonDeviceFull } from '../hooks/useAmazonDevices'

const LEGACY_STORAGE_KEY = 'aida_amazon_listings'

export default function AmazonView() {
  const { userRoles } = useAuth()
  const isEditor = userRoles?.['Amazon'] === 'Editor'

  const {
    devices,
    loading,
    error,
    refetch,
    addDevice,
    updateDevice,
    deleteDevice,
    addVariant,
    updateVariant,
    deleteVariant,
    adjustStock,
    getDeviceHistory,
  } = useAmazonDevices()

  const [showAddDevice, setShowAddDevice] = useState(false)
  const [editDevice, setEditDevice] = useState<AmazonDeviceFull | null>(null)
  const [historyDevice, setHistoryDevice] = useState<AmazonDeviceFull | null>(null)
  const [legacyDismissed, setLegacyDismissed] = useState(false)

  const hasLegacyData =
    !legacyDismissed && typeof window !== 'undefined' && Boolean(localStorage.getItem(LEGACY_STORAGE_KEY))

  const handleClearLegacy = () => {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    setLegacyDismissed(true)
  }

  const totalFbaStock = devices.reduce(
    (sum, d) => sum + d.variants.reduce((s, v) => s + v.fbaStock, 0),
    0
  )
  const totalInbound = devices.reduce(
    (sum, d) => sum + d.variants.reduce((s, v) => s + v.inboundQty, 0),
    0
  )
  const lowStockCount = devices.reduce(
    (sum, d) =>
      sum +
      d.variants.filter((v) => v.fbaStock < (v.lowStockThreshold ?? 10)).length,
    0
  )

  if (error && !loading && devices.length === 0) {
    return (
      <section className="rounded-xl border border-red-800 bg-slate-800 p-6 text-slate-100">
        <h2 className="text-2xl font-semibold text-red-300">Amazon Overview Unavailable</h2>
        <p className="mt-2 text-sm text-slate-300">{error}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-6 text-slate-100">
      {/* Header */}
      <header className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-300">FBA Stock Levels</h1>
            <p className="mt-1 text-sm text-slate-400">
              Manually track Amazon FBA inventory across all devices and pack sizes.
            </p>
          </div>
          {isEditor && (
            <button
              type="button"
              onClick={() => setShowAddDevice(true)}
              className="flex shrink-0 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              <i className="fas fa-plus" />
              Add Device
            </button>
          )}
        </div>

        {/* Summary stats */}
        {(devices.length > 0 || !loading) && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-center">
              <p className="text-xl font-bold text-cyan-400">{totalFbaStock}</p>
              <p className="text-xs text-slate-400 mt-0.5">Total FBA Stock</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-center">
              <p className="text-xl font-bold text-yellow-400">{totalInbound > 0 ? `+${totalInbound}` : '0'}</p>
              <p className="text-xs text-slate-400 mt-0.5">Inbound</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 text-center">
              <p className={`text-xl font-bold ${lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {lowStockCount}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Low Stock SKUs</p>
            </div>
          </div>
        )}
      </header>

      {/* Legacy data banner */}
      {hasLegacyData && (
        <div className="rounded-xl border border-amber-600 bg-amber-950/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <i className="fas fa-triangle-exclamation text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-200">Legacy Amazon data detected</p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  Old listing data exists in browser storage from the previous Amazon view. It is no
                  longer used. Add your devices above, then clear the old data.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearLegacy}
              className="shrink-0 rounded border border-amber-600 px-3 py-1 text-xs text-amber-300 hover:bg-amber-700/30"
            >
              Clear old data
            </button>
          </div>
        </div>
      )}

      {/* Device grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-64 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 py-16 text-center">
          <i className="fas fa-box-open text-4xl text-slate-600 mb-4 block" />
          <p className="text-lg text-slate-400">No devices configured.</p>
          {isEditor && (
            <p className="mt-1 text-sm text-slate-500">
              Click "Add Device" to start tracking FBA stock.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              isEditor={isEditor}
              onEdit={() => setEditDevice(device)}
              onHistory={() => setHistoryDevice(device)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddDevice && (
        <AddDeviceModal
          isOpen={showAddDevice}
          onClose={() => setShowAddDevice(false)}
          onAdd={(name, inventorySku) => addDevice({ name, inventorySku })}
        />
      )}

      <EditDeviceModal
        device={editDevice}
        onClose={() => setEditDevice(null)}
        onUpdateDevice={updateDevice}
        onDeleteDevice={deleteDevice}
        onAddVariant={addVariant}
        onUpdateVariant={updateVariant}
        onDeleteVariant={deleteVariant}
        onAdjustStock={adjustStock}
      />

      <StockHistoryModal
        deviceName={historyDevice?.name ?? ''}
        deviceId={historyDevice?.id ?? null}
        onClose={() => setHistoryDevice(null)}
        fetchHistory={getDeviceHistory}
      />
    </section>
  )
}
