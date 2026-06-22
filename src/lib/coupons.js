// ──────────────────────────────────────────────────────────────────────────
//  Promo / discount codes (client side).
//
//  ⚠️ KEEP IN SYNC WITH THE SERVERLESS PAYMENT FUNCTIONS:
//     netlify/functions/paypal-create.mjs · paypal-capture.mjs
//     functions/api/paypal-create.js      · paypal-capture.js
//  Those validate the discounted amount on the server, so any code added here
//  MUST exist there too (with the same percent) or the payment will be rejected.
// ──────────────────────────────────────────────────────────────────────────
export const COUPONS = {
  DENTAL40: { percent: 40 }, // 40% off any paid plan
}

// Normalize raw user input and look up the code.
// Returns { code, percent } for a valid code, or null otherwise.
export function lookupCoupon(raw) {
  const code = String(raw || '').trim().toUpperCase()
  if (!code) return null
  const c = COUPONS[code]
  return c ? { code, percent: c.percent } : null
}

// Apply a discount percent to a price, rounded to 2 decimals.
export function applyDiscount(price, percent) {
  if (!percent) return price
  return Math.round(price * (1 - percent / 100) * 100) / 100
}
