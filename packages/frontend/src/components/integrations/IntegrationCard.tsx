import { useMemo, useState } from 'react'
import type { IntegrationStatus, RegistryEntry } from '../../hooks/useIntegrations'

type FeedbackTone = 'success' | 'warning' | 'error'

interface SyncFeedback {
  tone: FeedbackTone
  message: string
  details?: string[]
}

interface IntegrationCardProps {
  adapter: RegistryEntry
  status: IntegrationStatus | undefined
  syncing: boolean
  disconnecting: boolean
  scheduling: boolean
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => Promise<void>
  onSetSchedule: (hours: number | null) => Promise<void>
  feedback?: SyncFeedback
}

const scheduleOptions: Array<{ label: string; value: number | null }> = [
  { label: 'Off', value: null },
  { label: 'Every hour', value: 1 },
  { label: 'Every 6 hours', value: 6 },
  { label: 'Daily', value: 24 },
]

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'Never'
  }

  const diffMs = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 'Just now'
  }

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'Just now'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hr ago`
  return `${Math.floor(diffMs / day)} day ago`
}

function syncPill(status: IntegrationStatus | undefined): { label: string; className: string } {
  const value = status?.lastSyncStatus
  if (!value) {
    return { label: 'Never', className: 'bg-slate-700 text-slate-200' }
  }

  if (value === 'success') {
    return { label: 'Success', className: 'bg-emerald-700 text-emerald-50' }
  }
  if (value === 'partial') {
    return { label: 'Partial', className: 'bg-amber-700 text-amber-50' }
  }

  return { label: 'Error', className: 'bg-red-700 text-red-50' }
}

function feedbackClass(tone: FeedbackTone): string {
  if (tone === 'success') return 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
  if (tone === 'warning') return 'border-amber-700 bg-amber-950/40 text-amber-200'
  return 'border-red-700 bg-red-950/40 text-red-200'
}

export default function IntegrationCard({
  adapter,
  status,
  syncing,
  disconnecting,
  scheduling,
  onConnect,
  onDisconnect,
  onSync,
  onSetSchedule,
  feedback,
}: IntegrationCardProps) {
  const [expandedWarnings, setExpandedWarnings] = useState(false)
  const connected = Boolean(status?.connected)
  const badgeClass = connected ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-700 text-slate-200'
  const badgeLabel = connected ? 'Connected' : 'Not connected'
  const lastSyncText = formatRelativeTime(status?.lastSyncAt ?? null)
  const pill = syncPill(status)

  const scheduleValue = useMemo(() => {
    if (typeof status?.syncIntervalHours !== 'number') {
      return ''
    }
    return String(status.syncIntervalHours)
  }, [status?.syncIntervalHours])

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-cyan-300">{adapter.name}</h3>
          <p className="mt-1 text-sm text-slate-300">{adapter.description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{badgeLabel}</span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Last import</span>
          <span className="font-medium text-slate-100">{lastSyncText}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Status</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pill.className}`}>{pill.label}</span>
        </div>
      </div>

      {connected && (
        <div className="mt-4">
          <label className="block text-xs uppercase tracking-wide text-slate-400">Auto-sync</label>
          <select
            value={scheduleValue}
            onChange={(event) => {
              const value = event.target.value
              const hours = value === '' ? null : Number(value)
              void onSetSchedule(hours)
            }}
            disabled={scheduling}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          >
            {scheduleOptions.map((option) => (
              <option key={option.label} value={option.value === null ? '' : option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {connected ? (
          <>
            <button
              type="button"
              onClick={() => void onSync()}
              disabled={syncing || disconnecting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {syncing ? 'Importing...' : 'Import Now'}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={syncing || disconnecting}
              className="rounded-md border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-60"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500"
          >
            Connect
          </button>
        )}
      </div>

      {feedback && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${feedbackClass(feedback.tone)}`}>
          <p>{feedback.message}</p>
          {feedback.details && feedback.details.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setExpandedWarnings((prev) => !prev)}
                className="text-xs font-semibold underline"
              >
                {expandedWarnings ? 'Hide details' : `Show details (${feedback.details.length})`}
              </button>
              {expandedWarnings && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {feedback.details.map((item, index) => (
                    <li key={`${adapter.id}-feedback-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
