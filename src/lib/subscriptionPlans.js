// Plan IDs describe billing only. Both paid plans grant the existing Pro tier.
export const SUBSCRIPTION_PLANS = {
  pro: { id: 'pro', price: 50, period: 'year', interval: 'YEAR', trialUnit: 'MONTH', trialCount: 1 },
  pro_monthly: { id: 'pro_monthly', price: 7, period: 'month', interval: 'MONTH', trialUnit: 'DAY', trialCount: 3 },
}

export function subscriptionPlan(id) {
  const key = id === 'economy' ? 'pro' : id
  return Object.hasOwn(SUBSCRIPTION_PLANS, key) ? SUBSCRIPTION_PLANS[key] : null
}

export function subscriptionPlanFromPayPal(subscription) {
  return subscriptionPlan(String(subscription?.custom_id || '').split('--')[1])
}

export function periodEnd(time, period = 'year') {
  const date = new Date(time || NaN)
  if (!Number.isFinite(date.getTime())) return null
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + (period === 'month' ? 1 : 12))
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString()
}

export function trialEnd(time, planId) {
  if (planId !== 'pro_monthly') return periodEnd(time, 'month')
  const stamp = Date.parse(time)
  return Number.isFinite(stamp) ? new Date(stamp + 3 * 86400000).toISOString() : null
}

export function trialLabel(plan, t) {
  return t(plan?.period === 'month' ? 'packages.monthlyTrialBadge' : 'packages.freeTrialBadge')
}

export function preferredPlan(clinic, user) {
  if (clinic?.tier === 'student') return 'student'
  return subscriptionPlan(clinic?.subscriptionPlan)?.id
    || subscriptionPlan(user?.user_metadata?.billingPlan)?.id || 'pro'
}
