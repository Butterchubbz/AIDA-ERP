interface StockBarProps {
  stock: number
  threshold: number
}

export default function StockBar({ stock, threshold }: StockBarProps) {
  const t = threshold > 0 ? threshold : 10
  const pct = Math.min(100, (stock / (t * 6)) * 100)

  const color =
    stock === 0 || stock < t
      ? 'bg-red-500'
      : stock < t * 3
        ? 'bg-yellow-400'
        : 'bg-emerald-500'

  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
