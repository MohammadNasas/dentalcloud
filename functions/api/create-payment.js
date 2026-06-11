// Cloudflare Pages Function: starts a Lahza payment for a subscription plan.
// Route: POST /api/create-payment
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   LAHZA_SECRET_KEY, LAHZA_BASE (optional), LAHZA_CURRENCY (optional), SITE_URL (optional)
const PRICES = { student: 5, economy: 60, pro: 100 }

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
  const secret = env.LAHZA_SECRET_KEY
  if (!secret) return json({ error: 'not_configured' }, 503)
  const base = (env.LAHZA_BASE || 'https://api.lahza.io').replace(/\/$/, '')
  const currency = env.LAHZA_CURRENCY || 'USD'
  // Default to the live deployment origin so Lahza redirects back to this site
  // even without setting SITE_URL.
  const siteUrl = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '')

  let payload
  try { payload = await request.json() } catch { return json({ error: 'bad_json' }, 400) }
  const { tier, clinicId, customerName, email, phone } = payload || {}
  const amount = PRICES[tier]
  if (!amount || !clinicId) return json({ error: 'bad_request' }, 400)

  // Lahza requires an email; fall back to a per-clinic address if the caller omits it.
  const customerEmail = email || `clinic-${clinicId}@dentalcloud.app`
  // The reference carries clinicId + tier so verify-payment can activate the plan.
  // "--" is a safe delimiter: clinic ids are UUIDs (single "-" only).
  const reference = `${clinicId}--${tier}--${Date.now()}`

  const body = {
    email: customerEmail,
    amount: String(amount * 100), // smallest unit: cents (USD) / aghora (ILS) / qirsh (JOD)
    currency,
    reference,
    callback_url: `${siteUrl}/`,
    first_name: customerName || 'Clinic',
    mobile: phone || undefined,
    metadata: JSON.stringify({ clinicId, tier }),
  }

  try {
    const r = await fetch(`${base}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json()
    if (!data.status || !data.data?.authorization_url) {
      return json({ error: 'lahza_failed', message: data.message, details: data.errors }, 400)
    }
    return json({ url: data.data.authorization_url, reference: data.data.reference })
  } catch (e) {
    return json({ error: 'request_failed', message: String(e) }, 500)
  }
}
