// Cloudflare Pages Function: starts either a first-time free trial or an
// immediate paid PayPal subscription when that payment identity used its trial.
// Route: POST /api/paypal-create
// Env vars: PAYPAL_CLIENT_ID, PAYPAL_SECRET, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, PAYPAL_BASE (optional), SITE_URL (optional)
// Optional: PAYPAL_PRODUCT_ID, PAYPAL_PRO_TRIAL_PLAN_ID, PAYPAL_PRO_PAID_PLAN_ID
const PRICES = { pro: 50 }
const LABELS = { pro: 'Pro' }

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

export const onRequestOptions = () =>
  new Response('', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })

const authHeader = (id, secret) => 'Basic ' + btoa(`${id}:${secret}`)
const requestId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

async function token(base, id, secret) {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: authHeader(id, secret), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return r.json()
}

async function paypalJson(url, accessToken, body, prefix) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
      'PayPal-Request-Id': requestId(prefix),
    },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data.message || data.name || 'paypal_request_failed')
    err.details = data.details
    err.status = r.status
    throw err
  }
  return data
}

async function createProduct(base, accessToken) {
  return paypalJson(`${base}/v1/catalogs/products`, accessToken, {
    name: 'DentalCloud',
    description: 'DentalCloud dental clinic management subscription',
    type: 'SERVICE',
    category: 'SOFTWARE',
  }, 'dc-product')
}

async function createTrialPlan(base, accessToken, { productId, tier, amount }) {
  return paypalJson(`${base}/v1/billing/plans`, accessToken, {
    product_id: productId,
    name: `DentalCloud ${LABELS[tier]} - 1 month free trial`,
    description: `First month free, then $${amount}/year.`,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'TRIAL',
        sequence: 1,
        total_cycles: 1,
        pricing_scheme: { fixed_price: { currency_code: 'USD', value: '0' } },
      },
      {
        frequency: { interval_unit: 'YEAR', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 2,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { currency_code: 'USD', value: amount.toFixed(2) } },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CANCEL',
      payment_failure_threshold: 1,
    },
  }, `dc-plan-${tier}`)
}

async function createPaidPlan(base, accessToken, { productId, tier, amount }) {
  return paypalJson(`${base}/v1/billing/plans`, accessToken, {
    product_id: productId,
    name: `DentalCloud ${LABELS[tier]} - paid annually`,
    description: `$${amount} charged now, then annually. No free trial.`,
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: 'YEAR', interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { currency_code: 'USD', value: amount.toFixed(2) } },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CANCEL',
      payment_failure_threshold: 1,
    },
  }, `dc-paid-plan-${tier}`)
}

async function updatePlanPrice(base, accessToken, planId, amount, sequence) {
  await paypalJson(`${base}/v1/billing/plans/${encodeURIComponent(planId)}/update-pricing-schemes`, accessToken, {
    pricing_schemes: [{
      billing_cycle_sequence: sequence,
      pricing_scheme: { fixed_price: { currency_code: 'USD', value: amount.toFixed(2) } },
    }],
  }, `dc-plan-price-${planId}`)
}

async function ensurePlanId(env, base, accessToken, tier, amount, checkoutMode) {
  const isPaid = checkoutMode === 'paid'
  const explicit = isPaid
    ? env[`PAYPAL_${tier.toUpperCase()}_PAID_PLAN_ID`]
    : env[`PAYPAL_${tier.toUpperCase()}_TRIAL_PLAN_ID`] || env[`PAYPAL_PLAN_${tier.toUpperCase()}`]
  if (explicit) {
    // Keep the PayPal approval screen and every existing subscriber on this
    // plan aligned with the public price before starting a new subscription.
    await updatePlanPrice(base, accessToken, explicit, amount, isPaid ? 1 : 2)
    return explicit
  }
  const productId = env.PAYPAL_PRODUCT_ID || (await createProduct(base, accessToken)).id
  const plan = isPaid
    ? await createPaidPlan(base, accessToken, { productId, tier, amount })
    : await createTrialPlan(base, accessToken, { productId, tier, amount })
  return plan.id
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

async function authenticatedUser(supaUrl, serviceKey, request) {
  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer\s+.+/i.test(authorization)) return null
  const r = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: authorization },
  })
  if (!r.ok) return null
  const user = await r.json().catch(() => null)
  const email = normalizeEmail(user?.email)
  return user?.id && email ? { id: user.id, email } : null
}

async function loadClinic(supaUrl, headers, clinicId) {
  const url = new URL(`${supaUrl}/rest/v1/clinics`)
  url.searchParams.set('select', 'id,data')
  url.searchParams.set('id', `eq.${clinicId}`)
  const r = await fetch(url, { headers })
  const rows = await r.json().catch(() => [])
  return r.ok && Array.isArray(rows) ? rows[0] || null : null
}

async function userBelongsToClinic(supaUrl, headers, userId, clinicId) {
  const url = new URL(`${supaUrl}/rest/v1/doctors`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('id', `eq.${userId}`)
  url.searchParams.set('clinic_id', `eq.${clinicId}`)
  const r = await fetch(url, { headers })
  const rows = await r.json().catch(() => [])
  return r.ok && Array.isArray(rows) && rows.length > 0
}

// The unique email primary key makes this reservation atomic even if the user
// double-clicks or opens checkout in two browser tabs.
async function reserveTrial(supaUrl, headers, { email, userId, clinicId }) {
  const r = await fetch(`${supaUrl}/rest/v1/subscription_trials?on_conflict=email`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ email, user_id: userId, clinic_id: clinicId, status: 'pending' }),
  })
  if (!r.ok) throw new Error(`trial_reservation_failed: ${await r.text()}`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows.length === 1
}

