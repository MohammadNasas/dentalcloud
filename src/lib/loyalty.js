export const DEMO_LOYALTY_TOKEN = 'a'.repeat(64)
export const LOYALTY_CATEGORIES = [
  { value: 'general', ar: 'زيارة عامة', en: 'General visit' },
  { value: 'treatment', ar: 'جلسة علاج', en: 'Treatment' },
  { value: 'checkup', ar: 'فحص ومراجعة', en: 'Check-up' },
]
export function loyaltyProgress(card) {
  const target = Math.min(20, Math.max(1, Number(card?.target) || 5))
  const visits = Math.max(0, Number(card?.visits) || 0)
  return { target, visits, filled: Math.min(target, visits), remaining: Math.max(0, target - visits), ready: visits >= target }
}
export function loyaltyLink(token, origin = 'https://dentalcloudapp.com') {
  if (!/^[a-f0-9]{64}$/.test(token || '')) return ''
  // Tokens stay in the fragment, outside HTTP logs and Referer headers.
  return origin.replace(/\/$/, '') + '/loyalty#' + token
}
export function upcomingReminders(appointments, now = Date.now(), hours = 24) {
  return appointments.filter(a => a.status === 'scheduled' && Date.parse(a.start) > now
    && Date.parse(a.start) <= now + hours * 3600000).sort((a,b) => a.start.localeCompare(b.start))
}
