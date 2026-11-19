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
export function loyaltyWhatsAppMessage({ lang = 'ar', patientName = '', clinicName = '', url }) {
  if (!url) return ''
  return (lang === 'ar'
    ? [patientName ? `مرحباً ${patientName}،` : 'مرحباً،',
      clinicName ? `هذه بطاقة الولاء الخاصة بك من ${clinicName}.` : 'هذه بطاقة الولاء الخاصة بك.',
      'افتح الرابط لمتابعة زياراتك ومعرفة كم زيارة تبقّت لمكافأتك، بدون تسجيل دخول:', url,
      'احتفظ بالرابط للرجوع إلى بطاقتك بعد كل زيارة.']
    : [patientName ? `Hi ${patientName},` : 'Hello,',
      clinicName ? `Here is your loyalty card from ${clinicName}.` : 'Here is your loyalty card.',
      'Open the link to track your visits and see how many remain until your reward. No sign-in needed:', url,
      'Save this link to check your card after each visit.']).join('\n\n')
}
export function upcomingReminders(appointments, now = Date.now(), hours = 24) {
  return appointments.filter(a => a.status === 'scheduled' && Date.parse(a.start) > now
    && Date.parse(a.start) <= now + hours * 3600000).sort((a,b) => a.start.localeCompare(b.start))
}
