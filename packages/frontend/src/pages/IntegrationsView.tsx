import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ConnectModal from '../components/integrations/ConnectModal'
import IntegrationCard from '../components/integrations/IntegrationCard'
import AddToInventoryModal from '../components/integrations/AddToInventoryModal'
import { useIntegrations, type RegistryEntry } from '../hooks/useIntegrations'
import { apiClient } from '../lib/apiClient'

interface SyncFeedback {
  tone: 'success' | 'warning' | 'error'
  message: string
  details?: string[]
}

interface UnknownSku {
  id: string
  sku: string
  productName: string
  wcStock: number
  seenAt: string
}

export default function IntegrationsView() {
  const { registry, statuses, loading, error, connect, disconnect, sync, setSchedule, refetch } = useIntegrations()
  const [activeConnect, setActiveConnect] = useState<string | null>(null)
  const [syncingType, setSyncingType] = useState<string | null>(null)
  const [disconnectingType, setDisconnectingType] = useState<string | null>(null)
  const [schedulingType, setSchedulingType] = useState<string | null>(null)
  const [feedbackByType, setFeedbackByType] = useState<Record<string, SyncFeedback>>({})
  const timeoutMapRef = useRef<Record<string, number>>({})

  const [unknownSkuCount, setUnknownSkuCount] = useState(0)
  const [showSkuReview, setShowSkuReview] = useState(false)
  const [unknownSkuItems, setUnknownSkuItems] = useState<UnknownSku[]>([])
  const [skuReviewLoading, setSkuReviewLoading] = useState(false)
  const [addingSkuItem, setAddingSkuItem] = useState<UnknownSku | null>(null)

  const activeAdapter = useMemo<RegistryEntry | null>(() => {
    if (!activeConnect) {
      return null
    }
    return registry.find((item) => item.id === activeConnect) ?? null
  }, [activeConnect, registry])

  const setTimedFeedback = (type: string, feedback: SyncFeedback) => {
    setFeedbackByType((prev) => ({ ...prev, [type]: feedback }))

    const existingTimer = timeoutMapRef.current[type]
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    timeoutMapRef.current[type] = window.setTimeout(() => {
      setFeedbackByType((prev) => {
        const copy = { ...prev }
        delete copy[type]
        return copy
      })
      delete timeoutMapRef.current[type]
    }, 10_000)
  }

  useEffect(() => {
    return () => {
      for (const timerId of Object.values(timeoutMapRef.current)) {
        clearTimeout(timerId)
      }
      timeoutMapRef.current = {}
    }
  }, [])

  const fetchUnknownSkus = useCallback(async () => {
    setSkuReviewLoading(true)
    try {
      const items = await apiClient.get<UnknownSku[]>('/api/integrations/woocommerce/unknown-skus')
      setUnknownSkuItems(items)
      setUnknownSkuCount(items.length)
    } catch {
      // Non-fatal — panel stays empty
    } finally {
      setSkuReviewLoading(false)
    }
  }, [])

  // Populate the unknown SKU count on mount so the banner appears without needing a sync this session.
  useEffect(() => {
    void fetchUnknownSkus()
  }, [fetchUnknownSkus])

  const handleOpenSkuReview = () => {
    setShowSkuReview(true)
    void fetchUnknownSkus()
  }

  const handleDismissSku = async (id: string) => {
    try {
      await apiClient.post(`/api/integrations/woocommerce/unknown-skus/${id}/dismiss`, {})
      setUnknownSkuItems((prev) => prev.filter((item) => item.id !== id))
      setUnknownSkuCount((prev) => Math.max(0, prev - 1))
    } catch {
      // Non-fatal
    }
  }

  const handleSkuAdded = (id: string) => {
    setAddingSkuItem(null)
    void handleDismissSku(id)
  }

  const handleConnect = async (type: string, credentials: Record<string, string>) => {
    try {
      await connect(type, credentials)
      setTimedFeedback(type, {
        tone: 'success',
        message: 'Integration connected successfully.',
      })
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error('Failed to connect integration')
    }
  }

  const handleSync = async (type: string) => {
    setSyncingType(type)
    try {
      const result = await sync(type)

      // Always sync count — resets to 0 if all SKUs were resolved this run.
      setUnknownSkuCount(result.unknownSkuCount)

      const salesNote = result.salesImported > 0 ? ` · ${result.salesImported} sales records written.` : ''
      if (result.errors.length === 0 && result.unknownSkuCount === 0) {
        setTimedFeedback(type, {
          tone: 'success',
          message: `Imported ${result.recordsImported} inventory items${salesNote}`,
        })
      } else if (result.errors.length > 0) {
        setTimedFeedback(type, {
          tone: 'warning',
          message: `Imported ${result.recordsImported} inventory items${salesNote} · ${result.errors.length} warnings.`,
          details: result.errors,
        })
      } else {
        setTimedFeedback(type, {
          tone: 'success',
          message: `Imported ${result.recordsImported} inventory items${salesNote}`,
        })
      }
    } catch (err: unknown) {
      setTimedFeedback(type, {
        tone: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      })
    } finally {
      setSyncingType((prev) => (prev === type ? null : prev))
    }
  }

  const handleDisconnect = async (type: string) => {
    setDisconnectingType(type)
    try {
      await disconnect(type)
      setTimedFeedback(type, {
        tone: 'success',
        message: 'Integration disconnected.',
      })
    } catch (err: unknown) {
      setTimedFeedback(type, {
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to disconnect integration',
      })
    } finally {
      setDisconnectingType((prev) => (prev === type ? null : prev))
    }
  }

  const handleSetSchedule = async (type: string, hours: number | null) => {
    setSchedulingType(type)
    try {
      await setSchedule(type, hours)
      setTimedFeedback(type, {
        tone: 'success',
        message: hours === null ? 'Auto-sync disabled.' : `Auto-sync updated to every ${hours} hour(s).`,
      })
    } catch (err: unknown) {
      setTimedFeedback(type, {
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to update auto-sync schedule',
      })
    } finally {
      setSchedulingType((prev) => (prev === type ? null : prev))
    }
  }

  if (error && !loading && registry.length === 0) {
    return (
      <section className="rounded-xl border border-red-800 bg-slate-800 p-6 text-slate-100">
        <h2 className="text-2xl font-semibold text-red-300">Integrations Unavailable</h2>
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
      <header className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
        <h1 className="text-3xl font-bold text-cyan-300">Integrations</h1>
        <p className="mt-2 text-sm text-slate-300">Connect external services to import data into AIDA.</p>
        <div className="mt-4 rounded-md border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          AIDA is designed for internal network use only. Keep this dashboard off the public internet.
        </div>
        <div className="mt-3 rounded-md border border-slate-600 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          Imports are read-only. Data flows from your store into AIDA. AIDA does not write changes back to WooCommerce.
        </div>
      </header>

      {unknownSkuCount > 0 && (
        <div className="rounded-xl border border-amber-600 bg-amber-950/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <i className="fas fa-triangle-exclamation text-amber-400" />
              <p className="text-sm text-amber-200">
                <span className="font-semibold">{unknownSkuCount} SKU{unknownSkuCount !== 1 ? 's' : ''}</span> from
                WooCommerce were not found in AIDA inventory. Review them to decide if they should be added.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenSkuReview}
              className="shrink-0 rounded-md bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-500"
            >
              Review
            </button>
          </div>

          {showSkuReview && (
            <div className="mt-4 rounded-lg border border-amber-700/50 bg-slate-900/60">
              <div className="flex items-center justify-between border-b border-amber-700/30 px-4 py-3">
                <p className="text-sm font-semibold text-amber-200">Unknown SKUs from WooCommerce</p>
                <button
                  type="button"
                  onClick={() => setShowSkuReview(false)}
                  className="text-slate-400 hover:text-slate-200"
                  aria-label="Close review panel"
                >
                  <i className="fas fa-xmark" />
                </button>
              </div>

              {skuReviewLoading ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
              ) : unknownSkuItems.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-emerald-300">All reviewed.</p>
              ) : (
                <ul className="divide-y divide-slate-700/50">
                  {unknownSkuItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-slate-100">{item.sku}</p>
                        <p className="truncate text-xs text-slate-400">{item.productName}</p>
                        <p className="text-xs text-slate-500">WC stock: {item.wcStock}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => setAddingSkuItem(item)}
                          className="rounded-md bg-cyan-700 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-600"
                        >
                          Add to Inventory
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDismissSku(item.id)}
                          className="rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`integration-skeleton-${index}`} className="h-64 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {registry.map((adapter) => (
            <IntegrationCard
              key={adapter.id}
              adapter={adapter}
              status={statuses[adapter.id]}
              syncing={syncingType === adapter.id}
              disconnecting={disconnectingType === adapter.id}
              scheduling={schedulingType === adapter.id}
              feedback={feedbackByType[adapter.id]}
              onConnect={() => setActiveConnect(adapter.id)}
              onSync={() => handleSync(adapter.id)}
              onDisconnect={() => void handleDisconnect(adapter.id)}
              onSetSchedule={(hours) => handleSetSchedule(adapter.id, hours)}
            />
          ))}
        </div>
      )}

      <ConnectModal
        isOpen={Boolean(activeAdapter)}
        adapter={activeAdapter}
        onClose={() => setActiveConnect(null)}
        onConnected={(credentials) => {
          if (!activeAdapter) {
            throw new Error('No integration selected.')
          }

          return handleConnect(activeAdapter.id, credentials)
        }}
      />

      {addingSkuItem && (
        <AddToInventoryModal
          item={addingSkuItem}
          onClose={() => setAddingSkuItem(null)}
          onAdded={handleSkuAdded}
        />
      )}
    </section>
  )
}
