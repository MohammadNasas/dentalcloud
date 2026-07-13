// Cloudflare Pages Function: sync a clinic's PayPal subscription status.
// Route: POST /api/paypal-subscription-status
const ACTIVE_STATUSES = new Set(['ACTIVE'])

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

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    const getR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}&select=data`, { headers })
    const rows = await getR.json()
    if (!Array.isArray(rows) || rows.length === 0) return json({ ok: false, error: 'clinic_not_found' }, 404)

    const paid = ACTIVE_STATUSES.has(sub.status)
    const nextData = {
      ...rows[0].data,
      paid,
      subscriptionProvider: 'paypal',
      paypalSubscriptionId: subscriptionId,
      subscriptionStatus: sub.status,
      subscriptionSyncedAt: new Date().toISOString(),
      nextBillingTime: sub.billing_info?.next_billing_time || rows[0].data?.nextBillingTime,
      ...(paid ? {} : { subscriptionStoppedAt: new Date().toISOString() }),
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
