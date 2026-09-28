import { saveSubscription } from '../../src/lib/saveSubscription.js'
// Cloudflare Pages Function: sync a clinic's PayPal subscription status.
// Route: POST /api/paypal-subscription-status
import { paidEntitlementPatch, paymentFromSubscription } from '../../src/lib/entitlement.js'
const ACTIVE_STATUSES = new Set(['ACTIVE'])
const PRO_PRICE = 50

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

async function token(base, id, secret) {
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  return r.json()
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

async function userBelongsToClinic(supaUrl, headers, userId, clinicId) {
  const url = new URL(`${supaUrl}/rest/v1/doctors`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('id', `eq.${userId}`)
  url.searchParams.set('clinic_id', `eq.${clinicId}`)
  const r = await fetch(url, { headers })
  const rows = await r.json().catch(() => [])
  return r.ok && Array.isArray(rows) && rows.length > 0
}

async function updateSubscriptionPrice(base, accessToken, subscriptionId, sequence) {
  const r = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{
      op: 'replace',
      path: `/plan/billing_cycles/@sequence==${sequence}/pricing_scheme/fixed_price`,
      value: { currency_code: 'USD', value: PRO_PRICE.toFixed(2) },
    }]),
  })
  return r.ok
}

async function getTrialBySubscription(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('select', 'email,user_id,clinic_id,status,paypal_subscription_id,paypal_payer_id,paypal_email,paypal_payment_token_id')
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`trial_lookup_failed: ${await r.text()}`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows[0] || null : null
}

// Older subscriptions may predate the permanent ledger. Create their row on
// first sync so the same PayPal identity can still be checked and revoked.
async function ensureTrial(supaUrl, headers, { user, clinicId, subscriptionId, clinic }) {
  const existing = await getTrialBySubscription(supaUrl, headers, subscriptionId)
  if (existing) return existing.clinic_id === clinicId ? existing : null

  const now = new Date().toISOString()
  const r = await fetch(`${supaUrl}/rest/v1/subscription_trials?on_conflict=email`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      email: user.email,
      user_id: user.id,
      clinic_id: clinicId,
      status: clinic.subscriptionPaymentVerified === true ? 'paid' : 'active',
      paypal_subscription_id: subscriptionId,
      trial_started_at: clinic.trialStartedAt || clinic.trialUsedAt || null,
      trial_ends_at: clinic.trialEndsAt || null,
      created_at: clinic.trialStartedAt || clinic.trialUsedAt || now,
      updated_at: now,
    }),
  })
  if (!r.ok) throw new Error(`trial_backfill_failed: ${await r.text()}`)
  const rows = await r.json().catch(() => [])
  if (Array.isArray(rows) && rows[0]) return rows[0]
  return getTrialBySubscription(supaUrl, headers, subscriptionId)
}

async function claimPaypalIdentity(supaUrl, headers, subscriptionId, subscription) {
  const payerId = String(subscription?.subscriber?.payer_id || '').trim()
  const email = normalizeEmail(subscription?.subscriber?.email_address)
  const paymentTokenId = String(
    subscription?.subscriber?.payment_source?.card?.attributes?.vault?.id
    || subscription?.subscriber?.payment_source?.paypal?.attributes?.vault?.id
    || subscription?.payment_source?.card?.attributes?.vault?.id
    || subscription?.payment_source?.paypal?.attributes?.vault?.id
    || ''
  ).trim()
  if (!payerId && !email && !paymentTokenId) return false
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      ...(payerId ? { paypal_payer_id: payerId } : {}),
      ...(email ? { paypal_email: email } : {}),
      ...(paymentTokenId ? { paypal_payment_token_id: paymentTokenId } : {}),
      updated_at: new Date().toISOString(),
    }),
  })
  if (r.status === 409) return false
  if (!r.ok) throw new Error(`paypal_identity_claim_failed: ${await r.text()}`)
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) && rows.length === 1
}

async function cancelSubscription(base, accessToken, subscriptionId) {
  await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Free trial already used by this PayPal account' }),
  })
}

async function cancelTrialReservation(supaUrl, headers, subscriptionId) {
  const url = new URL(`${supaUrl}/rest/v1/subscription_trials`)
  url.searchParams.set('paypal_subscription_id', `eq.${subscriptionId}`)
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
  })
  if (!r.ok) throw new Error(`trial_cancel_failed: ${await r.text()}`)
}

