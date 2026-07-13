// Netlify Function: finalizes PayPal checkout.
// New flow: verifies an approved PayPal subscription/trial and activates the clinic.
// Legacy flow: still captures old one-time PayPal orders if a user returns from one.
const PRICES = { economy: 70, pro: 100 }
const COUPONS = { DENTAL40: 40 }
const expectedPrice = (tier, code) => {
  const pct = COUPONS[String(code || '').trim().toUpperCase()] || 0
  return Math.round((PRICES[tier] || 0) * (1 - pct / 100) * 100) / 100
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

const authHeader = (id, secret) => 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64')

async function token(base, id, secret) {
  const tokRes = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: authHeader(id, secret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return tokRes.json()
}

async function getClinic(supaUrl, headers, clinicId) {
  const getR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}&select=data`, { headers })
  const rows = await getR.json()
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[0].data
}

async function saveClinic(supaUrl, headers, clinicId, data) {
  const upR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ data }),
  })
  if (!upR.ok) throw new Error(await upR.text())
}

function addOneMonthIso() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

async function finalizeSubscription({ base, accessToken, supaUrl, headers, subscriptionId, clinicId: hintedClinicId, tier: hintedTier }) {
  if (!subscriptionId) return json({ ok: false, error: 'no_subscription' }, 400)
  const subR = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  })
  const sub = await subR.json().catch(() => ({}))
  if (!subR.ok) return json({ ok: false, error: 'subscription_lookup_failed', status: sub.status, message: sub.message }, subR.status)

  const [refClinicId, refTier] = String(sub.custom_id || '').split('--')
  const clinicId = refClinicId || hintedClinicId
  const tier = refTier || hintedTier
  if (!clinicId || !PRICES[tier]) return json({ ok: false, error: 'bad_subscription_reference' }, 400)
  if (sub.status !== 'ACTIVE') return json({ ok: false, error: 'subscription_not_active', status: sub.status }, 400)

  const clinic = await getClinic(supaUrl, headers, clinicId)
  if (!clinic) return json({ ok: false, error: 'clinic_not_found' }, 404)

  const now = new Date().toISOString()
  const nextBillingTime = sub.billing_info?.next_billing_time || addOneMonthIso()
  const nextData = {
    ...clinic,
    tier,
    paid: true,
    paidAt: now,
    subscriptionProvider: 'paypal',
    paypalSubscriptionId: subscriptionId,
    subscriptionStatus: sub.status,
    trialStartedAt: clinic.trialStartedAt || now,
    trialEndsAt: clinic.trialEndsAt || nextBillingTime,
    nextBillingTime,
    renewalPrice: PRICES[tier],
    renewalCurrency: 'USD',
  }
  await saveClinic(supaUrl, headers, clinicId, nextData)
  return json({ ok: true, tier, clinicId, subscription: true, subscriptionId, nextBillingTime })
}

async function finalizeLegacyOrder({ base, accessToken, supaUrl, headers, orderId }) {
  if (!orderId) return json({ ok: false, error: 'no_order' }, 400)
  const capRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
  const cap = await capRes.json()
  if (cap.status !== 'COMPLETED') return json({ ok: false, status: cap.status || 'unknown', message: cap.message })

  const pu = (cap.purchase_units || [])[0] || {}
  const capture = pu.payments?.captures?.[0] || {}
  const reference = capture.custom_id || pu.custom_id || ''
  const paid = Number(capture.amount?.value || 0)
  const [clinicId, tier, coupon] = String(reference).split('--')
  if (!clinicId || !PRICES[tier]) return json({ ok: false, error: 'bad_reference' }, 400)

  const expected = expectedPrice(tier, coupon)
  if (Math.abs(paid - expected) > 0.01) return json({ ok: false, error: 'amount_mismatch', paid, expected }, 400)

  const clinic = await getClinic(supaUrl, headers, clinicId)
  if (!clinic) return json({ ok: false, error: 'clinic_not_found' }, 404)
  const nextData = { ...clinic, tier, paid: true, paidAt: new Date().toISOString(), subscriptionProvider: 'paypal-order' }
  await saveClinic(supaUrl, headers, clinicId, nextData)
  return json({ ok: true, tier, clinicId })
}

export default async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)

  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET
  if (!id || !secret) return json({ ok: false, error: 'not_configured' }, 503)
  const supaUrl = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)

  let payload
  try { payload = await req.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }

  try {
    const base = (process.env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

    if (payload?.type === 'subscription' || payload?.subscriptionId) {
      return finalizeSubscription({
        base,
        accessToken: tok.access_token,
        supaUrl,
        headers,
        subscriptionId: payload.subscriptionId,
        clinicId: payload.clinicId,
        tier: payload.tier,
      })
    }
    return finalizeLegacyOrder({ base, accessToken: tok.access_token, supaUrl, headers, orderId: payload?.orderId })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
