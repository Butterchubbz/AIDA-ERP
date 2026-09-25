import { useMemo, useState } from 'react'
import { formatLocalDate } from '../utils/date'
import PageContainer from '../components/common/PageContainer'
import { useInboundShipments } from '../hooks/useShippingModules'
import { useForecasting, type ForecastItem } from '../hooks/useForecasting'
import {
  getVendorConfigs,
  generatePONumber,
  getVendorsForSku,
  type ForecastMode,
} from '../lib/vendorConfig'

type OrderRow = {
  mode: ForecastMode
  vendorKey: string
  sku: string
  name: string
  currentStock: number
  inboundQty: number
  velocityPerWeek: number
  leadTimeWeeks: number
  safetyStockPct: number
  reorderPoint: number
  orderQty: number
  covered: boolean
  unit: string
  notes: string
}

type VendorChoice = {
  id: string
  mode: ForecastMode
  vendorKey: string
  name: string
}

const FORECAST_HORIZON_WEEKS = 12

function calculateSuggestedOrder(item: ForecastItem) {
  return Math.max(
    0,
    Math.ceil(
      item.velocityPerWeek * FORECAST_HORIZON_WEEKS +
        item.reorderPoint -
        (item.currentStock + item.inboundQty)
    )
  )
}

function PurchaseOrderView() {
  const { searchSKU } = useInboundShipments()

  const { forecastItems: deviceForecast } = useForecasting({ mode: 'device' })

  const { forecastItems: componentForecast } = useForecasting({ mode: 'component' })

  const merged = useMemo(
    () => [
      ...deviceForecast.map(item => ({ mode: 'device' as const, item })),
      ...componentForecast.map(item => ({ mode: 'component' as const, item })),
    ],
    [deviceForecast, componentForecast]
  )

  const vendorConfigsByMode = useMemo(
    () => ({
      device: getVendorConfigs('device'),
      component: getVendorConfigs('component'),
    }),
    []
  )

  const vendorChoices = useMemo<VendorChoice[]>(() => {
    const device = Object.entries(vendorConfigsByMode.device).map(([vendorKey, cfg]) => ({
      id: `device:${vendorKey}`,
      mode: 'device' as const,
      vendorKey,
      name: `Device - ${cfg.name}`,
    }))
    const component = Object.entries(vendorConfigsByMode.component).map(([vendorKey, cfg]) => ({
      id: `component:${vendorKey}`,
      mode: 'component' as const,
      vendorKey,
      name: `Component - ${cfg.name}`,
    }))
    return [...device, ...component]
  }, [vendorConfigsByMode])

  const [selectedVendorId, setSelectedVendorId] = useState(vendorChoices[0]?.id ?? 'device:other')

  const selectedVendor = useMemo(() => {
    return vendorChoices.find(choice => choice.id === selectedVendorId) ?? vendorChoices[0]
  }, [vendorChoices, selectedVendorId])

  const [poNumber, setPoNumber] = useState(() => {
    const initial = vendorChoices[0]
    if (!initial) return 'PO'
    const cfg = vendorConfigsByMode[initial.mode][initial.vendorKey]
    return generatePONumber(initial.vendorKey, cfg?.name ?? initial.vendorKey, initial.mode)
  })

  const [unitsBySku, setUnitsBySku] = useState<Record<string, string>>({})
  const [notesBySku, setNotesBySku] = useState<Record<string, string>>({})

  const [manualSkuQuery, setManualSkuQuery] = useState('')
  const [manualSkuOptions, setManualSkuOptions] = useState<Array<{ sku: string; name: string }>>([])
  const [manualSku, setManualSku] = useState('')
  const [manualSkuName, setManualSkuName] = useState('')
  const [manualQty, setManualQty] = useState(0)
  const [manualRows, setManualRows] = useState<OrderRow[]>([])

  const regeneratePo = () => {
    if (!selectedVendor) return
    const cfg = vendorConfigsByMode[selectedVendor.mode][selectedVendor.vendorKey]
    setPoNumber(
      generatePONumber(
        selectedVendor.vendorKey,
        cfg?.name ?? selectedVendor.vendorKey,
        selectedVendor.mode
      )
    )
  }

  const baseRows = useMemo(() => {
    if (!selectedVendor) return []
    return merged
      .filter(
        entry =>
          entry.mode === selectedVendor.mode &&
          getVendorsForSku(entry.item.sku, entry.mode).includes(selectedVendor.vendorKey) &&
          (entry.item.status === 'CRITICAL' || entry.item.status === 'WARNING')
      )
      .map(({ item }): OrderRow => {
        const orderQty = calculateSuggestedOrder(item)
        return {
          mode: selectedVendor.mode,
          vendorKey: selectedVendor.vendorKey,
          sku: item.sku,
          name: item.name,
          currentStock: item.currentStock,
          inboundQty: item.inboundQty,
          velocityPerWeek: item.velocityPerWeek,
          leadTimeWeeks: item.vendorLeadTimeWeeks,
          safetyStockPct: item.vendorSafetyStockPct,
          reorderPoint: item.reorderPoint,
          orderQty,
          covered: orderQty === 0,
          unit: unitsBySku[item.sku] ?? '',
          notes: notesBySku[item.sku] ?? '',
        }
      })
  }, [
    merged,
    selectedVendor,
    unitsBySku,
    notesBySku,
  ])

  const orderRows = useMemo(() => [...baseRows, ...manualRows], [baseRows, manualRows])

  const totals = useMemo(() => {
    return {
      lineItems: orderRows.length,
      units: orderRows.reduce((sum, row) => sum + row.orderQty, 0),
    }
  }, [orderRows])

  const handleSkuSearch = async (value: string) => {
    setManualSkuQuery(value)
    if (value.trim().length < 2) {
      setManualSkuOptions([])
      return
    }
    const found = await searchSKU(value)
    setManualSkuOptions(found)
  }

  const addManualItem = () => {
    if (!manualSku || manualQty <= 0) return
    const row: OrderRow = {
      mode: selectedVendor?.mode ?? 'device',
      vendorKey: selectedVendor?.vendorKey ?? 'other',
      sku: manualSku,
      name: manualSkuName || manualSku,
      currentStock: 0,
      inboundQty: 0,
      velocityPerWeek: 0,
      leadTimeWeeks: 0,
      safetyStockPct: 0,
      reorderPoint: manualQty,
      orderQty: manualQty,
      covered: false,
      unit: unitsBySku[manualSku] ?? '',
      notes: notesBySku[manualSku] ?? '',
    }
    setManualRows(prev => [...prev, row])
    setManualSku('')
    setManualSkuName('')
    setManualQty(0)
    setManualSkuQuery('')
    setManualSkuOptions([])
  }

  const exportCsv = () => {
    const header = ['SKU', 'Item Name', 'On Hand', 'Inbound', 'Reorder Point', 'Order Qty', 'Unit', 'Notes']
    const rows = orderRows.map(r => [
      r.sku,
      r.name,
      String(r.currentStock),
      String(r.inboundQty),
      String(r.reorderPoint),
      String(r.orderQty),
      r.unit,
      r.notes,
    ])
    const csv = [header, ...rows]
      .map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedVendor?.id ?? 'vendor'}-${poNumber}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printOrder = () => {
    const vendorName = selectedVendor?.name ?? 'Vendor'
    const rowsHtml = orderRows
      .map(
        r => `
          <tr>
            <td>${r.sku}</td>
            <td>${r.name}</td>
            <td>${r.currentStock}</td>
            <td>${r.orderQty}</td>
            <td>${r.unit}</td>
            <td>${r.notes}</td>
          </tr>
        `
      )
      .join('')

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html>
      <head>
        <title>AIDA Purchase Order</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>AIDA - Purchase Order</h1>
        <p><strong>Vendor:</strong> ${vendorName}</p>
        <p><strong>Date:</strong> ${formatLocalDate(new Date())}</p>
        <p><strong>PO Number:</strong> ${poNumber}</p>
        <table>
          <thead>
            <tr>
              <th>SKU</th><th>Name</th><th>On Hand</th><th>Order Qty</th><th>Unit</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin-top: 16px;"><strong>Total units:</strong> ${totals.units}</p>
        <p style="margin-top: 32px;">Confirmed by: ___________</p>
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <PageContainer title="Purchase Orders" icon="fas fa-file-invoice-dollar">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Vendor</label>
          <select
            className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600"
            value={selectedVendorId}
            onChange={e => {
              const next = vendorChoices.find(choice => choice.id === e.target.value)
              setSelectedVendorId(e.target.value)
              if (next) {
                const cfg = vendorConfigsByMode[next.mode][next.vendorKey]
                setPoNumber(generatePONumber(next.vendorKey, cfg?.name ?? next.vendorKey, next.mode))
              }
            }}
          >
            {vendorChoices.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">PO Number</label>
          <div className="flex gap-2">
            <input
              value={poNumber}
              onChange={e => setPoNumber(e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-slate-700 border border-slate-600"
            />
            <button onClick={regeneratePo} className="px-3 py-2 rounded bg-slate-700" title="Regenerate">
              ↺
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button onClick={printOrder} className="px-3 py-2 rounded bg-cyan-600 text-white">
            Print This Order
          </button>
          <button onClick={exportCsv} className="px-3 py-2 rounded bg-blue-600 text-white">
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">SKU</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Item Name</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">On Hand</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Inbound</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Vel/Wk</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Reorder Point</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Order Qty</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Unit</th>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-300">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {orderRows.map(row => (
              <tr key={`${row.sku}-${row.name}`} className={row.covered ? 'bg-slate-700/30' : ''}>
                <td className="px-3 py-2 font-mono text-cyan-300 text-sm">{row.sku}</td>
                <td className="px-3 py-2 text-sm text-slate-200">
                  {row.name}
                  {row.covered && (
                    <span className="ml-2 px-2 py-0.5 text-[10px] rounded bg-slate-600 text-slate-300">
                      Covered
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-slate-300">{row.currentStock}</td>
                <td className="px-3 py-2 text-sm text-slate-300">{row.inboundQty}</td>
                <td className="px-3 py-2 text-sm text-slate-300">{row.velocityPerWeek.toFixed(1)}</td>
                <td className="px-3 py-2 text-sm text-slate-300">{row.reorderPoint}</td>
                <td
                  className="px-3 py-2 text-sm text-slate-200 font-semibold"
                  title={`ceil((${row.velocityPerWeek.toFixed(2)} x ${FORECAST_HORIZON_WEEKS}) + ${row.reorderPoint} - (${row.currentStock} + ${row.inboundQty}))`}
                >
                  {row.orderQty}
                </td>
                <td className="px-3 py-2 text-sm">
                  <input
                    value={unitsBySku[row.sku] ?? row.unit}
                    onChange={e => setUnitsBySku(prev => ({ ...prev, [row.sku]: e.target.value }))}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-600"
                  />
                </td>
                <td className="px-3 py-2 text-sm">
                  <input
                    value={notesBySku[row.sku] ?? row.notes}
                    onChange={e => setNotesBySku(prev => ({ ...prev, [row.sku]: e.target.value }))}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-600"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-700/40 rounded p-4 mb-4">
        <h4 className="text-sm font-semibold text-cyan-300 mb-2">Manual Add</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="md:col-span-2 relative">
            <input
              value={manualSkuQuery}
              onChange={e => handleSkuSearch(e.target.value)}
              placeholder="Search SKU"
              className="w-full px-2 py-2 rounded bg-slate-800 border border-slate-600"
            />
            {manualSkuOptions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-700 rounded max-h-40 overflow-y-auto">
                {manualSkuOptions.map(opt => (
                  <li
                    key={`${opt.sku}-${opt.name}`}
                    className="px-2 py-2 hover:bg-slate-700 cursor-pointer"
                    onClick={() => {
                      setManualSku(opt.sku)
                      setManualSkuName(opt.name)
                      setManualSkuQuery(`${opt.sku} - ${opt.name}`)
                      setManualSkuOptions([])
                    }}
                  >
                    <span className="font-mono text-cyan-300">{opt.sku}</span>
                    <span className="ml-2 text-slate-400 text-sm">{opt.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="number"
            min={0}
            value={manualQty}
            onChange={e => setManualQty(Number(e.target.value) || 0)}
            className="px-2 py-2 rounded bg-slate-800 border border-slate-600"
            placeholder="Qty"
          />
          <button onClick={addManualItem} className="px-3 py-2 rounded bg-green-600 text-white">
            Add
          </button>
        </div>
      </div>

      <div className="text-sm text-slate-300">
        Total line items: <span className="font-semibold">{totals.lineItems}</span> | Total units to order:{' '}
        <span className="font-semibold text-cyan-300">{totals.units}</span>
      </div>
    </PageContainer>
  )
}

export default PurchaseOrderView
