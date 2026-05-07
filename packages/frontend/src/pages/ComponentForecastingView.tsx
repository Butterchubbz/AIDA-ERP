import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageContainer from '../components/common/PageContainer'
import LoadingSpinner from '../components/common/LoadingSpinner'
import StatusBadge from '../components/common/StatusBadge'
import { useForecasting, type ForecastItem } from '../hooks/useForecasting'

type ViewTab = 'table' | 'grouped' | 'discrepancies'

function sourceBadgeClass(source: ForecastItem['velocitySource']) {
  if (source === 'sales') return 'bg-slate-600 text-slate-200'
  if (source === 'inventory') return 'bg-blue-800 text-blue-200'
  return 'bg-cyan-800 text-cyan-200'
}

function sourceBadgeLabel(source: ForecastItem['velocitySource']) {
  if (source === 'sales') return 'S'
  if (source === 'inventory') return 'I'
  return 'C'
}

function depletionText(weeksRemaining: number | null) {
  if (weeksRemaining === null) return '∞'
  return `${Math.ceil(weeksRemaining)}w`
}

function depletionClass(weeksRemaining: number | null) {
  if (weeksRemaining === null) return 'text-slate-400'
  if (weeksRemaining < 2) return 'text-red-400 font-semibold'
  if (weeksRemaining <= 4) return 'text-amber-300'
  return 'text-emerald-300'
}

function TrendArrow({ trend }: { trend: ForecastItem['trend'] }) {
  if (trend === 'up') return <span className="text-emerald-400 font-bold">↑</span>
  if (trend === 'down') return <span className="text-red-400 font-bold">↓</span>
  return <span className="text-slate-400">→</span>
}

function confidenceBadgeClass(confidence: ForecastItem['confidence']) {
  if (confidence === 'high') return 'bg-emerald-900/40 text-emerald-300'
  if (confidence === 'medium') return 'bg-amber-900/40 text-amber-300'
  if (confidence === 'low') return 'bg-slate-700 text-slate-300'
  return 'bg-slate-800 text-slate-500'
}

function statusTone(status: ForecastItem['status']): 'danger' | 'warning' | 'neutral' {
  if (status === 'CRITICAL') return 'danger'
  if (status === 'WARNING') return 'warning'
  return 'neutral'
}

const VENDOR_BADGE_CLASSES = [
  'bg-violet-800/60 text-violet-200',
  'bg-indigo-800/60 text-indigo-200',
  'bg-cyan-800/60 text-cyan-200',
  'bg-emerald-800/60 text-emerald-200',
  'bg-rose-800/60 text-rose-200',
  'bg-amber-800/60 text-amber-200',
]

function vendorBadgeClass(vendorKey: string) {
  const hash = [...vendorKey].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return VENDOR_BADGE_CLASSES[hash % VENDOR_BADGE_CLASSES.length]
}

function miniBarColor(stock: number, reorderPoint: number) {
  if (stock < reorderPoint) return '#ef4444'
  if (stock <= reorderPoint * 1.5) return '#f59e0b'
  return '#10b981'
}

function discrepancyCause(item: ForecastItem): string {
  if (item.inventoryVelocity === null) return 'No stock history for this SKU'
  if (item.salesVelocity === null) return 'No sales data for this SKU'
  if (item.salesVelocity > item.inventoryVelocity * 1.2) return 'Possible unrecorded stock adjustment'
  if (item.inventoryVelocity > item.salesVelocity * 1.2) return 'Possible unrecorded sales or stock loss'
  return 'Mixed movement patterns'
}

