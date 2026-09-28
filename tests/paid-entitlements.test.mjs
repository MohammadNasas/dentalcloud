import test from 'node:test'
import assert from 'node:assert/strict'
import { annualPaidThrough, paidEntitlementPatch, hasVerifiedPaidAccess, revokePaymentPatch } from '../src/lib/entitlement.js'
import { onRequestPost as status } from '../functions/api/paypal-subscription-status.js'
import { onRequestPost as capture } from '../functions/api/paypal-capture.js'
import { onRequestPost as webhook } from '../functions/api/paypal-webhook.js'
import { onRequestPost as create } from '../functions/api/paypal-create.js'
import netlifyWebhook from '../netlify/functions/paypal-webhook.mjs'
import { paymentApiUrl } from '../src/lib/apiUrl.js'

const now = Date.parse('2026-09-28T00:00:00Z')
const paidTime = '2026-09-26T15:48:22Z'
const payment = { id: 'SALE-50', amount: 50, currency: 'USD', time: paidTime, source: 'verified_webhook' }
const clinicData = () => ({ id: 'clinic-1', tier: 'pro', paypalSubscriptionId: 'I-ONE',
  subscriptionProvider: 'paypal', renewalPrice: 50, ...paidEntitlementPatch({}, payment, now) })
const ENV = { PAYPAL_CLIENT_ID: 'client', PAYPAL_SECRET: 'secret', PAYPAL_WEBHOOK_ID: 'webhook',
  PAYPAL_BASE: 'https://paypal.test', SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'server', SITE_URL: 'https://app.test' }
const req = (body) => new Request('https://app.test/api/test', { method: 'POST',
  headers: { Authorization: 'Bearer synthetic-test-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('desktop billing requests use HTTPS while web stays on its deployment origin', () => {
  assert.equal(paymentApiUrl('/api/paypal-subscription-status', 'file:'), 'https://dentalcloud.pages.dev/api/paypal-subscription-status')
  assert.equal(paymentApiUrl('/api/paypal-create', 'https:'), '/api/paypal-create')
  assert.throws(() => paymentApiUrl('/api/paypal-capture', 'file:', 'http://insecure.test'))
})

function fixture(t, options = {}) {
  t.mock.timers.enable({ apis: ['Date'], now })
  let clinic = options.clinic || clinicData()
  const calls = []
  const priorFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)), method = init.method || 'GET'
    const body = typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null
    calls.push({ url, method, body })
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'user-1', email: 'test@example.invalid' })
    if (url.pathname === '/rest/v1/doctors') return Response.json([{ id: 'user-1' }])
    if (url.pathname === '/v1/oauth2/token') return Response.json({ access_token: 'synthetic-paypal-token' })
    if (url.pathname === '/v1/notifications/verify-webhook-signature') return Response.json({ verification_status: options.badSignature ? 'FAILURE' : 'SUCCESS' })
    if (url.pathname === '/v1/billing/subscriptions/I-ONE' && method === 'GET') return Response.json(options.sub || {
      id: 'I-ONE', status: options.status || 'CANCELLED', custom_id: 'clinic-1--pro--paid--1',
      billing_info: { last_payment: { amount: { value: '50.00', currency_code: 'USD' }, time: paidTime } },
    })
    if (url.pathname === '/v1/billing/subscriptions/I-ONE' && method === 'PATCH') return new Response(null, { status: 204 })
    if (url.pathname === '/v1/payments/sale/SALE-50') return Response.json({ id: 'SALE-50', billing_agreement_id: 'I-ONE', create_time: paidTime, state: 'refunded' })
    if (url.pathname === '/rest/v1/clinics') {
      if (method === 'GET') return Response.json([{ id: 'clinic-1', data: clinic }])
    }
    if (url.pathname === '/rest/v1/rpc/apply_subscription_patch') {
      assert.equal(method, 'POST')
      assert.equal(body.p_expected_revision, clinic.subscriptionRevision || null)
      if (options.conflict) return Response.json(null)
      clinic = { ...clinic, ...body.p_patch, subscriptionRevision: 'test-revision' }
      return Response.json(clinic)
    }
    if (url.pathname === '/rest/v1/subscription_trials' && options.trial) {
      if (method === 'POST') return Response.json([])
      if (method === 'GET') return Response.json([options.trial])
    }
    throw Error(`Unexpected test fetch ${method} ${url}`)
  }
  t.after(() => { globalThis.fetch = priorFetch })
  return { calls, clinic: () => clinic }
}

test('calendar year expiry handles leap days and rejects invented dates/amounts', () => {
  assert.equal(annualPaidThrough('2024-02-29T12:00:00Z'), '2025-02-28T12:00:00.000Z')
  assert.equal(annualPaidThrough('bad date'), null)
  for (const patch of [{ amount: 49.99 }, { currency: 'EUR' }, { time: null }, { time: '2030-01-01T00:00:00Z' }]) {
    assert.equal(paidEntitlementPatch({}, { ...payment, ...patch }, now).paid, false)
  }
})

test('cancelled paid subscriptions expire at the anniversary, including an already-open app', () => {
  const clinic = { ...clinicData(), subscriptionStatus: 'CANCELLED' }
  assert.equal(clinic.paidThrough, '2027-09-26T15:48:22.000Z')
  assert.equal(hasVerifiedPaidAccess(clinic, Date.parse(clinic.paidThrough) - 1), true)
  assert.equal(hasVerifiedPaidAccess(clinic, Date.parse(clinic.paidThrough)), false)
  assert.equal(hasVerifiedPaidAccess({ ...clinic, paidThrough: undefined }, now), true)
})

