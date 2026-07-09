import { isCloud, supabase } from './supabaseClient'

const MIN_PING_GAP_MS = 60 * 1000
let lastPingAt = 0

function localDay() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function detectPlatform() {
  const ua = navigator.userAgent || ''
  if (/electron/i.test(ua)) return 'desktop'
  if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) return 'pwa'
  return 'web'
}

function compactMeta({ clinic, user }) {
  return {
    tier: clinic?.tier || '',
    clinicName: clinic?.name || clinic?.nameAr || '',
    userName: user?.name || user?.nameAr || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    language: navigator.language || '',
    path: window.location.hash || window.location.pathname || '',
  }
}

export async function trackDailyActive({ clinic, user }, { force = false } = {}) {
  if (!isCloud || !supabase || !clinic?.id || !user?.id) return
  if (document.visibilityState === 'hidden' && !force) return

  const now = Date.now()
  if (!force && now - lastPingAt < MIN_PING_GAP_MS) return
  lastPingAt = now

  try {
    await supabase.rpc('track_daily_active', {
      p_day: localDay(),
      p_platform: detectPlatform(),
      p_user_agent: (navigator.userAgent || '').slice(0, 500),
      p_data: compactMeta({ clinic, user }),
    })
  } catch (e) {
    // Analytics must never interrupt clinical work.
    console.warn('usage analytics failed', e)
  }
}
