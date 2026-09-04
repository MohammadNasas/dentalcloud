// Cloudflare Pages Function: PayPal subscription webhooks.
// Route: POST /api/paypal-webhook
// Configure this URL in PayPal and set PAYPAL_WEBHOOK_ID for signature verification.
const PRO_PRICE = 50
// Activating a subscription only starts its free trial. Payment is granted
// exclusively by a signed, completed $50 PayPal sale event.
const PAID_EVENTS = new Set(['PAYMENT.SALE.COMPLETED'])
const ACTIVATION_EVENTS = new Set(['BILLING.SUBSCRIPTION.ACTIVATED'])
const STOP_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'PAYMENT.SALE.REVERSED',
])
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

export const onRequestOptions = () => new Response('', {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
})

async function token(base, id, secret) {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return r.json()
}

async function verifyWebhook({ base, accessToken, request, event, webhookId }) {
  const body = {
    auth_algo: request.headers.get('paypal-auth-algo'),
    cert_url: request.headers.get('paypal-cert-url'),
    transmission_id: request.headers.get('paypal-transmission-id'),
    transmission_sig: request.headers.get('paypal-transmission-sig'),
    transmission_time: request.headers.get('paypal-transmission-time'),
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

function verifiedPaymentFrom(event) {
  const r = event.resource || {}
  const amount = Number(r.amount?.total ?? r.amount?.value ?? r.transaction_info?.transaction_amount?.value)
  const currency = String(r.amount?.currency || r.amount?.currency_code || r.transaction_info?.transaction_amount?.currency_code || '').toUpperCase()
  const state = String(r.state || r.status || 'COMPLETED').toUpperCase()
  if (state !== 'COMPLETED' || !Number.isFinite(amount) || Math.abs(amount - PRO_PRICE) > 0.01 || currency !== 'USD') return null
  return { amount, currency, id: r.id || null, time: event.create_time || r.create_time || null }
}

async function findClinicBySubscription(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/clinics`)
  url.searchParams.set('select', 'id,data')
  url.searchParams.set('data->>paypalSubscriptionId', `eq.${subscriptionId}`)
  const r = await fetch(url, { headers })
  const rows = await r.json()
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

async function findTrialBySubscription(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('select', 'paypal_subscription_id')
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(await r.text())
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

async function paypalSubscription(base, accessToken, subscriptionId) {
  const r = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function claimPaypalIdentity(supaUrl, headers, subscriptionId, subscription) {
  const payerId = String(subscription?.subscriber?.payer_id || '').trim()
  const email = normalizeEmail(subscription?.subscriber?.email_address)
  const paymentTokenId = String(
    subscription?.subscriber?.payment_source?.card?.attributes?.vault?.id
    || subscription?.subscriber?.payment_source?.paypal?.attributes?.vault?.id
    || subscription?.payment_source?.card?.attributes?.vault?.id
    || subscription?.payment_source?.paypal?.attributes?.vault?.id
    || ''
  ).trim()
  if (!payerId && !email && !paymentTokenId) return false
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      ...(payerId ? { paypal_payer_id: payerId } : {}),
      ...(email ? { paypal_email: email } : {}),
      ...(paymentTokenId ? { paypal_payment_token_id: paymentTokenId } : {}),
      updated_at: new Date().toISOString(),
    }),
  })
  if (r.status === 409) return false
  if (!r.ok) throw new Error(await r.text())
  return true
}

async function cancelSubscription(base, accessToken, subscriptionId) {
  await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Free trial already used by this PayPal account' }),
  })
}

async function cancelTrialReservation(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
  })
  if (!r.ok) throw new Error(await r.text())
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

export const onRequestPost = async ({ request, env }) => {
  const id = env.PAYPAL_CLIENT_ID, secret = env.PAYPAL_SECRET, webhookId = env.PAYPAL_WEBHOOK_ID
  const supaUrl = env.SUPABASE_URL, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!id || !secret || !webhookId) return json({ ok: false, error: 'paypal_webhook_not_configured' }, 503)
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)

  let event
  try { event = JSON.parse(await request.text()) } catch { return json({ ok: false, error: 'bad_json' }, 400) }

  try {
    const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)
    const verified = await verifyWebhook({ base, accessToken: tok.access_token, request, event, webhookId })
    if (!verified) return json({ ok: false, error: 'bad_signature' }, 401)

    const eventType = event.event_type
    if (!PAID_EVENTS.has(eventType) && !STOP_EVENTS.has(eventType) && !ACTIVATION_EVENTS.has(eventType)) return json({ ok: true, ignored: eventType })

    const subscriptionId = subscriptionIdFrom(event)
    if (!subscriptionId) return json({ ok: true, ignored: 'no_subscription_id' })

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    // Bind the trial to PayPal as soon as it becomes active. This catches a
    // second app account even if the customer closes the browser before the
    // return URL calls paypal-capture.
    if (ACTIVATION_EVENTS.has(eventType)) {
      const trial = await findTrialBySubscription(supaUrl, headers, subscriptionId)
      if (!trial) return json({ ok: true, ignored: 'trial_not_found', subscriptionId })
      const subscription = await paypalSubscription(base, tok.access_token, subscriptionId)
      if (!await claimPaypalIdentity(supaUrl, headers, subscriptionId, subscription)) {
        await cancelSubscription(base, tok.access_token, subscriptionId)
        await cancelTrialReservation(supaUrl, headers, subscriptionId)
        return json({ ok: true, cancelledDuplicateTrial: true, subscriptionId })
      }
      return json({ ok: true, trialIdentityClaimed: true, subscriptionId })
    }

    const clinic = await findClinicBySubscription(supaUrl, headers, subscriptionId)
    if (!clinic) return json({ ok: true, ignored: 'clinic_not_found_for_subscription' })

    const now = new Date().toISOString()
    if (STOP_EVENTS.has(eventType)) {
      await updateClinic(supaUrl, headers, clinic, {
        paid: false,
        paidAt: null,
        subscriptionPaymentVerified: false,
        subscriptionVerifiedAmount: null,
        subscriptionVerifiedCurrency: null,
        subscriptionVerifiedPaymentId: null,
        subscriptionPaymentVerificationSource: null,
        subscriptionStatus: eventType.replace('BILLING.SUBSCRIPTION.', '').replace('PAYMENT.SALE.', ''),
        subscriptionStoppedAt: now,
        subscriptionLastEvent: eventType,
      })
      return json({ ok: true, paid: false, subscriptionId })
    }

    const payment = verifiedPaymentFrom(event)
    if (!payment) {
      await updateClinic(supaUrl, headers, clinic, {
        paid: false,
        paidAt: null,
        subscriptionPaymentVerified: false,
        subscriptionVerifiedAmount: null,
        subscriptionVerifiedCurrency: null,
        subscriptionVerifiedPaymentId: null,
        subscriptionPaymentVerificationSource: null,
        subscriptionLastEvent: eventType,
      })
      return json({ ok: true, paid: false, ignored: 'payment_not_50_usd', subscriptionId })
    }

    await updateClinic(supaUrl, headers, clinic, {
      paid: true,
      paidAt: payment.time || now,
      subscriptionStatus: 'ACTIVE',
      subscriptionPaymentVerified: true,
      subscriptionVerifiedAmount: payment.amount,
      subscriptionVerifiedCurrency: payment.currency,
      subscriptionVerifiedPaymentId: payment.id,
      subscriptionPaymentVerificationSource: 'verified_webhook',
      subscriptionLastPaidAt: payment.time || now,
      subscriptionLastEvent: eventType,
    })
    return json({ ok: true, paid: true, subscriptionId })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
