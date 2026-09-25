import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/apiClient'

interface IntegrationStatus {
  type: string
  connected: boolean
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
}

export function WoocommerceSetup() {
  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'syncing' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const integrations = await apiClient.get<IntegrationStatus[]>('/api/integrations')
      const wc = integrations.find((i) => i.type === 'woocommerce') ?? null
      setIntegration(wc)
    } catch {
      // Not connected yet — that's fine
      setIntegration(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function handleSave() {
    if (!storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      setErrorMessage('Store URL, Consumer Key, and Consumer Secret are all required.')
      return
    }

    setStatus('saving')
    setErrorMessage(null)

    try {
      await apiClient.post('/api/integrations/woocommerce/connect', {
        storeUrl: storeUrl.trim(),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
      })
      setStatus('saved')
      setStoreUrl('')
      setConsumerKey('')
      setConsumerSecret('')
      await fetchStatus()
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save credentials')
    }
  }

  async function handleSync() {
    setStatus('syncing')
    setErrorMessage(null)

    try {
      const result = await apiClient.post<{ recordsImported: number; errors: string[] }>(
        '/api/integrations/woocommerce/sync'
      )
      await fetchStatus()
      setStatus('idle')
      if (result.errors.length > 0) {
        setErrorMessage(`Synced ${result.recordsImported} items. Warnings: ${result.errors.slice(0, 3).join('; ')}`)
      }
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  async function handleDisconnect() {
    try {
      await apiClient.delete('/api/integrations/woocommerce')
      setIntegration(null)
      setStatus('idle')
      setErrorMessage(null)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to disconnect')
    }
  }

  function handleReset() {
    setStoreUrl('')
    setConsumerKey('')
    setConsumerSecret('')
    setStatus('idle')
    setErrorMessage(null)
  }

  const isBusy = status === 'saving' || status === 'syncing'

  if (loadingStatus) {
    return <p className="text-sm text-slate-400">Loading integration status…</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">WooCommerce Integration</h3>
        <p className="text-sm text-gray-500">
          Your credentials are encrypted on the server before being stored. They are never returned
          to the browser after saving.
        </p>
      </div>

      {integration?.connected ? (
        <div className="rounded border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800">Connected</p>
          {integration.lastSyncAt && (
            <p className="text-xs text-green-700">
              Last sync: {new Date(integration.lastSyncAt).toLocaleString()} —{' '}
              <span className={integration.lastSyncStatus === 'error' ? 'text-red-600' : 'text-green-700'}>
                {integration.lastSyncStatus}
              </span>
            </p>
          )}
          {integration.lastSyncMessage && (
            <p className="text-xs text-amber-700">{integration.lastSyncMessage}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleSync()}
              disabled={isBusy}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'syncing' ? 'Syncing…' : 'Sync Now'}
            </button>
            <button
              onClick={() => void handleDisconnect()}
              disabled={isBusy}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="wc-store-url" className="block text-sm font-medium text-gray-700 mb-1">
              Store URL
            </label>
            <input
              id="wc-store-url"
              type="url"
              autoComplete="off"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              disabled={isBusy}
              placeholder="https://yourstore.com"
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm
                focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="wc-consumer-key" className="block text-sm font-medium text-gray-700 mb-1">
              Consumer Key
            </label>
            <input
              id="wc-consumer-key"
              type="password"
              autoComplete="new-password"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              disabled={isBusy}
              placeholder="ck_••••••••••••••••"
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm
                focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                disabled:opacity-50 disabled:bg-gray-50"
            />
            <p className="mt-1 text-xs text-gray-400">
              WooCommerce → Settings → Advanced → REST API
            </p>
          </div>

          <div>
            <label htmlFor="wc-consumer-secret" className="block text-sm font-medium text-gray-700 mb-1">
              Consumer Secret
            </label>
            <input
              id="wc-consumer-secret"
              type="password"
              autoComplete="new-password"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              disabled={isBusy}
              placeholder="cs_••••••••••••••••"
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm
                focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                disabled:opacity-50 disabled:bg-gray-50"
            />
            <p className="mt-1 text-xs text-gray-400">
              Shown once when you create the API key — save it before closing that page.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleSave()}
              disabled={isBusy || !storeUrl || !consumerKey || !consumerSecret}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'saving' ? 'Saving…' : 'Connect'}
            </button>
            {(status === 'saved' || status === 'error') && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'saved' && !integration?.connected && (
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-800">
            Credentials saved. Use Sync Now to pull stock from WooCommerce.
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
