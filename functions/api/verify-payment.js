// Cloudflare Pages Function: verifies a Lahza payment and (if paid) activates
// the clinic's plan in Supabase. Uses Supabase's REST API directly via fetch
// (no supabase-js → works natively on the Cloudflare Workers runtime).
// Route: POST /api/verify-payment
// Env vars: LAHZA_SECRET_KEY, LAHZA_BASE (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

export const onRequestPost = async ({ request, env }) => {
  const secret = env.LAHZA_SECRET_KEY
  const base = (env.LAHZA_BASE || 'https://api.lahza.io').replace(/\/$/, '')
  if (!secret) return json({ ok: false, error: 'not_configured' }, 503)

  let payload
  try { payload = await request.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  const { reference } = payload || {}
  if (!reference) return json({ ok: false, error: 'no_reference' }, 400)

  // 1) Check the payment status with Lahza
  let tx
  try {
    const r = await fetch(`${base}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await r.json()
    if (!data.status) return json({ ok: false, error: 'status_failed', message: data.message }, 400)
    tx = data.data
  } catch (e) {
    return json({ ok: false, error: 'request_failed', message: String(e) }, 500)
  }

  if (!tx || tx.status !== 'success') return json({ ok: false, status: tx?.status || 'unknown' })

  // 2) Recover clinicId + tier — from metadata, falling back to the reference
  //    (reference format = "clinicId--tier--timestamp").
  let clinicId, tier
  try {
    const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata
    clinicId = meta?.clinicId; tier = meta?.tier
  } catch { /* fall back to the reference below */ }
  if (!clinicId || !tier) {
    const parts = String(tx.reference || reference).split('--')
    clinicId = parts[0]; tier = parts[1]
  }
  if (!clinicId || !['student', 'economy', 'pro'].includes(tier)) {
    return json({ ok: false, error: 'bad_reference' }, 400)
  }

  // 3) Anti-tampering: the paid amount must match the tier's price.
  //    Prices are defined in USD, so only enforce exact match for USD charges;
  //    for other currencies just require a positive amount.
  const paid = Number(tx.amount)
  if ((tx.currency || 'USD') === 'USD' && paid !== PRICES[tier] * 100) {
    return json({ ok: false, error: 'amount_mismatch', paid, expected: PRICES[tier] * 100 }, 400)
  }
  if (!(paid > 0)) return json({ ok: false, error: 'amount_mismatch', paid }, 400)

  // 4) Activate the plan
  const supaUrl = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

  try {
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
