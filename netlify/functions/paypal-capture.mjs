// Netlify Function: finalizes PayPal checkout.
// New flow: verifies an approved PayPal subscription/trial and activates the clinic.
// Legacy flow: still captures old one-time PayPal orders if a user returns from one.
const PRICES = { pro: 50 }
// Kept only so a checkout created before Economy was retired can still finish.
const LEGACY_PRICES = { economy: 70 }
const COUPONS = { DENTAL40: 40 }
const expectedPrice = (tier, code) => {
  const pct = COUPONS[String(code || '').trim().toUpperCase()] || 0
  const base = PRICES[tier] || LEGACY_PRICES[tier] || 0
  return Math.round(base * (1 - pct / 100) * 100) / 100
}
const canonicalTier = (tier) => tier === 'economy' ? 'pro' : tier
const validTier = (tier) => Boolean(PRICES[tier] || LEGACY_PRICES[tier])
const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

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

async function authenticatedUser(supaUrl, serviceKey, request) {
  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer\s+.+/i.test(authorization)) return null
  const r = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: authorization },
  })
  if (!r.ok) return null
  const user = await r.json().catch(() => null)
  return user?.id ? user : null
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

async function updateSubscriptionPrice(base, accessToken, subscriptionId, sequence) {
  const r = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{
      op: 'replace',
      path: `/plan/billing_cycles/@sequence==${sequence}/pricing_scheme/fixed_price`,
      value: { currency_code: 'USD', value: PRICES.pro.toFixed(2) },
    }]),
  })
  return r.ok
}

function verifiedPaymentFromSubscription(sub) {
  const last = sub?.billing_info?.last_payment
  const amount = Number(last?.amount?.value ?? last?.amount?.total)
  const currency = String(last?.amount?.currency_code || last?.amount?.currency || '').toUpperCase()
  if (!Number.isFinite(amount) || Math.abs(amount - PRICES.pro) > 0.01 || currency !== 'USD') return null
  return { id: last.id || null, amount, currency, time: last.time || null, source: 'paypal_subscription' }
}

async function cancelSubscription(base, accessToken, subscriptionId) {
  if (!subscriptionId) return
  await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'A free trial was already used for this account' }),
  })
}

async function getTrialBySubscription(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('select', 'email,user_id,clinic_id,status,paypal_subscription_id,paypal_payer_id,paypal_email,paypal_payment_token_id,trial_started_at,trial_ends_at')
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`trial_lookup_failed: ${await r.text()}`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows[0] || null : null
}

function paypalIdentity(subscription) {
  const payerId = String(subscription?.subscriber?.payer_id || '').trim()
  const email = normalizeEmail(subscription?.subscriber?.email_address)
  const paymentTokenId = String(
    subscription?.subscriber?.payment_source?.card?.attributes?.vault?.id
    || subscription?.subscriber?.payment_source?.paypal?.attributes?.vault?.id
    || subscription?.payment_source?.card?.attributes?.vault?.id
    || subscription?.payment_source?.paypal?.attributes?.vault?.id
    || ''
  ).trim()
  return { payerId: payerId || null, email: email || null, paymentTokenId: paymentTokenId || null }
}

// App emails can be changed by creating a second account. The PayPal payer ID,
// billing email, and saved payment token form the cross-account trial identity.
async function claimPaypalIdentity(supaUrl, headers, subscriptionId, identity) {
  if (!identity.payerId && !identity.email && !identity.paymentTokenId) return false
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      ...(identity.payerId ? { paypal_payer_id: identity.payerId } : {}),
      ...(identity.email ? { paypal_email: identity.email } : {}),
      ...(identity.paymentTokenId ? { paypal_payment_token_id: identity.paymentTokenId } : {}),
      updated_at: new Date().toISOString(),
    }),
  })
  // A unique-index conflict means that this PayPal/payment identity has already
  // claimed a trial through another app account.
  if (r.status === 409) return false
  if (!r.ok) throw new Error(`paypal_identity_claim_failed: ${await r.text()}`)
  return true
}

async function activateTrial(supaUrl, headers, subscriptionId, trialStartedAt, trialEndsAt) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'active',
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!r.ok) throw new Error(`trial_activation_failed: ${await r.text()}`)
}

