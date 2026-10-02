export const NEW_SITE_URL = 'https://dentalcloudapp.com'

export function shouldShowSiteMigration(location, desktop = false) {
  if (desktop || location.protocol !== 'https:' || location.hostname !== 'dentalcloud.pages.dev') return false
  const query = new URLSearchParams(location.search || '')
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''))
  const legacyQuery = location.hash?.startsWith('#/')
    ? new URL(location.hash.slice(1), 'https://routing.invalid').searchParams : new URLSearchParams()
  // Finish payment/authentication flows on the origin where they began.
  if (['paypal', 'code', 'token_hash', 'error', 'error_code'].some(key => query.has(key))) return false
  if (['paypal', 'code', 'token_hash', 'error', 'error_code'].some(key => legacyQuery.has(key))) return false
  if (['access_token', 'refresh_token', 'type', 'error', 'error_code'].some(key => hash.has(key))) return false
  if (/^\/(api\/|auth\/callback|reset-password)/.test(location.pathname || '')) return false
  return true
}
