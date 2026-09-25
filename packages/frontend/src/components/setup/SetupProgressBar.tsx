interface SetupProgressBarProps {
  steps: string[]
  currentStep: number
}

export default function SetupProgressBar({ steps, currentStep }: SetupProgressBarProps) {
  const percentage = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="space-y-3">
      <div className="h-2 w-full rounded-full bg-slate-700">
        <div
          className="h-2 rounded-full bg-cyan-400 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <ol className="grid grid-cols-1 gap-2 text-sm text-slate-300 md:grid-cols-5">
        {steps.map((step, index) => {
          const active = index === currentStep
          const complete = index < currentStep

          return (
            <li
              key={step}
              className={`rounded-md border px-2 py-1 ${
                active
                  ? 'border-cyan-300 bg-cyan-900/40 text-cyan-200'
                  : complete
                    ? 'border-emerald-300 bg-emerald-900/30 text-emerald-200'
                    : 'border-slate-600 bg-slate-800 text-slate-300'
              }`}
            >
              <span className="font-semibold">{index + 1}.</span> {step}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
