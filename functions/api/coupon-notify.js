// Cloudflare Pages Function: POST /api/coupon-notify
// Privately emails the APP OWNER when a customer applies a valid gift/discount
// code at checkout — BEFORE they pay. The recipient is fixed on the server, so
// the notification can only ever reach the owner (never the customer).
//
// Env vars:
//   RESEND_API_KEY    (required to actually send — from https://resend.com)
//   COUPON_NOTIFY_TO  (optional — recipient; defaults to the owner below)
//   RESEND_FROM       (optional — sender; defaults to Resend's shared sender)
//
// Keep COUPONS in sync with src/lib/coupons.js and the paypal-* functions.
const COUPONS = { DENTAL40: 40 }
const OWNER_EMAIL = 'mohammadissogood556@gmail.com'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

export const onRequestOptions = () =>
  new Response('', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })

export const onRequestPost = async ({ request, env }) => {
  let payload
  try { payload = await request.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  const { email, tier, coupon } = payload || {}

  // Only notify for codes we actually recognise (stops strangers spamming you).
  const code = String(coupon || '').trim().toUpperCase()
  const percent = COUPONS[code]
  if (!percent) return json({ ok: false, error: 'bad_coupon' }, 400)

  const apiKey = env.RESEND_API_KEY
  if (!apiKey) return json({ ok: false, error: 'email_not_configured' }, 503)

  const to = env.COUPON_NOTIFY_TO || OWNER_EMAIL
  const from = env.RESEND_FROM || 'DentalCloud <onboarding@resend.dev>'
  const customer = String(email || '').trim() || 'مستخدم غير معروف / unknown'
  const when = new Date().toISOString()

  const subject = `🎁 كود الخصم ${code} استُخدم — ${customer}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b">
      <h2 style="margin:0 0 8px">🎁 تم استخدام كود خصم</h2>
      <p style="margin:0 0 16px;color:#64748b">شخص أدخل كود الهدية في شاشة الدفع قبل أن يدفع.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">الكود</td><td style="font-weight:bold">${code} (${percent}%)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">إيميل المستخدم</td><td style="font-weight:bold">${customer}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">الباقة</td><td style="font-weight:bold">${String(tier || '—')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">الوقت (UTC)</td><td>${when}</td></tr>
      </table>
    </div>`

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, reply_to: customer.includes('@') ? customer : undefined }),
    })
    if (!r.ok) return json({ ok: false, error: 'send_failed', message: await r.text() }, 502)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500)
  }
}
