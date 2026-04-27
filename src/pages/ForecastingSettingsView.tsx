import { useMemo, useState } from 'react'
import PageContainer from '../components/common/PageContainer'
import { useDeviceContext } from '../context/DeviceContext'
import { useComponentInventory } from '../hooks/useInventoryModules'
import { useMessageBox } from '../components/common/MessageBox'
import {
  getVendorConfigs,
  saveVendorConfigs,
  getSkuVendorMap,
  saveSkuVendorMap,
  getVendorForSku,
  type VendorConfig,
} from '../lib/vendorConfig'

type Mode = 'device' | 'component'

type Tab = 'vendors' | 'sku' | 'formula'

function ForecastingSettingsView() {
  const { devices } = useDeviceContext()
  const { componentInventory } = useComponentInventory()
  const { showToast } = useMessageBox()

  const [tab, setTab] = useState<Tab>('vendors')
  const [vendorMode, setVendorMode] = useState<Mode>('device')
  const [skuMode, setSkuMode] = useState<Mode>('device')
  const [skuSearch, setSkuSearch] = useState('')

  const [deviceVendors, setDeviceVendors] = useState<Record<string, VendorConfig>>(() =>
    getVendorConfigs('device')
  )
  const [componentVendors, setComponentVendors] = useState<Record<string, VendorConfig>>(() =>
    getVendorConfigs('component')
  )

  const [deviceSkuMap, setDeviceSkuMap] = useState<Record<string, string>>(() =>
    getSkuVendorMap('device')
  )
  const [componentSkuMap, setComponentSkuMap] = useState<Record<string, string>>(() =>
    getSkuVendorMap('component')
  )

  const vendorState = vendorMode === 'device' ? deviceVendors : componentVendors
  const setVendorState = vendorMode === 'device' ? setDeviceVendors : setComponentVendors

  const skuMapState = skuMode === 'device' ? deviceSkuMap : componentSkuMap
  const setSkuMapState = skuMode === 'device' ? setDeviceSkuMap : setComponentSkuMap

  const sourceItems = skuMode === 'device' ? devices : componentInventory

  const filteredItems = useMemo(() => {
    const q = skuSearch.trim().toLowerCase()
    if (!q) return sourceItems
    return sourceItems.filter(item => {
      return item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
    })
  }, [sourceItems, skuSearch])

  const currentVendorKeys = Object.keys(vendorState)

  const skuCountByVendor = useMemo(() => {
    const map = vendorMode === 'device' ? deviceSkuMap : componentSkuMap
    const count: Record<string, number> = {}
    Object.values(map).forEach(v => {
      count[v] = (count[v] ?? 0) + 1
    })
    return count
  }, [vendorMode, deviceSkuMap, componentSkuMap])

  const updateVendor = (
    key: string,
    field: keyof VendorConfig,
    value: string | number
  ) => {
    setVendorState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }))
  }

  const addVendor = () => {
    const key = `vendor-${Date.now()}`
    setVendorState(prev => ({
      ...prev,
      [key]: {
        name: 'New Vendor',
        leadTimeWeeks: 1,
        safetyStockPct: 0.1,
        color: 'slate',
        poFormat: {
          prefix: 'PO',
          separator: '-',
          includeDate: true,
          dateFormat: 'YYYYMMDD',
          includeSuffix: true,
          customPattern: null,
        },
      },
    }))
  }

  const deleteVendor = (key: string) => {
    if ((skuCountByVendor[key] ?? 0) > 0) return
    setVendorState(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const saveVendors = () => {
    saveVendorConfigs(vendorMode, vendorState)
    showToast(`Saved ${vendorMode} vendor settings.`, 'success')
  }

  const saveSkuAssignments = () => {
    saveSkuVendorMap(skuMode, skuMapState)
    showToast(`Saved ${skuMode} SKU assignments.`, 'success')
  }

  return (
    <PageContainer title="Forecasting Settings" icon="fas fa-sliders-h">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('vendors')}
          className={`px-3 py-2 rounded ${tab === 'vendors' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Vendors
        </button>
        <button
          onClick={() => setTab('sku')}
          className={`px-3 py-2 rounded ${tab === 'sku' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          SKU Assignment
        </button>
        <button
          onClick={() => setTab('formula')}
          className={`px-3 py-2 rounded ${tab === 'formula' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
        >
          Formula Reference
        </button>
      </div>

      {tab === 'vendors' && (
        <div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setVendorMode('device')}
              className={`px-3 py-1 rounded text-sm ${vendorMode === 'device' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Device Vendors
            </button>
            <button
              onClick={() => setVendorMode('component')}
              className={`px-3 py-1 rounded text-sm ${vendorMode === 'component' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Component Vendors
            </button>
          </div>

          <div className="space-y-3 mb-4">
            {currentVendorKeys.map(key => (
              <div key={key} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-slate-700/40 p-3 rounded">
                <input
                  value={vendorState[key].name}
                  onChange={e => updateVendor(key, 'name', e.target.value)}
                  className="md:col-span-4 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                />
                <input
                  type="number"
                  min={1}
                  value={vendorState[key].leadTimeWeeks}
                  onChange={e => updateVendor(key, 'leadTimeWeeks', Number(e.target.value) || 1)}
                  className="md:col-span-2 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(vendorState[key].safetyStockPct * 100)}
                  onChange={e =>
                    updateVendor(
                      key,
                      'safetyStockPct',
                      Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100
                    )
                  }
                  className="md:col-span-2 px-2 py-1 rounded bg-slate-800 border border-slate-600"
                />
                <div className="md:col-span-2 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-300">
                  SKU Count: {skuCountByVendor[key] ?? 0}
                </div>
                <button
                  onClick={() => deleteVendor(key)}
                  disabled={(skuCountByVendor[key] ?? 0) > 0}
                  className="md:col-span-2 px-2 py-1 rounded bg-red-900/30 border border-red-700/40 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={addVendor} className="px-3 py-2 rounded bg-slate-700">
              Add Vendor
            </button>
            <button onClick={saveVendors} className="px-3 py-2 rounded bg-cyan-600 text-white">
              Save All Changes
            </button>
          </div>
        </div>
      )}

      {tab === 'sku' && (
        <div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSkuMode('device')}
              className={`px-3 py-1 rounded text-sm ${skuMode === 'device' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Devices
            </button>
            <button
              onClick={() => setSkuMode('component')}
              className={`px-3 py-1 rounded text-sm ${skuMode === 'component' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Components
            </button>
          </div>

          <input
            value={skuSearch}
            onChange={e => setSkuSearch(e.target.value)}
            placeholder="Search SKU or item name"
            className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-600"
          />

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">SKU</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Item Name</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Auto-Detected Vendor</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Assigned Vendor</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Clear</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredItems.map(item => {
                  const autoVendor = getVendorForSku(item.sku, skuMode)
                  const assigned = skuMapState[item.sku] ?? ''
                  const options = Object.keys(skuMode === 'device' ? deviceVendors : componentVendors)
                  return (
                    <tr key={`${skuMode}-${item.id}`}>
                      <td className="px-3 py-2 font-mono text-cyan-300 text-sm">{item.sku}</td>
                      <td className="px-3 py-2 text-sm text-slate-200">{item.name}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">{autoVendor}</td>
                      <td className="px-3 py-2 text-sm">
                        <select
                          value={assigned}
                          onChange={e =>
                            setSkuMapState(prev => ({
                              ...prev,
                              [item.sku]: e.target.value,
                            }))
                          }
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                        >
                          <option value="">(auto)</option>
                          {options.map(v => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <button
                          onClick={() =>
                            setSkuMapState(prev => {
                              const next = { ...prev }
                              delete next[item.sku]
                              return next
                            })
                          }
                          className="px-2 py-1 rounded bg-slate-700"
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={saveSkuAssignments} className="mt-4 px-3 py-2 rounded bg-cyan-600 text-white">
            Save
          </button>
        </div>
      )}

      {tab === 'formula' && (
        <div className="space-y-3 text-slate-300 text-sm">
          <p>Reorder Point = (velocity x leadTime) x (1 + safety%)</p>
          <p>Confidence: HIGH (12+ weeks), MEDIUM (4-11), LOW (1-3), NONE (0)</p>
          <p>Status: CRITICAL (below reorder point), WARNING (near depletion), NORMAL (healthy)</p>
          <p>Velocity = total itemsSold / window weeks</p>
          <p>Dual signal velocity = Sales 60% + Inventory 40%</p>
        </div>
      )}
    </PageContainer>
  )
}

export default ForecastingSettingsView
