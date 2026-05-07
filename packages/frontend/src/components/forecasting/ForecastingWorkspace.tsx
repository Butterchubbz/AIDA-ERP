import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageContainer from '../common/PageContainer'
import LoadingSpinner from '../common/LoadingSpinner'
import StatusBadge from '../common/StatusBadge'
import { useForecasting, type ForecastItem } from '../../hooks/useForecasting'
import type { ForecastMode } from '../../lib/vendorConfig'

interface ForecastingWorkspaceProps {
  mode: ForecastMode
  title: string
  icon: string
}

type ViewTab = 'table' | 'grouped' | 'discrepancies'

function confidenceBadge(confidence: ForecastItem['confidence']) {
  if (confidence === 'high') return 'bg-emerald-900/30 text-emerald-300'
  if (confidence === 'medium') return 'bg-blue-900/30 text-blue-300'
  if (confidence === 'low') return 'bg-slate-700 text-slate-300'
  return 'bg-slate-800 text-slate-500'
}

function statusTone(status: ForecastItem['status']): 'danger' | 'warning' | 'neutral' {
  if (status === 'CRITICAL') return 'danger'
  if (status === 'WARNING') return 'warning'
  return 'neutral'
}

function sourceBadge(source: ForecastItem['velocitySource']) {
  if (source === 'sales') return 'S'
  if (source === 'inventory') return 'I'
  return 'C'
}

function depletionClass(weeksRemaining: number | null) {
  if (weeksRemaining === null) return 'text-slate-400'
  if (weeksRemaining < 2) return 'text-red-400'
  if (weeksRemaining <= 4) return 'text-amber-300'
  return 'text-emerald-300'
}

function discrepancyCause(item: ForecastItem) {
  if (item.salesVelocity === null || item.inventoryVelocity === null) {
    return 'Insufficient dual-signal data'
  }

  if (item.inventoryVelocity > item.salesVelocity * 1.25) {
    return 'Inventory drawdown exceeds sales records'
  }

  if (item.salesVelocity > item.inventoryVelocity * 1.25) {
    return 'Sales signal stronger than stock movement'
  }

  return 'Mixed movement patterns'
}

function miniBarColor(stock: number, reorderPoint: number) {
  if (stock < reorderPoint) return '#ef4444'
  if (stock <= reorderPoint * 1.4) return '#f59e0b'
  return '#10b981'
}

