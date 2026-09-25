export function formatLocalDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString()
}

export function formatLocalDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString()
}

export function formatISODate(value: string | number | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toISOString().slice(0, 10)
}

export function formatISODateTime(value: string | number | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toISOString()
}

export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function parseISODate(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
