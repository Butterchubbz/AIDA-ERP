import { useState, useEffect, useCallback } from 'react'
import type { ForecastItem, GetForecastResponse, ForecastMode } from '@aida/shared'
import { LOOKBACK_WEEKS } from '@aida/shared'
import { apiClient } from '../lib/apiClient'
import { usePreferences } from '../context/PreferencesContext'

interface UseForecastingOptions {
  mode: ForecastMode
}

// Re-export ForecastItem for backward compatibility with existing import sites
export type { ForecastItem }

/**
 * Fetches forecast data from the backend API.
 * Velocity overrides are persisted server-side via userPreferences.
 * The backend applies overrides before returning ForecastItem[].
 */
export function useForecasting({ mode }: UseForecastingOptions) {
  const [forecastWindow, setForecastWindow] = useState<(typeof LOOKBACK_WEEKS)[number]>(13)
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { preferences, updatePreferences } = usePreferences()

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    apiClient
      .get<GetForecastResponse>(`/api/forecasting?mode=${mode}&window=${forecastWindow}`)
      .then(res => setForecastItems(res.items))
      .catch(err => setError(err instanceof Error ? err.message : 'Forecast failed'))
      .finally(() => setLoading(false))
  }, [mode, forecastWindow])

  // Re-fetch when mode, window, or server-side overrides change
  useEffect(() => {
    refetch()
  }, [refetch, preferences.velocityOverrides])

  const acceptSignal = useCallback(
    (sku: string, signal: 'sales' | 'inventory') => {
      const updated = { ...preferences.velocityOverrides, [sku]: signal }
      updatePreferences({ velocityOverrides: updated })
        .catch(err => console.error('Failed to save velocity override:', err))
    },
    [preferences.velocityOverrides, updatePreferences]
  )

  const clearSignal = useCallback(
    (sku: string) => {
      const updated = { ...preferences.velocityOverrides }
      delete updated[sku]
      updatePreferences({ velocityOverrides: updated })
        .catch(err => console.error('Failed to clear velocity override:', err))
    },
    [preferences.velocityOverrides, updatePreferences]
  )

  return {
    forecastItems,
    loading,
    error,
    forecastWindow,
    setForecastWindow,
    refetch,
    acceptSignal,
    clearSignal,
  }
}