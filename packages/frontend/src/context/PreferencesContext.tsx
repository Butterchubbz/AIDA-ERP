import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import type { UserPreferences, UpdatePreferencesRequest } from '@aida/shared'
import { apiClient } from '../lib/apiClient'

interface PreferencesContextType {
  preferences: UserPreferences
  updatePreferences: (patch: UpdatePreferencesRequest) => Promise<void>
  loading: boolean
}

const defaultPrefs: UserPreferences = {
  userId: '',
  velocityOverrides: {},
  vendorConfigs: {},
  skuVendorMap: {},
}

export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPrefs)
  const [loading, setLoading] = useState(true)

  const fetchPreferences = useCallback(async () => {
    const prefs = await apiClient.get<UserPreferences>('/api/users/preferences')
    setPreferences(prefs)
  }, [])

  useEffect(() => {
    fetchPreferences().finally(() => setLoading(false))
  }, [fetchPreferences])

  const updatePreferences = useCallback(async (patch: UpdatePreferencesRequest) => {
    const updated = await apiClient.patch<UserPreferences>('/api/users/preferences', patch)
    setPreferences(updated)
  }, [])

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, loading }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextType {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
