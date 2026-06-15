// DentalCloud service worker — makes the web app installable + offline-capable.
// Strategy: navigations are network-first (you always get the latest app when
// online, cached shell when offline); static assets are stale-while-revalidate.
// Vite content-hashes asset filenames, so cached assets never shadow a new build.
const CACHE = 'dentalcloud-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only handle our own origin; let Supabase, payment APIs and fonts hit network.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put(req, fresh.clone())
        return fresh
      } catch {
        const cache = await caches.open(CACHE)
        return (await cache.match(req)) || (await cache.match('/')) || Response.error()
      }
    })())
    return
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    const network = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    }).catch(() => null)
    return cached || (await network) || Response.error()
  })())
})
