// Cloudflare Pages Function: sync a clinic's PayPal subscription status.
// Route: POST /api/paypal-subscription-status
const ACTIVE_STATUSES = new Set(['ACTIVE'])
const PRO_PRICE = 50

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

async function token(base, id, secret) {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return r.json()
}

async function updateSubscriptionPrice(base, accessToken, subscriptionId) {
  const r = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{
      op: 'replace',
      path: '/plan/billing_cycles/@sequence==2/pricing_scheme/fixed_price',
      value: { currency_code: 'USD', value: PRO_PRICE.toFixed(2) },
    }]),
  })
  return r.ok
}

function verifiedPaymentFromSubscription(sub) {
  const last = sub?.billing_info?.last_payment
  const amount = Number(last?.amount?.value ?? last?.amount?.total)
  const currency = String(last?.amount?.currency_code || last?.amount?.currency || '').toUpperCase()
  if (!Number.isFinite(amount) || Math.abs(amount - PRO_PRICE) > 0.01 || currency !== 'USD') return null
  return { amount, currency, time: last.time || null, source: 'paypal_subscription' }
}

function verifiedPaymentFromWebhook(clinic) {
  const amount = Number(clinic?.subscriptionVerifiedAmount)
  const currency = String(clinic?.subscriptionVerifiedCurrency || '').toUpperCase()
  if (clinic?.subscriptionPaymentVerified !== true || !Number.isFinite(amount) || Math.abs(amount - PRO_PRICE) > 0.01 || currency !== 'USD') return null
  return { amount, currency, time: clinic.subscriptionLastPaidAt || clinic.paidAt || null, source: 'verified_webhook' }
}

export const onRequestPost = async ({ request, env }) => {
  const id = env.PAYPAL_CLIENT_ID, secret = env.PAYPAL_SECRET
  const supaUrl = env.SUPABASE_URL, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!id || !secret) return json({ ok: false, error: 'not_configured' }, 503)
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)

  let payload
  try { payload = await request.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  const { subscriptionId, clinicId } = payload || {}
  if (!subscriptionId || !clinicId) return json({ ok: false, error: 'bad_request' }, 400)

  try {
    const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)

    const subR = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    })
    const sub = await subR.json().catch(() => ({}))
    if (!subR.ok) return json({ ok: false, error: 'subscription_lookup_failed', message: sub.message }, subR.status)

    const [refClinicId] = String(sub.custom_id || '').split('--')
    if (!refClinicId || refClinicId !== clinicId) return json({ ok: false, error: 'subscription_clinic_mismatch' }, 403)

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    const getR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}&select=data`, { headers })
    const rows = await getR.json()
    if (!Array.isArray(rows) || rows.length === 0) return json({ ok: false, error: 'clinic_not_found' }, 404)

    const clinic = rows[0].data
    // Status sync must only ever update the subscription already attached to
    // this clinic. Otherwise an abandoned second checkout could replace the
    // original subscription record.
    if (clinic.paypalSubscriptionId !== subscriptionId)
      return json({ ok: false, error: 'subscription_not_current' }, 409)
    // ACTIVE also describes the free trial. It must never be treated as proof
    // of payment. Only an exact $50 USD payment reported by PayPal unlocks paid.
    const verifiedPayment = verifiedPaymentFromSubscription(sub) || verifiedPaymentFromWebhook(clinic)
    const paid = ACTIVE_STATUSES.has(sub.status) && Boolean(verifiedPayment)
    let priceUpdated = Number(clinic.renewalPrice) === PRO_PRICE && !clinic.renewalPriceUpdatePending
    if (paid && !priceUpdated) priceUpdated = await updateSubscriptionPrice(base, tok.access_token, subscriptionId)
    const now = new Date().toISOString()
    const nextData = {
      ...clinic,
      tier: clinic.tier === 'economy' ? 'pro' : clinic.tier,
      paid,
      subscriptionProvider: 'paypal',
      paypalSubscriptionId: subscriptionId,
      subscriptionStatus: sub.status,
      subscriptionSyncedAt: now,
      subscriptionPaymentVerified: paid,
      subscriptionVerifiedAmount: paid ? verifiedPayment.amount : null,
      subscriptionVerifiedCurrency: paid ? verifiedPayment.currency : null,
      subscriptionPaymentVerificationSource: paid ? verifiedPayment.source : null,
      subscriptionLastPaidAt: paid ? (verifiedPayment.time || clinic.subscriptionLastPaidAt || now) : null,
      paidAt: paid ? (verifiedPayment.time || clinic.paidAt || now) : null,
      nextBillingTime: sub.billing_info?.next_billing_time || clinic.nextBillingTime,
      ...(priceUpdated ? { renewalPrice: PRO_PRICE, renewalCurrency: 'USD', renewalPriceUpdatedAt: now } : {}),
      renewalPriceUpdatePending: paid && !priceUpdated,
      ...(ACTIVE_STATUSES.has(sub.status) ? { subscriptionStoppedAt: null } : { subscriptionStoppedAt: now }),
    }
    const upR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ data: nextData }),
    })
    if (!upR.ok) return json({ ok: false, error: 'update_failed', message: await upR.text() }, 500)
    return json({ ok: true, status: sub.status, paid, paymentVerified: paid, clinic: { ...nextData, id: clinicId } })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