export default function ComponentForecastingView() {
  const {
    forecastItems,
    loading,
    error,
    forecastWindow,
    setForecastWindow,
    acceptSignal,
    clearSignal,
  } = useForecasting({ mode: 'component' })

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
    const fastest =
      [...forecastItems].sort((a, b) => b.velocityPerWeek - a.velocityPerWeek)[0] ?? null
    return { critical, warning, avgVelocity, fastest, riskCount: critical.length + warning.length }
  }, [forecastItems])

  const vendorGroups = useMemo(() => {
    const grouped = new Map<string, { vendorName: string; items: ForecastItem[]; isUnassigned: boolean }>()
    for (const item of forecastItems) {
      if (item.vendorKeys.length === 0) {
        const key = '__unassigned__'
        if (!grouped.has(key)) {
          grouped.set(key, { vendorName: 'Unassigned', items: [], isUnassigned: true })
        }
        grouped.get(key)!.items.push(item)
        continue
      }

      item.vendorKeys.forEach((vendorKey, index) => {
        if (!grouped.has(vendorKey)) {
          grouped.set(vendorKey, {
            vendorName: item.vendorNames[index] ?? vendorKey,
            items: [],
            isUnassigned: false,
          })
        }
        grouped.get(vendorKey)!.items.push(item)
      })
    }
    return [...grouped.entries()]
      .map(([vendorKey, group]) => ({
        vendorKey,
        vendorName: group.vendorName,
        items: group.items,
        isUnassigned: group.isUnassigned,
        criticalCount: group.items.filter(i => i.status === 'CRITICAL').length,
        avgVelocity:
          group.items.reduce((s, i) => s + i.velocityPerWeek, 0) / Math.max(1, group.items.length),
      }))
      .sort((a, b) => {
        if (a.isUnassigned !== b.isUnassigned) {
          return a.isUnassigned ? 1 : -1
        }
        return b.criticalCount - a.criticalCount || b.avgVelocity - a.avgVelocity
      })
  }, [forecastItems])

  const discrepancyItems = useMemo(
    () => forecastItems.filter(item => item.hasDiscrepancy),
    [forecastItems]
  )

  const currentMarkerLabel = useMemo(() => {
    if (!selectedItem) return undefined
    const reversed = [...selectedItem.projection].reverse()
    return reversed.find(p => p.actualSales !== null)?.label
  }, [selectedItem])

  if (loading) return <LoadingSpinner />

  if (error)
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200">
        Failed to load forecasting data: {error}
      </div>
    )

  return (
    <PageContainer title="Component Forecasting" icon="fas fa-microchip">
      <div className="space-y-4">
        {/* Alert Banner */}
        {summary.critical.length > 0 && (
          <div className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-2 text-sm text-red-200">
            ⚠ {summary.critical.length} items require immediate reorder:{' '}
            <span className="font-medium">{summary.critical.map(i => i.name).join(', ')}</span>
          </div>
        )}

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Velocity Window</span>
            {([4, 8, 13] as const).map(w => (
              <button
                key={w}
                onClick={() => setForecastWindow(w)}
                className={`rounded px-3 py-1 text-sm ${
                  forecastWindow === w
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {w === 4 ? '4 Weeks' : w === 8 ? '8 Weeks' : '13 Weeks'}
              </button>
            ))}
          </div>
          <Link
            to="/forecasting/settings"
            className="rounded border border-slate-600 bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700"
          >
            ⚙ Vendor Settings
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Total SKUs</p>
            <p className="mt-1 text-3xl font-semibold text-slate-100">{forecastItems.length}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Avg Velocity</p>
            <p className="mt-1 text-3xl font-semibold text-cyan-300">
              {summary.avgVelocity.toFixed(1)} <span className="text-sm">u/w</span>
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">At Risk</p>
            <p className="mt-1 text-3xl font-semibold text-amber-300">{summary.riskCount}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase text-slate-400">Fastest Mover</p>
            <p className="mt-1 truncate text-lg font-semibold text-emerald-300">
              {summary.fastest?.name ?? 'N/A'}
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2">
          {(['table', 'grouped', 'discrepancies'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-sm ${
                tab === t ? 'bg-fuchsia-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {t === 'table' ? 'Table View' : t === 'grouped' ? 'Grouped View' : 'Discrepancies'}
            </button>
          ))}
        </div>

        {/* ── TABLE VIEW ── */}
        {tab === 'table' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700 text-sm">
                <thead className="bg-slate-800">
                  <tr>
                    {[
                      'Item',
                      'Vendor',
                      'Vel/Week',
                      'Stock',
                      'Depletion',
                      'Reorder Pt',
                      'Trend',
                      'Conf.',
                      'Status',
                    ].map(h => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs uppercase text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {forecastItems.map(item => (
                    <tr
                      key={item.sku}
                      onClick={() => setSelectedSku(item.sku)}
                      className={`cursor-pointer ${
                        selectedItem?.sku === item.sku
                          ? 'bg-cyan-900/20'
                          : 'bg-slate-900/30 hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-200">{item.name}</td>
                      <td className="px-3 py-2">
                        {item.vendorKeys.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span
                              className={`rounded px-2 py-0.5 text-xs ${vendorBadgeClass(item.vendorKeys[0])}`}
                            >
                              {item.vendorNames[0] ?? item.vendorKeys[0]}
                            </span>
                            {item.vendorKeys.length > 1 && (
                              <span className="rounded px-2 py-0.5 text-xs bg-slate-700 text-slate-300">
                                +{item.vendorKeys.length - 1}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-1">
                          <span className="text-cyan-300">
                            {item.velocityPerWeek.toFixed(1)}
                          </span>
                          <span
                            className={`rounded px-1 text-[10px] ${
                              sourceBadgeClass(item.velocitySource)
                            }`}
                          >
                            {sourceBadgeLabel(item.velocitySource)}
                          </span>
                          {item.hasDiscrepancy && (
                            <span
                              className="text-xs text-amber-400"
                              title="Sales and inventory signals diverge"
                            >
                              ⚠
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {item.currentStock}
                        {item.inboundQty > 0 && (
                          <span className="ml-1 text-xs text-cyan-400">+{item.inboundQty}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 ${depletionClass(item.weeksRemaining)}`}>
                        {depletionText(item.weeksRemaining)}
                      </td>
                      <td
                        className="px-3 py-2 text-xs italic text-slate-400"
                        title="RP = ceil(velocity × leadTimeWeeks × (1 + safetyPct))"
                      >
                        {item.reorderPoint}
                      </td>
                      <td className="px-3 py-2">
                        <TrendArrow trend={item.trend} />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                            confidenceBadgeClass(item.confidence)
                          }`}
                        >
                          {item.confidence}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge text={item.status} tone={statusTone(item.status)} />
                      </td>
                    </tr>
                  ))}
                  {forecastItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-8 text-center text-sm text-slate-500"
                      >
                        No component SKUs found. Add component inventory items to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Detail Panel */}
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
              {selectedItem ? (
                <>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">
                        {selectedItem.name}
                      </h3>
                      <p className="font-mono text-xs text-cyan-400">{selectedItem.sku}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs uppercase ${
                        confidenceBadgeClass(selectedItem.confidence)
                      }`}
                    >
                      {selectedItem.confidence}
                    </span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={selectedItem.projection}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey="label"
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                          }}
                        />
                        <ReferenceLine
                          y={selectedItem.reorderPoint}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{
                            value: `RP ${selectedItem.reorderPoint}`,
                            fill: '#f59e0b',
                            fontSize: 10,
                            position: 'right',
                          }}
                        />
                        <ReferenceLine
                          x={currentMarkerLabel}
                          stroke="#14b8a6"
                          strokeDasharray="2 2"
                          label={{
                            value: 'Now',
                            fill: '#14b8a6',
                            fontSize: 10,
                            position: 'insideTopRight',
                          }}
                        />
                        <Bar dataKey="actualSales" name="Actual Sales" fill="#6366f1" />
                        <Line
                          type="monotone"
                          dataKey="projectedSales"
                          name="Projected"
                          stroke="#a3e635"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded bg-slate-950/70 p-3">
                      <p className="text-xs uppercase text-slate-500">Stock on Hand</p>
                      <p className="text-2xl font-semibold text-slate-100">
                        {selectedItem.currentStock}
                      </p>
                    </div>
                    <div className="rounded bg-slate-950/70 p-3">
                      <p className="text-xs uppercase text-slate-500">Reorder Point</p>
                      <p className="text-2xl font-semibold text-slate-100">
                        {selectedItem.reorderPoint}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Click a row to view projection details.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── GROUPED VIEW ── */}
        {tab === 'grouped' && (
          <div className="space-y-4">
            {vendorGroups.map(group => {
              const avgLead =
                group.items.reduce((s, i) => s + i.vendorLeadTimeWeeks, 0) /
                Math.max(1, group.items.length)
              const avgSafety =
                group.items.reduce((s, i) => s + i.vendorSafetyStockPct, 0) /
                Math.max(1, group.items.length)
              const chartData = group.items.map(i => ({
                name: i.sku,
                stock: i.effectiveStock,
                reorderPoint: i.reorderPoint,
              }))
              return (
                <div
                  key={group.vendorKey}
                  className="rounded-lg border border-slate-700 bg-slate-900/40 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded px-2 py-1 text-sm font-medium ${
                        vendorBadgeClass(group.vendorKey)
                      }`}
                    >
                      {group.vendorName}
                    </span>
                    <span className="text-xs text-slate-400">SKUs: {group.items.length}</span>
                    <span className="text-xs text-slate-400">
                      Avg Vel: {group.avgVelocity.toFixed(1)} u/w
                    </span>
                    {group.criticalCount > 0 && (
                      <span className="text-xs font-semibold text-red-300">
                        Critical: {group.criticalCount}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      Lead: {avgLead.toFixed(1)}w
                    </span>
                    <span className="text-xs text-slate-400">
                      Safety: {(avgSafety * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-48 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 10, right: 20, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          stroke="#94a3b8"
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                          }}
                        />
                        <Bar dataKey="stock" name="Stock" radius={[0, 4, 4, 0]}>
                          {chartData.map(row => (
                            <Cell
                              key={row.name}
                              fill={miniBarColor(row.stock, row.reorderPoint)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
            {vendorGroups.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-8">
                No vendor groups available yet.
              </p>
            )}
          </div>
        )}

        {/* ── DISCREPANCIES TAB ── */}
        {tab === 'discrepancies' && (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead className="bg-slate-800">
                <tr>
                  {[
                    'Item',
                    'SKU',
                    'Sales Vel',
                    'Inventory Vel',
                    'Diff %',
                    'Likely Cause',
                    'Action',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs uppercase text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {discrepancyItems.map(item => (
                  <tr key={item.sku} className="bg-slate-900/30">
                    <td className="px-3 py-2 text-slate-200">{item.name}</td>
                    <td className="px-3 py-2 font-mono text-cyan-300">{item.sku}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {item.salesVelocity?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {item.inventoryVelocity?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-amber-300">
                      {item.discrepancyPct !== null
                        ? `${(item.discrepancyPct * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300">
                      {discrepancyCause(item)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => acceptSignal(item.sku, 'sales')}
                          className="rounded bg-cyan-700 px-2 py-1 text-xs text-white hover:bg-cyan-600"
                        >
                          Accept Sales
                        </button>
                        <button
                          onClick={() => acceptSignal(item.sku, 'inventory')}
                          className="rounded bg-indigo-700 px-2 py-1 text-xs text-white hover:bg-indigo-600"
                        >
                          Accept Inventory
                        </button>
                        <button
                          onClick={() => clearSignal(item.sku)}
                          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {discrepancyItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm text-slate-500"
                    >
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
