import test from 'node:test'
import assert from 'node:assert/strict'
import { requiresInitialSubscription, paidEntitlementPatch } from '../src/lib/entitlement.js'

const now = Date.parse('2026-10-03T12:00:00Z')

test('new Pro accounts must activate even after an abandoned or unverified checkout', () => {
  for (const extra of [{}, { paypalSubscriptionId: 'I-PENDING', subscriptionStatus: 'APPROVAL_PENDING' },
    { paypalSubscriptionId: 'I-ACTIVE', subscriptionStatus: 'ACTIVE' },
    { trialStartedAt: 'invalid', trialEndsAt: 'invalid' }]) {
    assert.equal(requiresInitialSubscription({ tier: 'pro', paid: false, ...extra }, now), true)
  }
  assert.equal(requiresInitialSubscription({ tier: 'economy', paid: false }, now), true)
})

test('student, active trial and verified paid accounts enter normally', () => {
  assert.equal(requiresInitialSubscription({ tier: 'student', paid: false }, now), false)
  assert.equal(requiresInitialSubscription({ tier: 'pro', trialEndsAt: '2026-11-01' }, now), false)
  const paid = paidEntitlementPatch({}, {
    id: 'SALE-50', amount: 50, currency: 'USD', time: '2026-10-01T12:00:00Z',
  }, now)
  assert.equal(requiresInitialSubscription({ tier: 'pro', subscriptionProvider: 'paypal', ...paid }, now), false)
  assert.equal(requiresInitialSubscription({ tier: 'pro', paid: true }, now), false)
})

test('previous trial and paid subscribers keep the workspace for read/export after expiry', () => {
  for (const history of [{ trialStartedAt: '2026-08-01', trialEndsAt: '2026-09-01' },
    { trialUsedAt: '2026-08-01' }, { trialEndsAt: '2026-09-01' },
    { paidAt: '2025-01-01', paidThrough: '2026-01-01' },
    { subscriptionLastPaidAt: '2025-01-01' }, { paidThrough: '2026-01-01' }]) {
    assert.equal(requiresInitialSubscription({ tier: 'pro', paid: false, ...history }, now), false)
  }
})