async function saveClinic(supaUrl, headers, clinicId, data, previous) {
  const saved = await saveSubscription(supaUrl, headers, clinicId, previous, data)
  Object.assign(data, saved)
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
    const user = await authenticatedUser(supaUrl, serviceKey, request)
    if (!user) return json({ ok: false, error: 'unauthorized' }, 401)
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    if (!await userBelongsToClinic(supaUrl, headers, user.id, clinicId)) return json({ ok: false, error: 'clinic_access_denied' }, 403)

    const base = (env.PAYPAL_BASE || 'https://api-m.paypal.com').replace(/\/$/, '')
    const tok = await token(base, id, secret)
    if (!tok.access_token) return json({ ok: false, error: 'auth_failed' }, 400)

    const subR = await fetch(`${base}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    })
    const sub = await subR.json().catch(() => ({}))
    if (!subR.ok) return json({ ok: false, error: 'subscription_lookup_failed', message: sub.message }, subR.status)

    const [refClinicId, , refMode] = String(sub.custom_id || '').split('--')
    const checkoutMode = refMode === 'paid' ? 'paid' : 'trial'
    if (!refClinicId || refClinicId !== clinicId) return json({ ok: false, error: 'subscription_clinic_mismatch' }, 403)

    const getR = await fetch(`${supaUrl}/rest/v1/clinics?id=eq.${clinicId}&select=data`, { headers })
    const rows = await getR.json()
    if (!Array.isArray(rows) || rows.length === 0) return json({ ok: false, error: 'clinic_not_found' }, 404)

    const clinic = rows[0].data
    // Status sync must only ever update the subscription already attached to
    // this clinic. Otherwise an abandoned second checkout could replace the
    // original subscription record.
    if (clinic.paypalSubscriptionId !== subscriptionId)
      return json({ ok: false, error: 'subscription_not_current' }, 409)
    // ACTIVE also describes the free trial. It must never be treated as proof
    // of payment. Only an exact $50 USD payment reported by PayPal unlocks paid.
    const entitlement = paidEntitlementPatch(clinic, paymentFromSubscription(sub))
    const paid = entitlement.paid
    // A completed paid period never becomes a new/duplicate free trial.
    if (checkoutMode === 'trial' && ACTIVE_STATUSES.has(sub.status) && !entitlement.subscriptionPaymentVerified
      && !clinic.subscriptionLastPaidAt && !clinic.subscriptionRevokedPayments?.length) {
      const trial = await ensureTrial(supaUrl, headers, { user, clinicId, subscriptionId, clinic })
      const identityAccepted = trial && await claimPaypalIdentity(supaUrl, headers, subscriptionId, sub)
      if (!identityAccepted) {
        await cancelSubscription(base, tok.access_token, subscriptionId)
        if (trial) await cancelTrialReservation(supaUrl, headers, subscriptionId)
        const now = new Date().toISOString()
        const blockedData = {
          ...clinic,
          paid: false,
          paidAt: null,
          trialEndsAt: now,
          subscriptionStatus: 'CANCELLED_DUPLICATE_TRIAL',
          subscriptionPaymentVerified: false,
          subscriptionVerifiedAmount: null,
          subscriptionVerifiedCurrency: null,
          subscriptionVerifiedPaymentId: null,
          subscriptionPaymentVerificationSource: null,
          subscriptionStoppedAt: now,
          duplicateTrialBlockedAt: now,
        }
        await saveClinic(supaUrl, headers, clinicId, blockedData, clinic)
        return json({ ok: true, status: blockedData.subscriptionStatus, paid: false, error: 'trial_already_used', requiresPaidCheckout: true, duplicateTrialBlocked: true, clinic: { ...blockedData, id: clinicId } })
      }
    }
    let priceUpdated = Number(clinic.renewalPrice) === PRO_PRICE && !clinic.renewalPriceUpdatePending
    if (paid && ACTIVE_STATUSES.has(sub.status) && !priceUpdated) priceUpdated = await updateSubscriptionPrice(base, tok.access_token, subscriptionId, checkoutMode === 'paid' ? 1 : 2)
    const now = new Date().toISOString()
    const nextData = {
      ...clinic,
      ...entitlement,
      tier: clinic.tier === 'economy' ? 'pro' : clinic.tier,
      subscriptionProvider: 'paypal',
      paypalSubscriptionId: subscriptionId,
      subscriptionStatus: sub.status,
      subscriptionStatusUpdatedAt: sub.status_update_time || now,
      subscriptionSyncedAt: now,
      nextBillingTime: sub.billing_info?.next_billing_time || clinic.nextBillingTime,
      ...(priceUpdated ? { renewalPrice: PRO_PRICE, renewalCurrency: 'USD', renewalPriceUpdatedAt: now } : {}),
      renewalPriceUpdatePending: paid && !priceUpdated,
      ...(ACTIVE_STATUSES.has(sub.status) ? { subscriptionStoppedAt: null } : { subscriptionStoppedAt: now }),
    }
    await saveClinic(supaUrl, headers, clinicId, nextData, clinic)
    return json({ ok: true, status: sub.status, paid, paymentVerified: entitlement.subscriptionPaymentVerified, checkoutMode, paymentPending: checkoutMode === 'paid' && ACTIVE_STATUSES.has(sub.status) && !paid, clinic: { ...nextData, id: clinicId } })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
