export const SITE_ORIGIN = 'https://dentalcloudapp.com'
export function pageMetadata({ path = '/', search = '', hash = '', signedIn = false, lang = 'ar' } = {}) {
  const home = (path === '/' || path === '/index.html') && !signedIn && !new URLSearchParams(search).has('demo') && !/access_token|refresh_token|type=recovery/.test(hash)
  const ar = lang === 'ar'
  return {
    indexable: home,
    title: home ? (ar ? 'DentalCloud | برنامج إدارة عيادات الأسنان والمرضى والمواعيد' : 'DentalCloud | Dental Clinic Management Software') : (ar ? 'DentalCloud — حساب العيادة' : 'DentalCloud — Clinic account'),
    description: home ? (ar ? 'DentalCloud برنامج لإدارة عيادات الأسنان بالعربي والإنجليزي: ملفات المرضى، مخطط الأسنان، المواعيد، المدفوعات ومصاريف العيادة، عبر الموقع وتطبيق الكمبيوتر.' : 'Manage dental patient records, tooth charts, appointments, payments and clinic expenses with DentalCloud, in Arabic and English on the web and desktop.') : '',
    canonical: home ? SITE_ORIGIN + '/' : null,
    robots: home ? 'index, follow, max-image-preview:large' : 'noindex, follow',
  }
}
