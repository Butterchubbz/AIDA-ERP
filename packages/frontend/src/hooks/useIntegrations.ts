import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../lib/apiClient'

export interface CredentialField {
  key: string
  label: string
  type: 'text' | 'url' | 'password'
  required?: boolean
  placeholder?: string
  helpText?: string
}

export interface RegistryEntry {
  id: string
  name: string
  description: string
  credentialFields: CredentialField[]
}

export interface IntegrationStatus {
  type: string
  connected: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'partial' | 'error' | null
  lastSyncMessage: string | null
  syncIntervalHours?: number | null
}

interface SyncResponse {
  recordsImported: number
  errors: string[]
  unknownSkuCount: number
}

let registryCache: RegistryEntry[] | null = null

function toStatusMap(items: IntegrationStatus[]): Record<string, IntegrationStatus> {
  return items.reduce<Record<string, IntegrationStatus>>((acc, item) => {
    acc[item.type] = item
    return acc
  }, {})
}

export function useIntegrations() {
  const [registry, setRegistry] = useState<RegistryEntry[]>(registryCache ?? [])
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchStatuses = useCallback(async () => {
    const statusItems = await apiClient.get<IntegrationStatus[]>('/api/integrations')
    setStatuses(toStatusMap(statusItems))
  }, [])

  const fetchAll = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const registryPromise = registryCache
        ? Promise.resolve(registryCache)
        : apiClient.get<RegistryEntry[]>('/api/integrations/registry')
      const [registryItems, statusItems] = await Promise.all([
        registryPromise,
        apiClient.get<IntegrationStatus[]>('/api/integrations'),
      ])

      if (requestId !== requestIdRef.current) {
        return
      }

      registryCache = registryItems
      setRegistry(registryItems)
      setStatuses(toStatusMap(statusItems))
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) {
        return
      }

      setError(err instanceof Error ? err.message : 'Failed to load integrations')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const connect = useCallback(
    async (type: string, credentials: Record<string, string>) => {
      await apiClient.post(`/api/integrations/${type}/connect`, credentials)
      await fetchStatuses()
    },
    [fetchStatuses]
  )

  const disconnect = useCallback(
    async (type: string) => {
      await apiClient.delete(`/api/integrations/${type}`)
      await fetchStatuses()
    },
    [fetchStatuses]
  )

  const sync = useCallback(
    async (type: string): Promise<SyncResponse> => {
      const result = await apiClient.post<SyncResponse>(`/api/integrations/${type}/sync`)
      await fetchStatuses()
      return result
    },
    [fetchStatuses]
  )

  const setSchedule = useCallback(
    async (type: string, syncIntervalHours: number | null) => {
      await apiClient.patch(`/api/integrations/${type}/schedule`, { syncIntervalHours })
      await fetchStatuses()
    },
    [fetchStatuses]
  )

  return useMemo(
    () => ({
      registry,
      statuses,
      loading,
      error,
      connect,
      disconnect,
      sync,
      setSchedule,
      refetch: fetchAll,
    }),
    [registry, statuses, loading, error, connect, disconnect, sync, setSchedule, fetchAll]
  )
}