export default function ForecastingWorkspace({ mode, title, icon }: ForecastingWorkspaceProps) {
  const {
    forecastItems,
    loading,
    error,
    forecastWindow,
    setForecastWindow,
    acceptSignal,
    clearSignal,
  } = useForecasting({ mode })

  const [tab, setTab] = useState<ViewTab>('table')
  const [selectedSku, setSelectedSku] = useState<string | null>(null)

  const selectedItem = useMemo(() => {
    if (!forecastItems.length) return null
    if (!selectedSku) return forecastItems[0]
    return forecastItems.find(item => item.sku === selectedSku) ?? forecastItems[0]
  }, [forecastItems, selectedSku])

  const summary = useMemo(() => {
    const critical = forecastItems.filter(item => item.status === 'CRITICAL')
    const warning = forecastItems.filter(item => item.status === 'WARNING')
    const avgVelocity =
      forecastItems.length > 0
        ? forecastItems.reduce((sum, item) => sum + item.velocityPerWeek, 0) / forecastItems.length
        : 0
    const fastest = [...forecastItems].sort((a, b) => b.velocityPerWeek - a.velocityPerWeek)[0] ?? null
    return {
      critical,
      warning,
      avgVelocity,
      fastest,
      riskCount: critical.length + warning.length,
    }
  }, [forecastItems])

  const vendorGroups = useMemo(() => {
    const grouped = new Map<string, { vendorName: string; items: ForecastItem[] }>()
    for (const item of forecastItems) {
      if (item.vendorKeys.length === 0) {
        const key = '__unassigned__'
        if (!grouped.has(key)) grouped.set(key, { vendorName: 'Unassigned', items: [] })
        grouped.get(key)!.items.push(item)
        continue
      }

      item.vendorKeys.forEach((vendorKey, index) => {
        if (!grouped.has(vendorKey)) {
          grouped.set(vendorKey, { vendorName: item.vendorNames[index] ?? vendorKey, items: [] })
        }
        grouped.get(vendorKey)!.items.push(item)
      })
    }

    const sorted = [...grouped.entries()]
      .map(([vendorKey, group]) => ({
        vendorKey,
        vendorName: group.vendorName,
        items: group.items,
        criticalCount: group.items.filter(item => item.status === 'CRITICAL').length,
        avgVelocity:
          group.items.reduce((sum, item) => sum + item.velocityPerWeek, 0) / Math.max(1, group.items.length),
      }))
      .sort((a, b) => {
        if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount
        return b.avgVelocity - a.avgVelocity
      })

    const head = sorted.slice(0, 3)
    const tail = sorted.slice(3)
    if (!tail.length) return head

    const otherItems = tail.flatMap(group => group.items)
    head.push({
      vendorKey: 'other-vendors',
      vendorName: 'Other Vendors',
      items: otherItems,
      criticalCount: otherItems.filter(item => item.status === 'CRITICAL').length,
      avgVelocity:
        otherItems.reduce((sum, item) => sum + item.velocityPerWeek, 0) / Math.max(1, otherItems.length),
    })

    return head
  }, [forecastItems])

  const discrepancyItems = useMemo(
    () => forecastItems.filter(item => item.hasDiscrepancy),
    [forecastItems]
  )

  const currentMarkerLabel = useMemo(() => {
    if (!selectedItem) return undefined
    const reversed = [...selectedItem.projection].reverse()
    const latestActual = reversed.find(point => point.actualSales !== null)
    return latestActual?.label
  }, [selectedItem])

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200">
        Failed to load forecasting data: {error}
      </div>
    )
  }

  return (
    <PageContainer title={title} icon={icon}>
      <div className="space-y-4">
        {summary.critical.length > 0 && (
          <div className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-2 text-sm text-red-200">
            ⚠ {summary.critical.length} items require immediate reorder
          </div>
        )}

        {summary.warning.length > 0 && (
          <div className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-4 py-2 text-sm text-amber-200">
            ⚡ {summary.warning.length} items will deplete within 2 weeks
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">Velocity Window</span>
            {[4, 8, 13].map(window => (
              <button
                key={window}
                title="Controls the weekly history span used for velocity calculations"
                onClick={() => setForecastWindow(window as 4 | 8 | 13)}
                className={`rounded-md px-3 py-1 text-sm ${
                  forecastWindow === window
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {window} Weeks
              </button>
            ))}
          </div>

          <Link
            to="/forecasting/settings"
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
          >
            ⚙ Vendor Settings
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Total SKUs</p>
            <p className="mt-1 text-3xl font-semibold text-slate-100">{forecastItems.length}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Avg Velocity</p>
            <p className="mt-1 text-3xl font-semibold text-cyan-300">{summary.avgVelocity.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Items At Risk</p>
            <p className="mt-1 text-3xl font-semibold text-amber-300">{summary.riskCount}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Fastest Moving</p>
            <p className="mt-1 truncate text-lg font-semibold text-emerald-300">
              {summary.fastest?.name ?? 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('table')}
            className={`rounded-md px-3 py-1 text-sm ${tab === 'table' ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            Table View
          </button>
          <button
            onClick={() => setTab('grouped')}
            className={`rounded-md px-3 py-1 text-sm ${tab === 'grouped' ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            Grouped View
          </button>
          <button
            onClick={() => setTab('discrepancies')}
            className={`rounded-md px-3 py-1 text-sm ${tab === 'discrepancies' ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            Discrepancies
          </button>
        </div>

        {tab === 'table' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700 text-sm">
                <thead className="bg-slate-800">
                  <tr>
                    {['Item', 'SKU', 'Vendor', 'VEL/WEEK', 'Stock', 'Depletion', 'Reorder Point', 'Trend', 'Confidence', 'Status'].map(
                      heading => (
                        <th key={heading} className="px-3 py-2 text-left text-xs uppercase text-slate-400">
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {forecastItems.map(item => (
                    <tr
                      key={item.sku}
                      onClick={() => setSelectedSku(item.sku)}
                      className={`cursor-pointer hover:bg-slate-800/80 ${
                        selectedItem?.sku === item.sku ? 'bg-cyan-900/20' : 'bg-slate-900/30'
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-200">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-cyan-300">{item.sku}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {item.vendorNames.length === 0
                          ? '—'
                          : item.vendorNames.length === 1
                            ? item.vendorNames[0]
                            : `${item.vendorNames[0]} +${item.vendorNames.length - 1}`}
                      </td>
                      <td className="px-3 py-2">
                        <div
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                            item.hasDiscrepancy
                              ? 'border-amber-500/60 bg-amber-950/40 text-amber-200'
                              : 'border-slate-600 bg-slate-800 text-slate-200'
                          }`}
                        >
                          <span>{item.velocityPerWeek.toFixed(1)}</span>
                          <span className="rounded bg-slate-700 px-1 text-[10px]">{sourceBadge(item.velocitySource)}</span>
                          {item.hasDiscrepancy ? <span title="Sales and inventory signals diverge">⚠</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">{item.effectiveStock.toFixed(0)}</td>
                      <td className={`px-3 py-2 ${depletionClass(item.weeksRemaining)}`}>
                        {item.weeksRemaining === null ? 'N/A' : `${item.weeksRemaining.toFixed(1)} weeks`}
                      </td>
                      <td
                        className="px-3 py-2 text-slate-200"
                        title={`RP = ceil(${item.velocityPerWeek.toFixed(2)} x ${item.vendorLeadTimeWeeks} x (1 + ${item.vendorSafetyStockPct.toFixed(2)}))`}
                      >
                        {item.reorderPoint}
                      </td>
                      <td className="px-3 py-2 text-slate-300 uppercase">{item.trend}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-1 text-[10px] uppercase ${confidenceBadge(item.confidence)}`}>
                          {item.confidence}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge text={item.status} tone={statusTone(item.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
              <h3 className="mb-3 text-xl font-semibold text-slate-100">
                {selectedItem?.name ?? 'Select an item'}
              </h3>
              {selectedItem ? (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={selectedItem.projection}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                        />
                        <Legend />
                        <ReferenceLine
                          y={selectedItem.reorderPoint}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{ value: `RP ${selectedItem.reorderPoint}`, fill: '#f59e0b', position: 'right' }}
                        />
                        <ReferenceLine
                          x={currentMarkerLabel}
                          stroke="#14b8a6"
                          strokeDasharray="2 2"
                          label={{ value: 'Today', fill: '#14b8a6', position: 'insideTopRight' }}
                        />
                        <Bar dataKey="actualSales" name="Actual Sales" fill="#8b5cf6" />
                        <Line
                          type="monotone"
                          dataKey="projectedSales"
                          name="Projected Velocity"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded bg-slate-950/70 p-3 text-slate-300">
                      <p className="text-xs uppercase text-slate-500">Stock On Hand</p>
                      <p className="text-2xl font-semibold text-slate-100">{selectedItem.currentStock}</p>
                    </div>
                    <div className="rounded bg-slate-950/70 p-3 text-slate-300">
                      <p className="text-xs uppercase text-slate-500">Avg Reorder Point</p>
                      <p className="text-2xl font-semibold text-slate-100">{selectedItem.reorderPoint}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">Select a row from the table to view projection details.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'grouped' && (
          <div className="space-y-4">
            {vendorGroups.map(group => {
              const averageLead =
                group.items.reduce((sum, item) => sum + item.vendorLeadTimeWeeks, 0) /
                Math.max(1, group.items.length)
              const averageSafety =
                group.items.reduce((sum, item) => sum + item.vendorSafetyStockPct, 0) /
                Math.max(1, group.items.length)

              const chartData = group.items.map(item => ({
                name: item.sku,
                stock: item.effectiveStock,
                reorderPoint: item.reorderPoint,
              }))

              return (
                <div key={group.vendorKey} className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="rounded bg-slate-700 px-2 py-1 text-sm text-slate-100">{group.vendorName}</span>
                    <span className="text-xs text-slate-400">SKUs: {group.items.length}</span>
                    <span className="text-xs text-slate-400">Avg Vel: {group.avgVelocity.toFixed(1)}</span>
                    <span className="text-xs text-red-300">Critical: {group.criticalCount}</span>
                    <span className="text-xs text-slate-400">Lead: {averageLead.toFixed(1)}w</span>
                    <span className="text-xs text-slate-400">Safety: {(averageSafety * 100).toFixed(0)}%</span>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto">
                    <div className="h-[280px] min-w-[640px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                          />
                          <Bar dataKey="stock" radius={[4, 4, 4, 4]}>
                            {chartData.map(row => (
                              <Cell key={row.name} fill={miniBarColor(row.stock, row.reorderPoint)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'discrepancies' && (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead className="bg-slate-800">
                <tr>
                  {['Item', 'SKU', 'Sales Vel', 'Inv Vel', 'Diff', '%', 'Likely Cause', 'Action'].map(heading => (
                    <th key={heading} className="px-3 py-2 text-left text-xs uppercase text-slate-400">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {discrepancyItems.map(item => {
                  const sales = item.salesVelocity ?? 0
                  const inventory = item.inventoryVelocity ?? 0
                  const diff = Math.abs(sales - inventory)
                  return (
                    <tr key={item.sku} className="bg-slate-900/30">
                      <td className="px-3 py-2 text-slate-200">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-cyan-300">{item.sku}</td>
                      <td className="px-3 py-2 text-slate-300">{sales.toFixed(1)}</td>
                      <td className="px-3 py-2 text-slate-300">{inventory.toFixed(1)}</td>
                      <td className="px-3 py-2 text-slate-300">{diff.toFixed(1)}</td>
                      <td className="px-3 py-2 text-amber-300">
                        {item.discrepancyPct !== null ? `${(item.discrepancyPct * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{discrepancyCause(item)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={mode === 'device' ? '/inventory/devices' : '/inventory/components'}
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100"
                          >
                            Stock History
                          </Link>
                          <button
                            onClick={() => acceptSignal(item.sku, 'sales')}
                            className="rounded bg-cyan-700 px-2 py-1 text-xs text-white"
                          >
                            Accept Sales
                          </button>
                          <button
                            onClick={() => acceptSignal(item.sku, 'inventory')}
                            className="rounded bg-indigo-700 px-2 py-1 text-xs text-white"
                          >
                            Accept Inventory
                          </button>
                          <button
                            onClick={() => clearSignal(item.sku)}
                            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100"
                          >
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {discrepancyItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                      No discrepancies detected for the current forecast window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
