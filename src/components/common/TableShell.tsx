import type { ReactNode } from 'react'

interface TableShellProps {
  children: ReactNode
  wrapperClassName?: string
  tableClassName?: string
}

export default function TableShell({
  children,
  wrapperClassName = 'overflow-x-auto rounded-lg border border-slate-700',
  tableClassName = 'min-w-full divide-y divide-slate-700 text-sm',
}: TableShellProps) {
  return (
    <div className={wrapperClassName}>
      <table className={tableClassName}>{children}</table>
    </div>
  )
}
