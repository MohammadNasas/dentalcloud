// A paid year belongs to a verified payment, not to automatic-renewal status.
// These helpers are shared by the server handlers and the access gate.
import { periodEnd, subscriptionPlan, subscriptionPlanFromPayPal } from './subscriptionPlans.js'
const timeOf = (value) => typeof value === 'string' && value ? Date.parse(value) : NaN

export function annualPaidThrough(paymentTime) {
  const timestamp = timeOf(paymentTime)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  const month = date.getUTCMonth()
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  // A February 29 payment ends on February 28 in a non-leap year.
  if (date.getUTCMonth() !== month) date.setUTCDate(0)
  return date.toISOString()
}

function validPayment(payment, now) {
  const timestamp = timeOf(payment?.time)
  return payment && Number.isFinite(timestamp) && timestamp <= now + 300_000
    && Number.isFinite(Number(payment.amount)) && Number(payment.amount) === subscriptionPlan(payment.planId || 'pro')?.price
    && String(payment.currency || '').toUpperCase() === 'USD'
}

export function paymentIsRevoked(clinic, payment) {
  const paymentTime = timeOf(payment?.time)
  return (clinic?.subscriptionRevokedPayments || []).some((revoked) =>
    (revoked.id && payment?.id && revoked.id === payment.id)
    || (Number.isFinite(paymentTime) && timeOf(revoked.time) === paymentTime))
}

export function savedVerifiedPayment(clinic) {
  if (clinic?.subscriptionPaymentVerified !== true) return null
  return {
    id: clinic.subscriptionVerifiedPaymentId || null,
    planId: clinic.subscriptionVerifiedPlan || 'pro',
    amount: clinic.subscriptionVerifiedAmount,
    currency: clinic.subscriptionVerifiedCurrency,
    time: clinic.subscriptionLastPaidAt || clinic.paidAt || null,
    source: clinic.subscriptionPaymentVerificationSource || 'verified_saved_payment',
  }
}

export function paymentFromSubscription(subscription) {
  const last = subscription?.billing_info?.last_payment
  return last ? {
    id: last.id || null,
    amount: Number(last.amount?.value ?? last.amount?.total),
    currency: String(last.amount?.currency_code || last.amount?.currency || '').toUpperCase(),
    time: last.time || null,
    source: 'paypal_subscription',
    planId: subscriptionPlanFromPayPal(subscription)?.id || 'unknown',
  } : null
}

export function getPaidThrough(clinic) {
  // Derive legacy records only from an actual verified payment timestamp.
  // An explicit expiry is never extended by a status sync or repeated callback.
  const payment = savedVerifiedPayment(clinic)
  const end = periodEnd(payment?.time, subscriptionPlan(payment?.planId)?.period)
  if (!clinic?.paidThrough) return end
  if (!Number.isFinite(timeOf(clinic.paidThrough))) return null
  return end && timeOf(end) < timeOf(clinic.paidThrough) ? end : clinic.paidThrough
}

export function hasVerifiedPaidAccess(clinic, now = Date.now()) {
  if (!clinic?.paid) return false
  if (clinic.subscriptionProvider !== 'paypal') return !clinic.paidThrough || timeOf(clinic.paidThrough) > now
  const payment = savedVerifiedPayment(clinic)
  return Boolean(validPayment(payment, now) && !paymentIsRevoked(clinic, payment)
    && timeOf(getPaidThrough(clinic)) > now)
}

// New Pro accounts must complete activation before entering the workspace.
// Former subscribers keep read/export access after their entitlement expires.
// A pending PayPal agreement alone is not a previous entitlement.
export function requiresInitialSubscription(clinic, now = Date.now()) {
  if (!clinic || clinic.tier === 'student' || hasVerifiedPaidAccess(clinic, now)) return false
  if (timeOf(clinic.trialEndsAt) > now) return false
  const previousEntitlement = [clinic.trialStartedAt, clinic.trialUsedAt,
    clinic.trialEndsAt, clinic.paidAt, clinic.subscriptionLastPaidAt, clinic.paidThrough]
    .some((value) => Number.isFinite(timeOf(value)))
  return !previousEntitlement
}

export function paidEntitlementPatch(clinic, incomingPayment = null, now = Date.now()) {
  const existing = savedVerifiedPayment(clinic)
  let payment = validPayment(existing, now) && !paymentIsRevoked(clinic, existing) ? existing : null
  const incomingValid = validPayment(incomingPayment, now) && !paymentIsRevoked(clinic, incomingPayment)
  if (incomingValid && (!payment || timeOf(incomingPayment.time) > timeOf(payment.time))) {
    payment = incomingPayment
  } else if (incomingValid && payment && timeOf(incomingPayment.time) === timeOf(payment.time)) {
    // Subscription lookup often omits the sale ID. Keep the ID from a webhook.
    payment = { ...payment, ...incomingPayment, id: incomingPayment.id || payment.id }
  }
  if (!payment) return { paid: false, paidThrough: null, subscriptionPaymentVerified: false }
  const samePayment = existing && timeOf(existing.time) === timeOf(payment.time)
  const plan = subscriptionPlan(payment.planId || 'pro')
  const anniversary = periodEnd(payment.time, plan.period)
  // Preserve an already shorter contractual period; reject arbitrary extensions.
  const storedEnd = samePayment ? timeOf(clinic.paidThrough) : NaN
  const paidThrough = Number.isFinite(storedEnd) && storedEnd > timeOf(payment.time)
    && storedEnd < timeOf(anniversary) ? new Date(storedEnd).toISOString() : anniversary
  return {
    paid: timeOf(paidThrough) > now,
    paidThrough,
    paidAt: payment.time,
    subscriptionPaymentVerified: true,
    subscriptionVerifiedAmount: Number(payment.amount),
    subscriptionVerifiedPlan: plan.id,
    subscriptionVerifiedCurrency: 'USD',
    subscriptionVerifiedPaymentId: payment.id || null,
    subscriptionPaymentVerificationSource: payment.source,
    subscriptionLastPaidAt: payment.time,
  }
}

export function revokePaymentPatch(clinic, { id, time, eventId, revokedAt }, now = Date.now()) {
  const current = savedVerifiedPayment(clinic)
  const matchesCurrent = Boolean(current && ((id && current.id === id)
    || (time && timeOf(current.time) === timeOf(time))))
  const marker = { id: id || null, time: time || (matchesCurrent ? current.time : null), eventId, revokedAt }
  const previous = clinic.subscriptionRevokedPayments || []
  const alreadyRecorded = previous.some((row) => (id && row.id === id) || (eventId && row.eventId === eventId))
  const subscriptionRevokedPayments = alreadyRecorded ? previous : [...previous, marker]
  const updated = { ...clinic, subscriptionRevokedPayments }
  return { subscriptionRevokedPayments, ...paidEntitlementPatch(updated, null, now) }
}
