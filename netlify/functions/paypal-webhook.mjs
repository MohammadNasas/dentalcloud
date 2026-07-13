// Netlify Function: PayPal subscription webhooks.
// Configure /api/paypal-webhook in PayPal and set PAYPAL_WEBHOOK_ID for signature verification.
const PAID_EVENTS = new Set(['BILLING.SUBSCRIPTION.ACTIVATED', 'PAYMENT.SALE.COMPLETED'])
const STOP_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'PAYMENT.SALE.REVERSED',
])

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

async function token(base, id, secret) {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return r.json()
}

async function verifyWebhook({ base, accessToken, req, event, webhookId }) {
  const body = {
    auth_algo: req.headers.get('paypal-auth-algo'),
    cert_url: req.headers.get('paypal-cert-url'),
    transmission_id: req.headers.get('paypal-transmission-id'),
    transmission_sig: req.headers.get('paypal-transmission-sig'),
    transmission_time: req.headers.get('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: event,
  }
  const r = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  return data.verification_status === 'SUCCESS'
}

function subscriptionIdFrom(event) {
  const r = event.resource || {}
  return r.billing_agreement_id || r.subscription_id || (String(r.id || '').startsWith('I-') ? r.id : '') || ''
}

async function findClinicBySubscription(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/clinics`)
  url.searchParams.set('select', 'id,data')
  url.searchParams.set('data->>paypalSubscriptionId', `eq.${subscriptionId}`)
  const r = await fetch(url, { headers })
  const rows = await r.json()
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

async function updateClinic(supaUrl, headers, clinic, patch) {
  const nextData = { ...clinic.data, ...patch }
  const upR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinic.id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ data: nextData }),
  })
  if (!upR.ok) throw new Error(await upR.text())
}

export default async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)

  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET, webhookId = process.env.PAYPAL_WEBHOOK_ID
  const supaUrl = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!id || !secret || !webhookId) return json({ ok: false, error: 'paypal_webhook_not_configured' }, 503)
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)

  let event
  try { event = JSON.parse(await req.text()) } catch { return json({ ok: false, error: 'bad_json' }, 400) }

  try {
    const base = (process.env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)
    const verified = await verifyWebhook({ base, accessToken: tok.access_token, req, event, webhookId })
    if (!verified) return json({ ok: false, error: 'bad_signature' }, 401)

    const eventType = event.event_type
    if (!PAID_EVENTS.has(eventType) && !STOP_EVENTS.has(eventType)) return json({ ok: true, ignored: eventType })

    const subscriptionId = subscriptionIdFrom(event)
    if (!subscriptionId) return json({ ok: true, ignored: 'no_subscription_id' })

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    const clinic = await findClinicBySubscription(supaUrl, headers, subscriptionId)
    if (!clinic) return json({ ok: true, ignored: 'clinic_not_found_for_subscription' })

    const now = new Date().toISOString()
    if (STOP_EVENTS.has(eventType)) {
      await updateClinic(supaUrl, headers, clinic, {
        paid: false,
        subscriptionStatus: eventType.replace('BILLING.SUBSCRIPTION.', '').replace('PAYMENT.SALE.', ''),
        subscriptionStoppedAt: now,
        subscriptionLastEvent: eventType,
      })
      return json({ ok: true, paid: false, subscriptionId })
    }

    await updateClinic(supaUrl, headers, clinic, {
      paid: true,
      subscriptionStatus: 'ACTIVE',
      subscriptionLastPaidAt: now,
      subscriptionLastEvent: eventType,
    })
    return json({ ok: true, paid: true, subscriptionId })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