test('an old or duplicate payment never extends an existing paid year', () => {
  const clinic = clinicData()
  assert.equal(paidEntitlementPatch(clinic, payment, now).paidThrough, clinic.paidThrough)
  assert.equal(paidEntitlementPatch(clinic, { ...payment, time: '2025-01-01T00:00:00Z' }, now).paidThrough, clinic.paidThrough)
  assert.equal(paidEntitlementPatch(clinic, null, Date.parse(clinic.paidThrough)).paid, false)
})

test('revoked payment cannot be resurrected by ID-less subscription sync or delayed webhook', () => {
  const clinic = clinicData()
  const revoked = { ...clinic, ...revokePaymentPatch(clinic, { id: payment.id, eventId: 'refund-1' }, now) }
  assert.equal(revoked.paid, false)
  assert.equal(paidEntitlementPatch(revoked, { ...payment, id: null }, now).paid, false)
  assert.equal(paidEntitlementPatch(revoked, payment, now).paid, false)
  const newPayment = { ...payment, id: 'NEW', time: '2026-09-27T10:00:00Z' }
  assert.equal(paidEntitlementPatch(revoked, newPayment, now).paid, true)
})

test('status sync keeps a cancelled subscription paid for its verified remaining year', async (t) => {
  const mock = fixture(t)
  const result = await (await status({ request: req({ subscriptionId: 'I-ONE', clinicId: 'clinic-1' }), env: ENV })).json()
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.paid, true)
  assert.equal(mock.clinic().subscriptionStatus, 'CANCELLED')
  assert.equal(mock.calls.some((x) => x.method === 'PATCH' && x.url.host === 'paypal.test'), false)
})

for (const [platform, handler] of [['Cloudflare', (request) => webhook({ request, env: ENV })],
  ['Netlify', (request) => { Object.assign(process.env, ENV); return netlifyWebhook(request) }]]) {
  test(`${platform}: cancellation and failed renewal preserve the paid period`, async (t) => {
    const mock = fixture(t)
    for (const event_type of ['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED']) {
      const response = await handler(req({ id: event_type, event_type, create_time: new Date().toISOString(), resource: { id: 'I-ONE' } }))
      assert.equal(response.status, 200)
      assert.equal(mock.clinic().paid, true)
      assert.equal(mock.clinic().paidThrough, clinicData().paidThrough)
    }
  })
}

test('refund resolves original sale timestamp so a prior status-only verification is revoked', async (t) => {
  const mock = fixture(t, { clinic: { ...clinicData(), subscriptionVerifiedPaymentId: null } })
  const event = { id: 'REFUND-1', event_type: 'PAYMENT.SALE.REFUNDED', create_time: new Date().toISOString(),
    resource: { id: 'REF-50', sale_id: 'SALE-50', amount: { total: '50.00', currency: 'USD' } } }
  assert.equal((await webhook({ request: req(event), env: ENV })).status, 200)
  assert.equal(mock.clinic().paid, false)
  const synced = await (await status({ request: req({ subscriptionId: 'I-ONE', clinicId: 'clinic-1' }), env: ENV })).json()
  assert.equal(synced.paid, false)
})

test('wrong payment amounts cannot alter an existing entitlement', async (t) => {
  const mock = fixture(t)
  const event = { event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'WRONG', billing_agreement_id: 'I-ONE',
    state: 'completed', create_time: paidTime, amount: { total: '49.99', currency: 'USD' } } }
  const result = await (await webhook({ request: req(event), env: ENV })).json()
  assert.equal(result.ignored, 'payment_not_50_usd')
  assert.equal(mock.calls.some((x) => x.url.pathname === '/rest/v1/rpc/apply_subscription_patch'), false)
  assert.equal(mock.clinic().paid, true)
})

test('bad signatures are rejected before any clinic access or mutation', async (t) => {
  const mock = fixture(t, { badSignature: true })
  const response = await webhook({ request: req({ event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ONE' } }), env: ENV })
  assert.equal(response.status, 401)
  assert.equal(mock.calls.some((x) => x.url.host === 'supabase.test'), false)
})

test('a concurrent webhook update is rejected for provider retry instead of losing newer payment data', async (t) => {
  fixture(t, { conflict: true })
  const response = await webhook({ request: req({ event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
    create_time: new Date().toISOString(), resource: { id: 'I-ONE' } }), env: ENV })
  assert.equal(response.status, 500)
})

test('capture returns a structured failure on concurrent update, not an unhandled rejection', async (t) => {
  fixture(t, { status: 'ACTIVE', conflict: true })
  assert.equal((await capture({ request: req({ type: 'subscription', subscriptionId: 'I-ONE' }), env: ENV })).status, 500)
})

for (const subStatus of ['APPROVAL_PENDING', 'ACTIVE']) {
  test(`abandoned ${subStatus} checkout resumes the same subscription without a new charge`, async (t) => {
    const mock = fixture(t, { clinic: { tier: 'pro', paid: false },
      trial: { email: 'test@example.invalid', user_id: 'user-1', clinic_id: 'clinic-1', status: 'pending', paypal_subscription_id: 'I-ONE' },
      sub: { id: 'I-ONE', status: subStatus, custom_id: 'clinic-1--pro--trial--1', links: [{ rel: 'approve', href: 'https://paypal.test/approve-existing' }] } })
    const result = await (await create({ request: req({ tier: 'pro', clinicId: 'clinic-1' }), env: ENV })).json()
    assert.equal(result.resumed, true, JSON.stringify(result))
    assert.equal(result.subscriptionId, 'I-ONE')
    assert.equal(mock.calls.some((x) => x.url.pathname === '/v1/billing/subscriptions' && x.method === 'POST'), false)
    if (subStatus === 'ACTIVE') assert.equal(new URL(result.url).searchParams.get('subscription_id'), 'I-ONE')
  })
}
