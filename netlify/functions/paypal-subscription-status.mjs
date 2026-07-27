// Netlify Function: sync a clinic's PayPal subscription status.
const ACTIVE_STATUSES = new Set(['ACTIVE'])
const PRO_PRICE = 50

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

export default async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)

  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET
  const supaUrl = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!id || !secret) return json({ ok: false, error: 'not_configured' }, 503)
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)

  let payload
  try { payload = await req.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  const { subscriptionId, clinicId } = payload || {}
  if (!subscriptionId || !clinicId) return json({ ok: false, error: 'bad_request' }, 400)

  try {
    const base = (process.env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)

    const subR = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    })
    const sub = await subR.json().catch(() => ({}))
    if (!subR.ok) return json({ ok: false, error: 'subscription_lookup_failed', message: sub.message }, subR.status)

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    const getR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}&select=data`, { headers })
    const rows = await getR.json()
    if (!Array.isArray(rows) || rows.length === 0) return json({ ok: false, error: 'clinic_not_found' }, 404)

    const clinic = rows[0].data
    const paid = ACTIVE_STATUSES.has(sub.status)
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
      nextBillingTime: sub.billing_info?.next_billing_time || clinic.nextBillingTime,
      ...(priceUpdated ? { renewalPrice: PRO_PRICE, renewalCurrency: 'USD', renewalPriceUpdatedAt: now } : {}),
      renewalPriceUpdatePending: paid && !priceUpdated,
      ...(paid ? {} : { subscriptionStoppedAt: now }),
    }
    const upR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ data: nextData }),
    })
    if (!upR.ok) return json({ ok: false, error: 'update_failed', message: await upR.text() }, 500)
    return json({ ok: true, status: sub.status, paid, clinic: { ...nextData, id: clinicId } })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
