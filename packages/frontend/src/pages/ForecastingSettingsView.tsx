import { useEffect, useMemo, useState } from 'react'
import PageContainer from '../components/common/PageContainer'
import { useDeviceContext } from '../context/DeviceContext'
import { useComponentInventory } from '../hooks/useInventoryModules'
import { useMessageBox } from '../components/common/MessageBox'
import {
  getVendorConfigs,
  saveVendorConfigs,
  getSkuVendorMap,
  saveSkuVendorMap,
  type VendorConfig,
} from '../lib/vendorConfig'

type Mode = 'device' | 'component'

type Tab = 'vendors' | 'sku' | 'formula'

const VENDOR_COLORS = ['cyan', 'blue', 'indigo', 'purple', 'violet', 'green', 'amber', 'red', 'slate'] as const

const VENDOR_COLOR_HEX: Record<(typeof VENDOR_COLORS)[number], string> = {
  cyan: '#06b6d4',
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  violet: '#8b5cf6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
}

function cycleVendorColor(current: string): (typeof VENDOR_COLORS)[number] {
  const idx = VENDOR_COLORS.findIndex(color => color === current)
  if (idx === -1) return VENDOR_COLORS[0]
  return VENDOR_COLORS[(idx + 1) % VENDOR_COLORS.length]
}

function formatToday(dateFormat: VendorConfig['poFormat']['dateFormat']) {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  if (dateFormat === 'MMDD') return `${month}${day}`
  if (dateFormat === 'YYYY') return year
  return `${year}${month}${day}`
}

function generatePreview(vendorKey: string, vendor: VendorConfig) {
  const po = vendor.poFormat
  const prefix = po.prefix || 'PO'
  const separator = po.separator ?? '-'
  const date = po.includeDate ? formatToday(po.dateFormat) : ''
  const vendorToken = vendorKey.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'VENDOR'
  const seq = '4821'

  if (po.customPattern && po.customPattern.trim()) {
    return po.customPattern
      .replaceAll('{PREFIX}', prefix)
      .replaceAll('{DATE}', date)
      .replaceAll('{VENDOR}', vendorToken)
      .replaceAll('{SEQ}', seq)
  }

  const parts = [prefix]
  if (po.includeDate) parts.push(date)
  if (po.includeSuffix) parts.push(seq)
  return parts.filter(Boolean).join(separator)
}