async function finalizeSubscription({ base, accessToken, supaUrl, headers, userId, subscriptionId, clinicId: hintedClinicId, tier: hintedTier }) {
  if (!subscriptionId) return json({ ok: false, error: 'no_subscription' }, 400)
  const subR = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  })
  const sub = await subR.json().catch(() => ({}))
  if (!subR.ok) return json({ ok: false, error: 'subscription_lookup_failed', status: sub.status, message: sub.message }, subR.status)

  const [refClinicId, refTier, refMode] = String(sub.custom_id || '').split('--')
  const clinicId = refClinicId || hintedClinicId
  const originalTier = refTier || hintedTier
  const tier = canonicalTier(originalTier)
  const checkoutMode = refMode === 'paid' ? 'paid' : 'trial'
  if (!clinicId || !validTier(originalTier) || !PRICES[tier]) return json({ ok: false, error: 'bad_subscription_reference' }, 400)
  if (!await userBelongsToClinic(supaUrl, headers, userId, clinicId)) return json({ ok: false, error: 'clinic_access_denied' }, 403)
  if (sub.status !== 'ACTIVE') return json({ ok: false, error: 'subscription_not_active', status: sub.status }, 400)

  const clinic = await getClinic(supaUrl, headers, clinicId)
  if (!clinic) return json({ ok: false, error: 'clinic_not_found' }, 404)

  if (checkoutMode === 'paid') {
    // This plan has no trial cycle. PayPal should charge immediately; if its
    // subscription lookup lags behind the payment event, attach it but keep the
    // clinic locked until status sync/webhook verifies exactly $50 USD.
    const now = new Date().toISOString()
    const verifiedPayment = verifiedPaymentFromSubscription(sub)
    const paid = Boolean(verifiedPayment)
    const priceUpdated = await updateSubscriptionPrice(base, accessToken, subscriptionId, 1)
    const nextData = {
      ...clinic,
      tier,
      paid,
      paidAt: paid ? (verifiedPayment.time || now) : null,
      subscriptionProvider: 'paypal',
      paypalSubscriptionId: subscriptionId,
      subscriptionStatus: sub.status,
      subscriptionPaymentVerified: paid,
      subscriptionVerifiedAmount: paid ? verifiedPayment.amount : null,
      subscriptionVerifiedCurrency: paid ? verifiedPayment.currency : null,
      subscriptionVerifiedPaymentId: paid ? verifiedPayment.id : null,
      subscriptionPaymentVerificationSource: paid ? verifiedPayment.source : null,
      subscriptionLastPaidAt: paid ? (verifiedPayment.time || now) : null,
      nextBillingTime: sub.billing_info?.next_billing_time || clinic.nextBillingTime,
      renewalPrice: priceUpdated ? PRICES[tier] : clinic.renewalPrice,
      renewalCurrency: 'USD',
      renewalPriceUpdatePending: !priceUpdated,
      ...(priceUpdated ? { renewalPriceUpdatedAt: now } : {}),
    }
    await saveClinic(supaUrl, headers, clinicId, nextData)
    return json({
      ok: true,
      tier,
      clinicId,
      subscription: true,
      subscriptionId,
      checkoutMode,
      trial: false,
      paid,
      paymentPending: !paid,
      nextBillingTime: nextData.nextBillingTime,
    })
  }

  const trial = await getTrialBySubscription(supaUrl, headers, subscriptionId)
  const isCurrentSubscription = clinic.paypalSubscriptionId === subscriptionId
  // A legacy subscription that was already accepted before this ledger existed
  // remains retry-safe. Every new trial must have a reservation in the ledger.
  const legacyRetry = isCurrentSubscription && Boolean(clinic.trialStartedAt || clinic.trialUsedAt)
  if ((!trial || trial.clinic_id !== clinicId) && !legacyRetry) {
    await cancelSubscription(base, accessToken, subscriptionId)
    return json({ ok: false, error: 'trial_not_reserved' }, 409)
  }
  if (trial && !await claimPaypalIdentity(supaUrl, headers, subscriptionId, paypalIdentity(sub))) {
    await cancelSubscription(base, accessToken, subscriptionId)
    return json({ ok: false, error: 'trial_already_used', requiresPaidCheckout: true, clinicId, tier }, 409)
  }
  if ((clinic.trialStartedAt || clinic.trialUsedAt || clinic.paypalSubscriptionId) && !isCurrentSubscription) {
    await cancelSubscription(base, accessToken, subscriptionId)
    return json({ ok: false, error: 'trial_already_used', requiresPaidCheckout: true, clinicId, tier }, 409)
  }

  const now = new Date().toISOString()
  const trialStartedAt = clinic.trialStartedAt || clinic.trialUsedAt || now
  const nextBillingTime = clinic.trialEndsAt || sub.billing_info?.next_billing_time || addOneMonthIso()
  if (trial) await activateTrial(supaUrl, headers, subscriptionId, trialStartedAt, nextBillingTime)
  const priceUpdated = await updateSubscriptionPrice(base, accessToken, subscriptionId, 2)
  const nextData = {
    ...clinic,
    tier,
    // Subscription approval starts the free trial; it is not a payment.
    // paid becomes true only after a verified $50 PayPal payment.
    paid: false,
    paidAt: null,
    subscriptionProvider: 'paypal',
    paypalSubscriptionId: subscriptionId,
    subscriptionStatus: sub.status,
    subscriptionPaymentVerified: false,
    subscriptionVerifiedAmount: null,
    subscriptionVerifiedCurrency: null,
    subscriptionVerifiedPaymentId: null,
    subscriptionPaymentVerificationSource: null,
    subscriptionLastPaidAt: null,
    // These fields are intentionally never reset: the same email can never
    // receive a second free month after cancelling or returning later.
    trialUsedAt: clinic.trialUsedAt || trialStartedAt,
    trialStartedAt,
    trialEndsAt: nextBillingTime,
    nextBillingTime,
    renewalPrice: priceUpdated ? PRICES[tier] : clinic.renewalPrice,
    renewalCurrency: 'USD',
    renewalPriceUpdatePending: !priceUpdated,
    ...(priceUpdated ? { renewalPriceUpdatedAt: now } : {}),
  }
  await saveClinic(supaUrl, headers, clinicId, nextData)
  return json({ ok: true, tier, clinicId, subscription: true, subscriptionId, checkoutMode, trial: true, trialEndsAt: nextData.trialEndsAt, nextBillingTime })
}