async function bindTrialToSubscription(supaUrl, headers, { email, userId, clinicId, subscriptionId }) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('email', `eq.${email}`)
  url.searchParams.set('user_id', `eq.${userId}`)
  url.searchParams.set('clinic_id', `eq.${clinicId}`)
  url.searchParams.set('status', 'eq.pending')
  url.searchParams.set('paypal_subscription_id', 'is.null')
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ paypal_subscription_id: subscriptionId, updated_at: new Date().toISOString() }),
  })
  if (!r.ok) throw new Error(`trial_binding_failed: ${await r.text()}`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows.length === 1
}

async function releaseUnboundTrial(supaUrl, headers, { email, userId, clinicId }) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('email', `eq.${email}`)
  url.searchParams.set('user_id', `eq.${userId}`)
  url.searchParams.set('clinic_id', `eq.${clinicId}`)
  url.searchParams.set('status', 'eq.pending')
  url.searchParams.set('paypal_subscription_id', 'is.null')
  await fetch(url, { method: 'DELETE', headers })
}

async function cancelSubscription(base, accessToken, subscriptionId) {
  if (!subscriptionId) return
  await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Duplicate free-trial checkout' }),
  })
}

export const onRequestPost = async ({ request, env }) => {
  const id = env.PAYPAL_CLIENT_ID, secret = env.PAYPAL_SECRET
  if (!id || !secret) return json({ error: 'not_configured' }, 503)
  const supaUrl = env.SUPABASE_URL, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return json({ error: 'supabase_not_configured' }, 503)
  const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
  const siteUrl = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '')

  let payload
  try { payload = await request.json() } catch { return json({ error: 'bad_json' }, 400) }
  const { tier, clinicId } = payload || {}
  const checkoutMode = payload?.checkoutMode === 'paid' ? 'paid' : 'trial'
  if (!PRICES[tier] || !clinicId) return json({ error: 'bad_request' }, 400)

  let reservation = null
  let paypalAccessToken = ''
  let paypalSubscriptionId = ''
  try {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    const user = await authenticatedUser(supaUrl, serviceKey, request)
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (!await userBelongsToClinic(supaUrl, headers, user.id, clinicId)) return json({ error: 'clinic_access_denied' }, 403)

    const clinicRow = await loadClinic(supaUrl, headers, clinicId)
    if (!clinicRow) return json({ error: 'clinic_not_found' }, 404)
    if (checkoutMode === 'trial') {
      // Covers all trials created before the permanent email ledger was added.
      if (clinicRow.data?.trialStartedAt || clinicRow.data?.trialUsedAt || clinicRow.data?.paypalSubscriptionId)
        return json({ error: 'trial_already_used', requiresPaidCheckout: true }, 409)
      if (!await reserveTrial(supaUrl, headers, { email: user.email, userId: user.id, clinicId }))
        return json({ error: 'trial_already_used', requiresPaidCheckout: true }, 409)
      reservation = { email: user.email, userId: user.id, clinicId, headers }
    } else if (clinicRow.data?.paid && clinicRow.data?.subscriptionPaymentVerified === true) {
      return json({ error: 'already_paid' }, 409)
    }

    const tok = await token(base, id, secret)
    if (!tok.access_token) {
      if (reservation) await releaseUnboundTrial(supaUrl, headers, reservation)
      return json({ error: 'auth_failed', message: tok.error_description || tok.error }, 400)
    }
    paypalAccessToken = tok.access_token

    const amount = PRICES[tier]
    const planId = await ensurePlanId(env, base, tok.access_token, tier, amount, checkoutMode)
    const reference = `${clinicId}--${tier}--${checkoutMode}--${Date.now()}`
    const sub = await paypalJson(`${base}/v1/billing/subscriptions`, tok.access_token, {
      plan_id: planId,
      custom_id: reference,
      subscriber: { email_address: user.email },
      application_context: {
        brand_name: 'DentalCloud',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${siteUrl}/?paypal=subscription&clinic=${encodeURIComponent(clinicId)}&tier=${encodeURIComponent(tier)}&mode=${checkoutMode}`,
        cancel_url: `${siteUrl}/?paypal=cancel`,
      },
    }, `dc-sub-${clinicId}`)

    const approve = (sub.links || []).find((l) => l.rel === 'approve')
    paypalSubscriptionId = sub.id || ''
    if (!paypalSubscriptionId || !approve) {
      await cancelSubscription(base, tok.access_token, paypalSubscriptionId)
      if (reservation) await releaseUnboundTrial(supaUrl, headers, reservation)
      return json({ error: 'subscription_failed', message: sub.message, details: sub.details }, 400)
    }
    if (reservation && !await bindTrialToSubscription(supaUrl, headers, { ...reservation, subscriptionId: paypalSubscriptionId })) {
      await cancelSubscription(base, tok.access_token, paypalSubscriptionId)
      await releaseUnboundTrial(supaUrl, headers, reservation)
      return json({ error: 'trial_reservation_failed' }, 409)
    }
    return json({ url: approve.href, subscriptionId: sub.id, planId, checkoutMode })
  } catch (e) {
    if (paypalSubscriptionId && paypalAccessToken) await cancelSubscription(base, paypalAccessToken, paypalSubscriptionId)
    if (reservation) await releaseUnboundTrial(supaUrl, reservation.headers, reservation)
    return json({ error: 'request_failed', message: String(e.message || e), details: e.details }, e.status || 500)
  }
}