function ForecastingSettingsView() {
  const { devices } = useDeviceContext()
  const { componentInventory } = useComponentInventory()
  const { showToast } = useMessageBox()

  const [tab, setTab] = useState<Tab>('vendors')
  const [vendorMode, setVendorMode] = useState<Mode>('device')
  const [skuMode, setSkuMode] = useState<Mode>('device')
  const [skuSearch, setSkuSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [bulkVendor, setBulkVendor] = useState('')
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set())
  const [expandedPoFormat, setExpandedPoFormat] = useState<string | null>(null)

  const [deviceVendors, setDeviceVendors] = useState<Record<string, VendorConfig>>(() =>
    getVendorConfigs('device')
  )
  const [componentVendors, setComponentVendors] = useState<Record<string, VendorConfig>>(() =>
    getVendorConfigs('component')
  )

  const [deviceSkuMap, setDeviceSkuMap] = useState<Record<string, string[]>>(() =>
    getSkuVendorMap('device')
  )
  const [componentSkuMap, setComponentSkuMap] = useState<Record<string, string[]>>(() =>
    getSkuVendorMap('component')
  )

  const vendorState = vendorMode === 'device' ? deviceVendors : componentVendors
  const setVendorState = vendorMode === 'device' ? setDeviceVendors : setComponentVendors

  const skuMapState = skuMode === 'device' ? deviceSkuMap : componentSkuMap
  const setSkuMapState = skuMode === 'device' ? setDeviceSkuMap : setComponentSkuMap
  const skuVendorConfigs = skuMode === 'device' ? deviceVendors : componentVendors

  const sourceItems = skuMode === 'device' ? devices : componentInventory

  const filteredItems = useMemo(() => {
    const q = skuSearch.trim().toLowerCase()
    return sourceItems.filter(item => {
      const matchesQuery =
        !q || item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
      const assigned = skuMapState[item.sku] ?? []
      const matchesVendor =
        vendorFilter === ''
          ? true
          : vendorFilter === 'unassigned'
            ? assigned.length === 0
            : assigned.includes(vendorFilter)
      return matchesQuery && matchesVendor
    })
  }, [sourceItems, skuSearch, skuMapState, vendorFilter])

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every(item => selectedSkus.has(item.sku))

  useEffect(() => {
    setSelectedSkus(new Set())
  }, [skuMode, skuSearch, vendorFilter])

  const currentVendorKeys = Object.keys(vendorState)

  const skuCountByVendor = useMemo(() => {
    const map = vendorMode === 'device' ? deviceSkuMap : componentSkuMap
    const count: Record<string, number> = {}
    Object.values(map).forEach(vendors => {
      vendors.forEach(v => {
        count[v] = (count[v] ?? 0) + 1
      })
    })
    return count
  }, [vendorMode, deviceSkuMap, componentSkuMap])

  const addVendorToSku = (sku: string, vendorKey: string) => {
    if (!vendorKey) return
    setSkuMapState(prev => {
      const current = new Set(prev[sku] ?? [])
      current.add(vendorKey)
      return { ...prev, [sku]: Array.from(current) }
    })
  }

  const removeVendorFromSku = (sku: string, vendorKey: string) => {
    setSkuMapState(prev => {
      const current = (prev[sku] ?? []).filter(v => v !== vendorKey)
      return { ...prev, [sku]: current }
    })
  }

  const clearSkuAssignmentsForSku = (sku: string) => {
    setSkuMapState(prev => ({
      ...prev,
      [sku]: [],
    }))
  }

  const toggleSkuSelection = (sku: string, checked: boolean) => {
    setSelectedSkus(prev => {
      const next = new Set(prev)
      if (checked) next.add(sku)
      else next.delete(sku)
      return next
    })
  }

  const toggleAllVisible = (checked: boolean) => {
    setSelectedSkus(prev => {
      const next = new Set(prev)
      filteredItems.forEach(item => {
        if (checked) next.add(item.sku)
        else next.delete(item.sku)
      })
      return next
    })
  }

  const applyBulkVendor = () => {
    if (!bulkVendor || selectedSkus.size === 0) return
    setSkuMapState(prev => {
      const next = { ...prev }
      selectedSkus.forEach(sku => {
        const current = new Set(next[sku] ?? [])
        current.add(bulkVendor)
        next[sku] = Array.from(current)
      })
      return next
    })
  }

  const clearBulkAssignments = () => {
    if (selectedSkus.size === 0) return
    setSkuMapState(prev => {
      const next = { ...prev }
      selectedSkus.forEach(sku => {
        next[sku] = []
      })
      return next
    })
  }

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
    setExpandedPoFormat(prev => (prev === key ? null : prev))
  }

  const saveVendors = () => {
    saveVendorConfigs(vendorState, vendorMode)
    showToast(`Saved ${vendorMode} vendor settings.`, 'success')
  }

  const saveSkuAssignments = () => {
    saveSkuVendorMap(skuMapState, skuMode)
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
            {currentVendorKeys.map(key => {
              const vendor = vendorState[key]
              const skuCount = skuCountByVendor[key] ?? 0
              const canDelete = key !== 'other' && skuCount === 0
              const colorKey = VENDOR_COLORS.find(c => c === vendor.color) ?? 'slate'
              const colorHex = VENDOR_COLOR_HEX[colorKey]
              return (
                <div
                  key={key}
                  className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      style={{ backgroundColor: colorHex }}
                      onClick={() => updateVendor(key, 'color', cycleVendorColor(vendor.color))}
                      className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-slate-800 ring-slate-500 hover:ring-cyan-400"
                      title="Cycle vendor color"
                    />
                    <input
                      value={vendor.name}
                      onChange={e => updateVendor(key, 'name', e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Lead Time (weeks)</label>
                      <input
                        type="number"
                        min={1}
                        value={vendor.leadTimeWeeks}
                        onChange={e => updateVendor(key, 'leadTimeWeeks', Number(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Safety Stock %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(vendor.safetyStockPct * 100)}
                        onChange={e =>
                          updateVendor(
                            key,
                            'safetyStockPct',
                            Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{skuCount} SKUs assigned</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedPoFormat(expandedPoFormat === key ? null : key)}
                        className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400"
                      >
                        {expandedPoFormat === key ? '▼' : '▶'} PO Format
                      </button>
                      <button
                        onClick={() => deleteVendor(key)}
                        disabled={!canDelete}
                        className="text-xs px-2 py-1 rounded border border-red-900/40 text-red-400 hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedPoFormat === key && (
                    <div className="border-t border-slate-600/50 pt-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Prefix</label>
                          <input
                            value={vendor.poFormat.prefix}
                            onChange={e =>
                              setVendorState(prev => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  poFormat: {
                                    ...prev[key].poFormat,
                                    prefix: e.target.value || 'PO',
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-sm text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Separator</label>
                          <select
                            value={vendor.poFormat.separator}
                            onChange={e =>
                              setVendorState(prev => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  poFormat: {
                                    ...prev[key].poFormat,
                                    separator: e.target.value,
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-sm text-slate-100"
                          >
                            <option value="-">- (dash)</option>
                            <option value="/">/ (slash)</option>
                            <option value="_">_ (underscore)</option>
                            <option value="">(none)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Date Format</label>
                          <select
                            value={vendor.poFormat.dateFormat}
                            onChange={e =>
                              setVendorState(prev => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  poFormat: {
                                    ...prev[key].poFormat,
                                    dateFormat: e.target.value as VendorConfig['poFormat']['dateFormat'],
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-sm text-slate-100"
                          >
                            <option value="YYYYMMDD">YYYYMMDD</option>
                            <option value="MMDD">MMDD</option>
                            <option value="YYYY">YYYY</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Custom Pattern (overrides above)
                        </label>
                        <input
                          value={vendor.poFormat.customPattern ?? ''}
                          onChange={e =>
                            setVendorState(prev => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                poFormat: {
                                  ...prev[key].poFormat,
                                  customPattern: e.target.value.trim() ? e.target.value : null,
                                },
                              },
                            }))
                          }
                          placeholder="{PREFIX}-{DATE}-{VENDOR}-{SEQ}"
                          className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-sm text-slate-100"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Tokens: {`{PREFIX}`} {`{DATE}`} {`{VENDOR}`} {`{SEQ}`}
                        </p>
                      </div>

                      <div className="bg-slate-800/60 rounded px-3 py-2">
                        <span className="text-xs text-slate-500">Preview: </span>
                        <span className="text-xs font-mono text-cyan-400">
                          {generatePreview(key, vendor)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2 mb-3">
            <input
              value={skuSearch}
              onChange={e => setSkuSearch(e.target.value)}
              placeholder="Search SKU or item name"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600"
            />
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600"
            >
              <option value="">All Vendors</option>
              <option value="unassigned">Unassigned</option>
              {Object.entries(skuVendorConfigs).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSkus.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-2 rounded border border-slate-600 bg-slate-800/60">
              <span className="text-sm text-slate-300">{selectedSkus.size} selected</span>
              <label className="text-sm text-slate-400">Assign to:</label>
              <select
                value={bulkVendor}
                onChange={e => setBulkVendor(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-sm"
              >
                <option value="">Select vendor</option>
                {Object.entries(skuVendorConfigs).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.name}
                  </option>
                ))}
              </select>
              <button
                onClick={applyBulkVendor}
                className="px-3 py-1 rounded bg-cyan-600 text-white text-sm"
              >
                Apply
              </button>
              <button
                onClick={clearBulkAssignments}
                className="px-3 py-1 rounded bg-slate-700 text-sm"
              >
                Clear Assignments
              </button>
              <button
                onClick={() => setSelectedSkus(new Set())}
                className="px-3 py-1 rounded bg-slate-700 text-sm"
              >
                Deselect All
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={e => toggleAllVisible(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Item Name</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">SKU</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Assigned Vendors</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredItems.map(item => {
                  const assigned = skuMapState[item.sku] ?? []
                  const options = Object.keys(skuVendorConfigs)
                  return (
                    <tr key={`${skuMode}-${item.id}`}>
                      <td className="px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSkus.has(item.sku)}
                          onChange={e => toggleSkuSelection(item.sku, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-200">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-cyan-300 text-sm">{item.sku}</td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          {assigned.length === 0 && (
                            <span className="text-slate-500">Unassigned</span>
                          )}
                          {assigned.map(v => {
                            const cfg = skuVendorConfigs[v]
                            const colorKey = VENDOR_COLORS.find(c => c === cfg?.color) ?? 'slate'
                            return (
                              <span
                                key={`${item.sku}-${v}`}
                                className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-0.5"
                              >
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ backgroundColor: VENDOR_COLOR_HEX[colorKey] }}
                                />
                                <span className="text-xs text-slate-200">{cfg?.name ?? v}</span>
                                <button
                                  type="button"
                                  onClick={() => removeVendorFromSku(item.sku, v)}
                                  className="text-xs text-slate-400 hover:text-red-300"
                                  title="Remove vendor"
                                >
                                  x
                                </button>
                              </span>
                            )
                          })}
                          <select
                            defaultValue=""
                            onChange={e => {
                              addVendorToSku(item.sku, e.target.value)
                              e.currentTarget.value = ''
                            }}
                            className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs"
                          >
                            <option value="">Add -&gt;</option>
                            {options.map(v => (
                              <option key={v} value={v}>
                                {skuVendorConfigs[v]?.name ?? v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <button
                          onClick={() => clearSkuAssignmentsForSku(item.sku)}
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
        <div className="space-y-4">
          <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Reorder Point Formula</h4>
            <div className="bg-slate-800 rounded p-3 font-mono text-cyan-400 text-sm mb-2">
              Reorder Point = ceil(velocity/wk x lead time x (1 + safety %))
            </div>
            <p className="text-xs text-slate-400">Example: (2.5 u/wk x 2 weeks) x 1.20 = 6 units</p>
          </div>

          <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Confidence Levels</h4>
            <div className="space-y-2">
              {[
                { label: 'HIGH', weeks: '12+ weeks', color: 'text-green-400' },
                { label: 'MEDIUM', weeks: '4-11 weeks', color: 'text-amber-400' },
                { label: 'LOW', weeks: '1-3 weeks', color: 'text-slate-400' },
                { label: 'NONE', weeks: 'No data', color: 'text-slate-600' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-16 ${c.color}`}>{c.label}</span>
                  <span className="text-xs text-slate-400">{c.weeks} of sales history</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Status Definitions</h4>
            <div className="space-y-2">
              {[
                { label: 'CRITICAL', desc: 'Stock below reorder point now', color: 'text-red-400' },
                { label: 'WARNING', desc: 'Stock within 2 weeks of reorder', color: 'text-amber-400' },
                { label: 'NORMAL', desc: 'Stock above reorder point', color: 'text-green-400' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-20 ${s.color}`}>{s.label}</span>
                  <span className="text-xs text-slate-400">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Dual-Signal Velocity</h4>
            <div className="bg-slate-800 rounded p-3 font-mono text-cyan-400 text-sm mb-2">
              Combined = (Sales x 60%) + (Inventory x 40%)
            </div>
            <p className="text-xs text-slate-400">
              Discrepancy flagged when signals differ by more than 20%. Sales data source: salesData collection
              (itemsSold field). Inventory source: stockHistory.
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default ForecastingSettingsView
