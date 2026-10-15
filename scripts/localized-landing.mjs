import { pageMetadata, HOME_ALTERNATES } from '../src/lib/seo.js'

// Both entry points share the same app and HTML shell. Language metadata is
// emitted at build time so crawlers do not need JavaScript to discover it.
export function localizedLandingHtml(html, lang) {
  const meta = pageMetadata({ path: lang === 'en' ? '/en/' : '/' })
  const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  html = html.replace(/<html[^>]*>/, `<html lang="${lang}" dir="${lang === 'en' ? 'ltr' : 'rtl'}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${meta.canonical}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(meta.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(meta.description)}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${meta.canonical}" />`)
    .replace(/\s*<link rel="alternate"[^>]*hreflang[^>]*>/g, '')
  const alternatives = Object.entries(HOME_ALTERNATES).map(([language, href]) =>
    `    <link rel="alternate" hreflang="${language}" href="${href}" />`).join('\n')
  html = html.replace('</head>', `${alternatives}\n  </head>`)
  if (lang === 'en') {
    html = html.replace(/<noscript>.*?<\/noscript>/s, '<noscript><main dir="ltr" style="max-width:800px;margin:40px auto;padding:24px;font-family:Arial,sans-serif;line-height:1.9"><h1>DentalCloud — Dental Clinic Management Software</h1><p>Manage dental patient records, tooth charts, appointments, payments and clinic expenses in Arabic and English on the web and desktop. Enable JavaScript to use the application.</p><p><a href="/en/#landing-features">Explore features</a> · <a href="/en/#landing-pricing">Plans and pricing</a> · <a href="/" lang="ar">العربية</a></p></main></noscript>')
  }
  return html
}
