export function formatLocalDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString()
}

export function formatLocalDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString()
}