async function finalizeLegacyOrder({ base, accessToken, supaUrl, headers, userId, orderId }) {
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
  const [clinicId, originalTier, coupon] = String(reference).split('--')
  const tier = canonicalTier(originalTier)
  if (!clinicId || !validTier(originalTier) || !PRICES[tier]) return json({ ok: false, error: 'bad_reference' }, 400)
  if (!await userBelongsToClinic(supaUrl, headers, userId, clinicId)) return json({ ok: false, error: 'clinic_access_denied' }, 403)

  const expected = expectedPrice(originalTier, coupon)
  if (Math.abs(paid - expected) > 0.01) return json({ ok: false, error: 'amount_mismatch', paid, expected }, 400)

  const clinic = await getClinic(supaUrl, headers, clinicId)
  if (!clinic) return json({ ok: false, error: 'clinic_not_found' }, 404)
  const nextData = { ...clinic, tier, paid: true, paidAt: new Date().toISOString(), subscriptionProvider: 'paypal-order' }
  await saveClinic(supaUrl, headers, clinicId, nextData)
  return json({ ok: true, tier, clinicId })
}

export default async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405)

  const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET
  if (!id || !secret) return json({ ok: false, error: 'not_configured' }, 503)
  const supaUrl = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return json({ ok: false, error: 'supabase_not_configured' }, 503)

  let payload
  try { payload = await req.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }

  try {
    const user = await authenticatedUser(supaUrl, serviceKey, req)
    if (!user) return json({ ok: false, error: 'unauthorized' }, 401)
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
        userId: user.id,
        subscriptionId: payload.subscriptionId,
        clinicId: payload.clinicId,
        tier: payload.tier,
      })
    }
    return finalizeLegacyOrder({ base, accessToken: tok.access_token, supaUrl, headers, userId: user.id, orderId: payload?.orderId })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
