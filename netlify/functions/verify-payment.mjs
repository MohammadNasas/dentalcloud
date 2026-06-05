// Netlify Function: verifies a MyFatoorah payment and (if paid) activates the
// clinic's plan in Supabase. Uses Supabase's REST API directly via fetch (no
// supabase-js → avoids the realtime/WebSocket dependency, works on any Node).
// Secrets: MYFATOORAH_TOKEN, MYFATOORAH_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })

export default async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const token = process.env.MYFATOORAH_TOKEN
  const base = process.env.MYFATOORAH_BASE || 'https://apitest.myfatoorah.com'
  if (!token) return json({ ok: false, error: 'not_configured' }, 503)

  let payload
  try { payload = await req.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  const { paymentId } = payload || {}
  if (!paymentId) return json({ ok: false, error: 'no_payment_id' }, 400)

  // 1) Check the payment status with MyFatoorah
  let inv
  try {
    const r = await fetch(`${base}/v2/GetPaymentStatus`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ Key: paymentId, KeyType: 'PaymentId' }),
    })
    const data = await r.json()
    if (!data.IsSuccess) return json({ ok: false, error: 'status_failed', message: data.Message }, 400)
    inv = data.Data
  } catch (e) {
    return json({ ok: false, error: 'request_failed', message: String(e) }, 500)
  }

  if (inv.InvoiceStatus !== 'Paid') return json({ ok: false, status: inv.InvoiceStatus })

  // 2) Activate the plan (CustomerReference = "clinicId:tier")
  const [clinicId, tier] = String(inv.CustomerReference || '').split(':')
  if (!clinicId || !['student', 'economy', 'pro'].includes(tier)) return json({ ok: false, error: 'bad_reference' }, 400)

  const supaUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

  try {
    // fetch current clinic data
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
