// Client helpers for the PayPal payment flow. Calls the serverless payment
// functions at /api/* — works on Cloudflare Pages (native) and Netlify (redirect).
import { isCloud } from './supabaseClient'

// Real payments only run in cloud mode (the serverless functions need the host).
export const paymentsEnabled = isCloud

// ── PayPal ──────────────────────────────────────────────────────────────
export async function startPaypalCheckout({ tier, clinicId, coupon }) {
  try {
    const r = await fetch('/api/paypal-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, clinicId, coupon }),
    })
    const data = await r.json().catch(() => ({}))
    if (r.ok && data.url) return { ok: true, url: data.url }
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

export async function capturePaypal(orderId) {
  try {
    const r = await fetch('/api/paypal-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    return await r.json()
  } catch (e) {
    return { ok: false, error: 'network', message: String(e) }
  }
}

// PayPal returns to  …/?paypal=return&token=ORDERID&PayerID=…  Returns the
// order id to capture, or null if this isn't a PayPal return.
export function getPaypalReturn() {
  const p = new URLSearchParams(window.location.search)
  if (p.get('paypal') === 'return') return p.get('token')
  return null
}

// Strip payment query params after handling a return.
export function clearPaymentReturn() {
  const url = new URL(window.location.href)
  url.search = ''
  window.history.replaceState({}, '', url.toString())
}
