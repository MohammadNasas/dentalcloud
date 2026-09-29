// Only migrate old app routes. Supabase's #access_token=... callback must stay intact.
export function legacyWebRoute({ pathname, search = '', hash = '' }) {
  if (pathname !== '/' && pathname !== '/index.html') return null
  if (!hash.startsWith('#/') || hash.startsWith('#//') || hash.includes('\\')) return null
  const route = new URL(hash.slice(1), 'https://routing.invalid')
  const query = new URLSearchParams(search)
  for (const [key, value] of route.searchParams) query.set(key, value)
  return route.pathname + (query.size ? `?${query}` : '') + route.hash
}

export function postLoginPath(from) {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return '/'
  const path = from.split(/[?#]/)[0].replace(/\/+$/, '')
  return path === '/login' || path === '/register' ? '/' : from
}

export function passwordResetRedirect(location) {
  // Keep the already-configured root callback instead of introducing /login into
  // Supabase's redirect allowlist. The PASSWORD_RECOVERY event selects the form.
  return /^https?:$/.test(location.protocol) ? `${location.origin}/` : location.origin + location.pathname
}
