// Authenticated, server-throttled notification to a fixed recipient only.
const COUPONS = { DENTAL40: 40 }
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
})
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))
export const onRequestOptions = () => new Response('', { headers: {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} })
async function readPayload(request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('body')
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 4096) { await reader.cancel(); throw new Error('body') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}
export async function onRequestPost({ request, env }) {
  const bearer = request.headers.get('Authorization') || ''
  if (!/^Bearer \S+$/i.test(bearer)) return json({ ok: false, error: 'unauthorized' }, 401)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.RESEND_API_KEY)
    return json({ ok: false, error: 'notification_unavailable' }, 503)
  let payload
  try { payload = await readPayload(request) } catch { return json({ ok: false, error: 'bad_request' }, 400) }
  if (typeof payload?.coupon !== 'string' || payload.coupon.length > 32 || payload.tier !== 'pro')
    return json({ ok: false, error: 'bad_request' }, 400)
  const code = payload.coupon.trim().toUpperCase()
  if (!Object.hasOwn(COUPONS, code)) return json({ ok: false, error: 'bad_coupon' }, 400)
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  try {
    const auth = await fetch(base + '/auth/v1/user', {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: bearer }, signal: AbortSignal.timeout(10000),
    })
    if (!auth.ok) return json({ ok: false, error: 'unauthorized' }, 401)
    const user = await auth.json()
    if (!user.id || typeof user.email !== 'string' || !user.email_confirmed_at)
      return json({ ok: false, error: 'verified_email_required' }, 403)
    const reservation = await fetch(base + '/rest/v1/rpc/reserve_coupon_notification', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: user.id }),
    })
    if (!reservation.ok) return json({ ok: false, error: 'notification_unavailable' }, 503)
    if (await reservation.json() !== true) return json({ ok: false, error: 'rate_limited' }, 429)
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'DentalCloud <onboarding@resend.dev>',
        to: env.COUPON_NOTIFY_TO || 'mohammadissogood556@gmail.com',
        subject: 'DentalCloud — coupon notification',
        html: '<p>Coupon: ' + escapeHtml(code) + '</p><p>User: ' + escapeHtml(user.email) + '</p><p>Plan: Pro</p>',
      }),
    })
    return sent.ok ? json({ ok: true }) : json({ ok: false, error: 'send_failed' }, 502)
  } catch { return json({ ok: false, error: 'notification_unavailable' }, 503) }
}
