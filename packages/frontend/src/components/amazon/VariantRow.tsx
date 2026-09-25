import StockBar from './StockBar'
import type { AmazonVariantFull } from '../../hooks/useAmazonDevices'

interface VariantRowProps {
  variant: AmazonVariantFull
}

export default function VariantRow({ variant }: VariantRowProps) {
  const threshold = variant.lowStockThreshold ?? 10

  const statusLabel =
    variant.fbaStock === 0
      ? 'Out of stock'
      : variant.fbaStock < threshold
        ? 'Low stock'
        : variant.fbaStock < threshold * 3
          ? 'Warning'
          : 'In stock'

  const statusColor =
    variant.fbaStock === 0 || variant.fbaStock < threshold
      ? 'text-red-400'
      : variant.fbaStock < threshold * 3
        ? 'text-yellow-400'
        : 'text-emerald-400'

  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{variant.label}</p>
          <p className="font-mono text-xs text-slate-400">{variant.sku}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>
      <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
        <span>
          Stock:{' '}
          <span className="font-semibold text-slate-200">{variant.fbaStock}</span>
        </span>
        {variant.inboundQty > 0 && (
          <span>
            Inbound:{' '}
            <span className="font-semibold text-yellow-300">+{variant.inboundQty}</span>
          </span>
        )}
        {variant.asin && (
          <span className="font-mono text-slate-500">{variant.asin}</span>
        )}
      </div>
      <StockBar stock={variant.fbaStock} threshold={threshold} />
    </div>
  )
}
