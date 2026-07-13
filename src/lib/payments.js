// Client helpers for the PayPal payment flow. Calls the serverless payment
// functions at /api/* — works on Cloudflare Pages (native) and Netlify (redirect).
import { isCloud } from './supabaseClient'

// Real payments only run in cloud mode (the serverless functions need the host).
export const paymentsEnabled = isCloud

// ── PayPal ──────────────────────────────────────────────────────────────
const PENDING_PAYPAL_KEY = 'dentalcloud.pendingPaypalSubscription'

export async function startPaypalCheckout({ tier, clinicId, coupon, email }) {
  try {
    const r = await fetch('/api/paypal-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, clinicId, coupon, email }),
    })
    const data = await r.json().catch(() => ({}))
    if (r.ok && data.url) {
      if (data.subscriptionId) {
        try {
          sessionStorage.setItem(PENDING_PAYPAL_KEY, JSON.stringify({ subscriptionId: data.subscriptionId, clinicId, tier }))
        } catch { /* sessionStorage can be blocked; PayPal usually returns the id too */ }
      }
      return { ok: true, url: data.url, subscriptionId: data.subscriptionId }
    }
    return { ok: false, error: data.error || 'failed', message: data.message, status: r.status }
  } catch (e) {
    return { ok: false, error: 'network', message: String(e) }
  }
}

// Privately notify the app owner (by email, server-side) that a customer
// applied a gift/discount code — before they pay. Best-effort & fire-once per
// code/email/tier so it never blocks or spams checkout.
const _notifiedCoupons = new Set()
export async function notifyCouponUse({ email, tier, coupon }) {
  if (!coupon) return
  const key = `${coupon}|${email || ''}|${tier || ''}`
  if (_notifiedCoupons.has(key)) return
  _notifiedCoupons.add(key)
  try {
    await fetch('/api/coupon-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tier, coupon }),
    })
  } catch { /* notification is best-effort — never interrupt the purchase */ }
}

export async function capturePaypal(payment) {
  try {
    const payload = typeof payment === 'string' ? { orderId: payment } : payment
    const r = await fetch('/api/paypal-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await r.json()
    if (data.ok) {
      try { sessionStorage.removeItem(PENDING_PAYPAL_KEY) } catch { /* ignore */ }
    }
    return data
  } catch (e) {
    return { ok: false, error: 'network', message: String(e) }
  }
}

export async function syncPaypalSubscription({ subscriptionId, clinicId }) {
  if (!subscriptionId || !clinicId) return { ok: false, error: 'missing_subscription' }
  try {
    const r = await fetch('/api/paypal-subscription-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, clinicId }),
    })
    return await r.json()
  } catch (e) {
    return { ok: false, error: 'network', message: String(e) }
  }
}

// PayPal returns to …/?paypal=subscription&subscription_id=I-… for trials, or
// …/?paypal=return&token=ORDERID for legacy one-time orders.
export function getPaypalReturn() {
  const p = new URLSearchParams(window.location.search)
  if (p.get('paypal') === 'subscription') {
    let pending = {}
    try { pending = JSON.parse(sessionStorage.getItem(PENDING_PAYPAL_KEY) || '{}') } catch { pending = {} }
    const token = p.get('token') || ''
    const subscriptionId = p.get('subscription_id') || p.get('subscriptionId') || p.get('subscriptionID') || (token.startsWith('I-') ? token : '') || pending.subscriptionId
    return {
      type: 'subscription',
      subscriptionId,
      clinicId: p.get('clinic') || pending.clinicId,
      tier: p.get('tier') || pending.tier,
    }
  }
  if (p.get('paypal') === 'return') return { type: 'order', orderId: p.get('token') }
  return null
}

// Strip payment query params after handling a return.
export function clearPaymentReturn() {
  const url = new URL(window.location.href)
  url.search = ''
  window.history.replaceState({}, '', url.toString())
}
