export const SITE_ORIGIN = 'https://dentalcloudapp.com'
export const HOME_ALTERNATES = { ar: SITE_ORIGIN + '/', en: SITE_ORIGIN + '/en/', 'x-default': SITE_ORIGIN + '/' }
export function landingLanguage(path) {
  if (['/', '/index.html'].includes(path)) return 'ar'
  if (['/en', '/en/', '/en/index.html'].includes(path)) return 'en'
  return null
}
export function pageMetadata({ path = '/', search = '', hash = '', signedIn = false, lang = 'ar' } = {}) {
  const locale = landingLanguage(path)
  const home = Boolean(locale) && !signedIn && !new URLSearchParams(search).has('demo') && !/access_token|refresh_token|type=recovery/.test(hash)
  const ar = (home ? locale : lang) === 'ar'
  return {
    indexable: home,
    title: home ? (ar ? 'دينتال كلاود | برنامج إدارة عيادات الأسنان — DentalCloud' : 'DentalCloud | Dental Clinic Management Software') : (ar ? 'DentalCloud — حساب العيادة' : 'DentalCloud — Clinic account'),
    description: home ? (ar ? 'DentalCloud برنامج لإدارة عيادات الأسنان بالعربي والإنجليزي: ملفات المرضى، مخطط الأسنان، المواعيد، المدفوعات ومصاريف العيادة، عبر الموقع وتطبيق الكمبيوتر.' : 'Manage dental patient records, tooth charts, appointments, payments and clinic expenses with DentalCloud, in Arabic and English on the web and desktop.') : '',
    canonical: home ? HOME_ALTERNATES[locale] : null,
    alternates: home ? HOME_ALTERNATES : {},
    robots: home ? 'index, follow, max-image-preview:large' : 'noindex, follow',
  }
}
