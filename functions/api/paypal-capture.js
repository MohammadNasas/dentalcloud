// Cloudflare Pages Function: captures an approved PayPal order and (if paid)
// activates the clinic's plan in Supabase.
// Route: POST /api/paypal-capture
// Env vars: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_BASE (optional),
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const PRICES = { student: 5, economy: 70, pro: 100 }

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
  const id = env.PAYPAL_CLIENT_ID, secret = env.PAYPAL_SECRET
  if (!id || !secret) return json({ ok: false, error: 'not_configured' }, 503)
  const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')

  let payload
  try { payload = await request.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  const { orderId } = payload || {}
  if (!orderId) return json({ ok: false, error: 'no_order' }, 400)

  try {
    // 1) Auth + capture the order
    const tokRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })
    const tok = await tokRes.json()
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)

    const capRes = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    })
    const cap = await capRes.json()
    if (cap.status !== 'COMPLETED') return json({ ok: false, status: cap.status || 'unknown', message: cap.message })

    // 2) Recover clinicId + tier from custom_id ("clinicId--tier--timestamp")
    const pu = (cap.purchase_units || [])[0] || {}
    const capture = pu.payments?.captures?.[0] || {}
    const reference = capture.custom_id || pu.custom_id || ''
    const paid = Number(capture.amount?.value || 0)
    const [clinicId, tier] = String(reference).split('--')
    if (!clinicId || !['student', 'economy', 'pro'].includes(tier)) return json({ ok: false, error: 'bad_reference' }, 400)

    // 3) Anti-tampering: captured USD amount must match the tier price
    if (paid !== PRICES[tier]) return json({ ok: false, error: 'amount_mismatch', paid, expected: PRICES[tier] }, 400)

    // 4) Activate the plan
    const supaUrl = env.SUPABASE_URL, serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
    if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

    const getR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}&select=data`, { headers })
    const rows = await getR.json()
    if (!Array.isArray(rows) || rows.length === 0) return json({ ok: false, error: 'clinic_not_found' }, 404)

    const nextData = { ...rows[0].data, tier, paid: true, paidAt: new Date().toISOString() }
    const upR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ data: nextData }),
    })
    if (!upR.ok) return json({ ok: false, error: 'update_failed', message: await upR.text() }, 500)
    return json({ ok: true, tier, clinicId })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500)
  }
}
