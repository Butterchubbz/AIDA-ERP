interface StatusBadgeProps {
  text: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const toneClassMap: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  neutral: 'border-slate-500/50 bg-slate-700/30 text-slate-200',
  success: 'border-emerald-500/40 bg-emerald-600/20 text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-600/20 text-amber-300',
  danger: 'border-red-500/40 bg-red-600/20 text-red-300',
  info: 'border-blue-500/40 bg-blue-600/20 text-blue-300',
}

export default function StatusBadge({ text, tone = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${toneClassMap[tone]} ${className}`.trim()}
    >
      {text}
    </span>
  )
}
