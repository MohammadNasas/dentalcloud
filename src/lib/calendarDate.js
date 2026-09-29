// Calendar dates stay local strings; never round-trip a birthday through UTC.
export function calendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && calendarDate(date) === value ? date : null
}

export function calendarDays(year, month) {
  const first = new Date(year, month, 1, 12)
  const count = Math.ceil((first.getDay() + new Date(year, month + 1, 0).getDate()) / 7) * 7
  return Array.from({ length: count }, (_, i) => new Date(year, month, 1 - first.getDay() + i, 12))
}
