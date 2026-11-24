// DentalCloud service worker — makes the web app installable + offline-capable.
// Strategy: navigations are network-first (you always get the latest app when
// online, cached shell when offline); static assets are stale-while-revalidate.
// Vite content-hashes asset filenames, so cached assets never shadow a new build.
const CACHE = 'dentalcloud-v2'

// Removed hashed chunks can receive the SPA's HTML fallback after deployment.
// Never retain that HTML under a JS/CSS URL, or retries keep failing offline too.
function validAsset(url, response) {
  if (!response || response.status !== 200) return false
  const type = response.headers.get('content-type') || ''
  if (/\.(?:m?js)$/i.test(url.pathname)) return /(?:javascript|ecmascript)/i.test(type)
  if (/\.css$/i.test(url.pathname)) return /text\/css/i.test(type)
  return true
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('push', e => {
  e.waitUntil((async()=>{
    let data={}
    try { data=e.data?.json() || {} } catch {}
    let url='/loyalty'
    try { const u=new URL(data.url,self.location.origin); if(u.origin===self.location.origin && u.pathname==='/loyalty') url=u.href } catch {}
    let body=String(data.body || 'افتح بطاقة زياراتك للاطلاع على التذكير.').slice(0,300)
    if (data.appointmentStart && Number.isFinite(Date.parse(data.appointmentStart))) {
      body+=' '+new Date(data.appointmentStart).toLocaleString(data.lang==='en'?'en-GB':'ar',{dateStyle:'medium',timeStyle:'short'})
    }
    await self.registration.showNotification('DentalCloud',{body,icon:'/icon-192.png',badge:'/icon-192.png',
      tag:String(data.tag || 'dentalcloud-reminder'),data:{url}})
  })())
})
self.addEventListener('notificationclick',e=>{
  e.notification.close()
  e.waitUntil((async()=>{
    const target=new URL(e.notification.data?.url || '/loyalty',self.location.origin)
    if(target.origin!==self.location.origin || target.pathname!=='/loyalty') return
    const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true})
    const existing=tabs.find(tab=>tab.url===target.href)
    if(existing) await existing.focus()
    else await self.clients.openWindow(target.href)
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('dentalcloud-') && k !== CACHE).map((k) => caches.delete(k)))
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
  if (url.pathname === '/loyalty' || url.pathname.startsWith('/loyalty/')) return
  // Let the browser handle media byte ranges; a cached full response breaks seeking.
  if (req.headers.has('range') || /\.(mp4|webm)$/i.test(url.pathname)) return

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        // A previous deployment returned permanent redirects for app routes.
        // Bypass the HTTP redirect cache as well as the offline shell cache.
        const fresh = await fetch(req, { cache: 'reload' })
        const cache = await caches.open(CACHE)
        if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {})
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
    let cached = await cache.match(req)
    if (cached && !validAsset(url, cached)) {
      await cache.delete(req)
      cached = undefined
    }
    const network = fetch(req).then((res) => {
      if (validAsset(url, res)) cache.put(req, res.clone()).catch(() => {})
      return res
    }).catch(() => null)
    return cached || (await network) || Response.error()
  })())
})
