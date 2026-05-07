import { useState } from 'react'
import { encryptCredential } from '../lib/crypto'
import { apiClient } from '../lib/apiClient'

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY as string | undefined

export function WoocommerceSetup() {
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [status, setStatus] = useState<'idle' | 'encrypting' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSave() {
    if (!consumerKey.trim() || !consumerSecret.trim()) {
      setErrorMessage('Both Consumer Key and Consumer Secret are required.')
      return
    }

    if (!ENCRYPTION_KEY) {
      setErrorMessage('VITE_ENCRYPTION_KEY is not configured. Contact your system administrator.')
      return
    }

    setStatus('encrypting')
    setErrorMessage(null)

    let encryptedBlob: string
    try {
      const plaintext = `${consumerKey.trim()}:${consumerSecret.trim()}`
      encryptedBlob = await encryptCredential(plaintext, ENCRYPTION_KEY)
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage('Encryption failed. Ensure VITE_ENCRYPTION_KEY is a valid 64-character hex string.')
      console.error('[WoocommerceSetup] Encryption error:', err)
      return
    }

    setStatus('saving')
    try {
      await apiClient.patch('/api/users/preferences', { encryptedWoocommerceKey: encryptedBlob })
      setStatus('saved')
      // Clear plaintext fields from memory
      setConsumerKey('')
      setConsumerSecret('')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save credentials')
    }
  }

  function handleReset() {
    setConsumerKey('')
    setConsumerSecret('')
    setStatus('idle')
    setErrorMessage(null)
  }

  const isBusy = status === 'encrypting' || status === 'saving'

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">WooCommerce Integration</h3>
        <p className="text-sm text-gray-500">
          Credentials are encrypted in your browser before being stored. The plaintext key is never
          transmitted or logged.
        </p>
      </div>

      <div className="space-y-3">
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
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isBusy || !consumerKey || !consumerSecret}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'encrypting' ? 'Encrypting…' : status === 'saving' ? 'Saving…' : 'Save & Encrypt'}
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

      {status === 'saved' && (
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-800">
            ✓ Credentials encrypted and saved. Use the Sync button to trigger a WooCommerce import.
          </p>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
