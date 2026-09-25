export type IndicatorState = 'idle' | 'running' | 'success' | 'error'

interface StatusIndicatorProps {
  label: string
  state: IndicatorState
  detail?: string
}

const stateClasses: Record<IndicatorState, string> = {
  idle: 'bg-slate-500',
  running: 'bg-amber-400',
  success: 'bg-emerald-400',
  error: 'bg-rose-400',
}

const stateLabels: Record<IndicatorState, string> = {
  idle: 'Idle',
  running: 'Working',
  success: 'Ready',
  error: 'Issue',
}

export default function StatusIndicator({ label, state, detail }: StatusIndicatorProps) {
  return (
    <div className="rounded-md border border-slate-600 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${stateClasses[state]}`} aria-hidden="true" />
          <span className="text-sm font-medium text-slate-100">{label}</span>
        </div>
        <span className="text-xs uppercase tracking-wide text-slate-300">{stateLabels[state]}</span>
      </div>
      {detail ? <p className="mt-2 text-xs text-slate-300">{detail}</p> : null}
    </div>
  )
}
