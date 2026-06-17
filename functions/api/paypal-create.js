// Cloudflare Pages Function: starts a PayPal order for a subscription plan.
// Route: POST /api/paypal-create
// Env vars: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_BASE (optional), SITE_URL (optional)
//   PAYPAL_BASE defaults to live (https://api-m.paypal.com); use
//   https://api-m.sandbox.paypal.com for testing.
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

async function token(base, id, secret) {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return r.json()
}

export const onRequestPost = async ({ request, env }) => {
  const id = env.PAYPAL_CLIENT_ID, secret = env.PAYPAL_SECRET
  if (!id || !secret) return json({ error: 'not_configured' }, 503)
  const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
  const siteUrl = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '')

  let payload
  try { payload = await request.json() } catch { return json({ error: 'bad_json' }, 400) }
  const { tier, clinicId } = payload || {}
  const amount = PRICES[tier]
  if (!amount || !clinicId) return json({ error: 'bad_request' }, 400)

  // custom_id carries clinicId + tier so the capture step can activate the plan.
  const reference = `${clinicId}--${tier}--${Date.now()}`

  try {
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ error: 'auth_failed', message: tok.error_description || tok.error }, 400)

    const r = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: amount.toFixed(2) },
          custom_id: reference,
          description: `DentalCloud — ${tier}`,
        }],
        application_context: {
          brand_name: 'DentalCloud',
          user_action: 'PAY_NOW',
          return_url: `${siteUrl}/?paypal=return`,
          cancel_url: `${siteUrl}/?paypal=cancel`,
        },
      }),
    })
    const order = await r.json()
    const approve = (order.links || []).find((l) => l.rel === 'approve' || l.rel === 'payer-action')
    if (!order.id || !approve) return json({ error: 'order_failed', message: order.message, details: order.details }, 400)
    return json({ url: approve.href, orderId: order.id })
  } catch (e) {
    return json({ error: 'request_failed', message: String(e) }, 500)
  }
}
