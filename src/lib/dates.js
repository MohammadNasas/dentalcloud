import { format, formatDistanceToNow, isToday, isTomorrow, isSameDay, parseISO, differenceInCalendarDays } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

const loc = (lang) => (lang === 'ar' ? ar : enUS)

export function fmtDate(iso, lang = 'en') {
  if (!iso) return ''
  try { return format(typeof iso === 'string' ? parseISO(iso) : iso, 'd MMM yyyy', { locale: loc(lang) }) }
  catch { return '' }
}

export function fmtDateLong(iso, lang = 'en') {
  if (!iso) return ''
  try { return format(typeof iso === 'string' ? parseISO(iso) : iso, 'EEEE, d MMMM yyyy', { locale: loc(lang) }) }
  catch { return '' }
}

export function fmtTime(iso, lang = 'en') {
  if (!iso) return ''
  try { return format(typeof iso === 'string' ? parseISO(iso) : iso, 'h:mm a', { locale: loc(lang) }) }
  catch { return '' }
}

export function fmtDateTime(iso, lang = 'en') {
  if (!iso) return ''
  return `${fmtDate(iso, lang)} · ${fmtTime(iso, lang)}`
}

export function dayLabel(iso, lang = 'en', t) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  if (isToday(d)) return t ? t('common.today') : 'Today'
  if (isTomorrow(d)) return t ? t('common.tomorrow') : 'Tomorrow'
  return fmtDate(iso, lang)
}

export { isToday, isTomorrow, isSameDay, parseISO, differenceInCalendarDays, formatDistanceToNow }
