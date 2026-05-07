import type { ReactNode } from 'react'

interface ModalShellProps {
  children: ReactNode
  panelClassName?: string
  backdropClassName?: string
}

export default function ModalShell({
  children,
  panelClassName = 'w-full max-w-3xl rounded-xl border border-slate-600 bg-slate-800 p-6 text-slate-100 shadow-2xl',
  backdropClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4',
}: ModalShellProps) {
  return (
    <div className={backdropClassName}>
      <div className={panelClassName}>{children}</div>
    </div>
  )
}
