// Cloudflare Pages Function: starts a PayPal subscription with a 1-month free trial.
// Route: POST /api/paypal-create
// Env vars: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_BASE (optional), SITE_URL (optional)
// Optional: PAYPAL_PRODUCT_ID, PAYPAL_PRO_TRIAL_PLAN_ID
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
      'Access-Control-Allow-Headers': 'Content-Type',
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

async function updatePlanPrice(base, accessToken, planId, amount) {
  await paypalJson(`${base}/v1/billing/plans/${encodeURIComponent(planId)}/update-pricing-schemes`, accessToken, {
    pricing_schemes: [{
      billing_cycle_sequence: 2,
      pricing_scheme: { fixed_price: { currency_code: 'USD', value: amount.toFixed(2) } },
    }],
  }, `dc-plan-price-${planId}`)
}

async function ensurePlanId(env, base, accessToken, tier, amount) {
  const explicit = env[`PAYPAL_${tier.toUpperCase()}_TRIAL_PLAN_ID`] || env[`PAYPAL_PLAN_${tier.toUpperCase()}`]
  if (explicit) {
    // Keep the PayPal approval screen and every existing subscriber on this
    // plan aligned with the public price before starting a new subscription.
    await updatePlanPrice(base, accessToken, explicit, amount)
    return explicit
  }
  const productId = env.PAYPAL_PRODUCT_ID || (await createProduct(base, accessToken)).id
  const plan = await createTrialPlan(base, accessToken, { productId, tier, amount })
  return plan.id
}

export const onRequestPost = async ({ request, env }) => {
  const id = env.PAYPAL_CLIENT_ID, secret = env.PAYPAL_SECRET
  if (!id || !secret) return json({ error: 'not_configured' }, 503)
  const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
  const siteUrl = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '')

  let payload
  try { payload = await request.json() } catch { return json({ error: 'bad_json' }, 400) }
  const { tier, clinicId, email } = payload || {}
  if (!PRICES[tier] || !clinicId) return json({ error: 'bad_request' }, 400)

  try {
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ error: 'auth_failed', message: tok.error_description || tok.error }, 400)

    const amount = PRICES[tier]
    const planId = await ensurePlanId(env, base, tok.access_token, tier, amount)
    const reference = `${clinicId}--${tier}--trial--${Date.now()}`
    const sub = await paypalJson(`${base}/v1/billing/subscriptions`, tok.access_token, {
      plan_id: planId,
      custom_id: reference,
      subscriber: email ? { email_address: email } : undefined,
      application_context: {
        brand_name: 'DentalCloud',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${siteUrl}/?paypal=subscription&clinic=${encodeURIComponent(clinicId)}&tier=${encodeURIComponent(tier)}`,
        cancel_url: `${siteUrl}/?paypal=cancel`,
      },
    }, `dc-sub-${clinicId}`)

    const approve = (sub.links || []).find((l) => l.rel === 'approve')
    if (!sub.id || !approve) return json({ error: 'subscription_failed', message: sub.message, details: sub.details }, 400)
    return json({ url: approve.href, subscriptionId: sub.id, planId })
  } catch (e) {
    return json({ error: 'request_failed', message: String(e.message || e), details: e.details }, e.status || 500)
  }
}
