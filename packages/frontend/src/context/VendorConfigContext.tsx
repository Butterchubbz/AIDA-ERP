import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import type { VendorConfig, GetVendorConfigsResponse } from '@aida/shared'
import { apiClient } from '../lib/apiClient'

interface VendorConfigContextType {
  /** Effective vendor map: server defaults merged with user customizations. */
  vendors: Record<string, VendorConfig>
  loading: boolean
  /** Save a full vendor map customization to the user's server-side preferences. */
  saveVendors: (updated: Record<string, VendorConfig>) => Promise<void>
}

const VendorConfigContext = createContext<VendorConfigContextType | undefined>(undefined)

export function VendorConfigProvider({ children }: { children: React.ReactNode }) {
  const [vendors, setVendors] = useState<Record<string, VendorConfig>>({})
  const [loading, setLoading] = useState(true)

  const fetchVendors = useCallback(async () => {
    const res = await apiClient.get<GetVendorConfigsResponse>('/api/forecasting/vendor-configs')
    setVendors(res.vendors)
  }, [])

  useEffect(() => {
    fetchVendors().finally(() => setLoading(false))
  }, [fetchVendors])

  const saveVendors = useCallback(
    async (updated: Record<string, VendorConfig>) => {
      await apiClient.patch('/api/users/preferences', { vendorConfigs: updated })
      await fetchVendors()
    },
    [fetchVendors]
  )

  return (
    <VendorConfigContext.Provider value={{ vendors, loading, saveVendors }}>
      {children}
    </VendorConfigContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVendorConfig(): VendorConfigContextType {
  const ctx = useContext(VendorConfigContext)
  if (!ctx) throw new Error('useVendorConfig must be used inside VendorConfigProvider')
  return ctx
}
