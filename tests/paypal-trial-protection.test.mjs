import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost as cloudflareStatus } from '../functions/api/paypal-subscription-status.js'
import netlifyStatus from '../netlify/functions/paypal-subscription-status.mjs'
import { onRequestPost as cloudflareCapture } from '../functions/api/paypal-capture.js'
import netlifyCapture from '../netlify/functions/paypal-capture.mjs'
import { onRequestPost as cloudflareCreate } from '../functions/api/paypal-create.js'
import netlifyCreate from '../netlify/functions/paypal-create.mjs'

const ENV = {
  PAYPAL_CLIENT_ID: 'client',
  PAYPAL_SECRET: 'secret',
  PAYPAL_BASE: 'https://paypal.test',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
}

function request() {
  return new Request('https://app.test/api/paypal-subscription-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    body: JSON.stringify({ subscriptionId: 'I-DUPLICATE', clinicId: 'clinic-2' }),
  })
}

function duplicateTrialFetch(subscriber = {
  payer_id: 'SAME-PAYER',
  email_address: 'payer@example.com',
  payment_source: { card: { attributes: { vault: { id: 'SAME-CARD-TOKEN' } } } },
}) {
  const writes = []
  const fetchMock = async (input, init = {}) => {
    const url = String(input)
    const method = String(init.method || 'GET').toUpperCase()
    const body = typeof init.body === 'string' && /^[{[]/.test(init.body.trim()) ? JSON.parse(init.body) : null

    if (url === `${ENV.SUPABASE_URL}/auth/v1/user`)
      return Response.json({ id: 'user-2', email: 'second@example.com' })
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/doctors`))
      return Response.json([{ id: 'user-2' }])
    if (url === `${ENV.PAYPAL_BASE}/v1/oauth2/token`)
      return Response.json({ access_token: 'paypal-token' })
    if (url.includes('/v1/billing/subscriptions/I-DUPLICATE') && method === 'GET') {
      return Response.json({
        status: 'ACTIVE',
        custom_id: 'clinic-2--pro--trial--2',
        subscriber,
        billing_info: { next_billing_time: '2026-10-01T00:00:00.000Z' },
      })
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/clinics`) && method === 'GET') {
      return Response.json([{ data: {
        id: 'clinic-2', tier: 'pro', paid: false,
        paypalSubscriptionId: 'I-DUPLICATE',
        trialStartedAt: '2026-09-01T00:00:00.000Z',
        trialEndsAt: '2026-10-01T00:00:00.000Z',
      } }])
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/subscription_trials`) && method === 'GET') {
      return Response.json([{ email: 'second@example.com', user_id: 'user-2', clinic_id: 'clinic-2', status: 'active', paypal_subscription_id: 'I-DUPLICATE' }])
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/subscription_trials`) && method === 'PATCH' && (body?.paypal_payer_id || body?.paypal_payment_token_id)) {
      writes.push({ type: 'identity-claim', body })
      return Response.json({ code: '23505' }, { status: 409 })
    }
    if (url.includes('/v1/billing/subscriptions/I-DUPLICATE/cancel') && method === 'POST') {
      writes.push({ type: 'paypal-cancel', body })
      return new Response(null, { status: 204 })
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/subscription_trials`) && method === 'PATCH' && body?.status === 'cancelled') {
      writes.push({ type: 'trial-cancel', body })
      return new Response(null, { status: 204 })
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/rpc/apply_subscription_patch`) && method === 'POST') {
      writes.push({ type: 'clinic-update', body: { data: body.p_patch } })
      return Response.json({ id: 'clinic-2', ...body.p_patch, subscriptionRevision: 'test-revision' })
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`)
  }
  return { fetchMock, writes }
}

test('Cloudflare: the saved-card token blocks a duplicate even without a payer ID', async (t) => {
  const originalFetch = globalThis.fetch
  const { fetchMock, writes } = duplicateTrialFetch({
    email_address: 'different-payer-email@example.com',
    payment_source: { card: { attributes: { vault: { id: 'SAME-CARD-TOKEN' } } } },
  })
  globalThis.fetch = fetchMock
  t.after(() => { globalThis.fetch = originalFetch })

  const response = await cloudflareStatus({ request: request(), env: ENV })
  const result = await response.json()
  assert.equal(result.duplicateTrialBlocked, true)
  const identity = writes.find((write) => write.type === 'identity-claim').body
  assert.equal(identity.paypal_payer_id, undefined)
  assert.equal(identity.paypal_payment_token_id, 'SAME-CARD-TOKEN')
})

for (const [name, handler] of [
  ['Cloudflare', (req) => cloudflareStatus({ request: req, env: ENV })],
  ['Netlify', (req) => {
    Object.assign(process.env, ENV)
    return netlifyStatus(req)
  }],
]) {
  test(`${name}: revokes an active duplicate PayPal trial during status sync`, async (t) => {
    const originalFetch = globalThis.fetch
    const { fetchMock, writes } = duplicateTrialFetch()
    globalThis.fetch = fetchMock
    t.after(() => { globalThis.fetch = originalFetch })

    const response = await handler(request())
    const result = await response.json()

    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.error, 'trial_already_used')
    assert.equal(result.duplicateTrialBlocked, true)
    assert.equal(result.clinic.subscriptionStatus, 'CANCELLED_DUPLICATE_TRIAL')
    assert.equal(writes.find((write) => write.type === 'identity-claim').body.paypal_payment_token_id, 'SAME-CARD-TOKEN')
    assert.ok(writes.some((write) => write.type === 'paypal-cancel'))
    assert.ok(writes.some((write) => write.type === 'trial-cancel'))
    const clinicWrite = writes.find((write) => write.type === 'clinic-update')
    assert.notEqual(clinicWrite.body.data.paid, true)
    assert.equal(result.clinic.paid, false)
    assert.ok(Date.parse(clinicWrite.body.data.trialEndsAt) <= Date.now())
  })
}

test('Cloudflare: rejects unauthenticated status sync', async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    if (String(input) === `${ENV.SUPABASE_URL}/auth/v1/user`) return new Response(null, { status: 401 })
    throw new Error(`Unexpected fetch: ${input}`)
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const response = await cloudflareStatus({ request: request(), env: ENV })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).error, 'unauthorized')
})

function paidStatusFetch({ withPayment = false } = {}) {
  const writes = []
  const fetchMock = async (input, init = {}) => {
    const url = String(input)
    const method = String(init.method || 'GET').toUpperCase()
    const body = typeof init.body === 'string' && /^[{[]/.test(init.body.trim()) ? JSON.parse(init.body) : null
    if (url === `${ENV.SUPABASE_URL}/auth/v1/user`)
      return Response.json({ id: 'user-2', email: 'second@example.com' })
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/doctors`))
      return Response.json([{ id: 'user-2' }])
    if (url === `${ENV.PAYPAL_BASE}/v1/oauth2/token`)
      return Response.json({ access_token: 'paypal-token' })
    if (url.includes('/v1/billing/subscriptions/I-DUPLICATE') && method === 'GET') {
      return Response.json({
        status: 'ACTIVE',
        custom_id: 'clinic-2--pro--paid--2',
        subscriber: {
          payer_id: 'SAME-PAYER',
          email_address: 'payer@example.com',
          payment_source: { card: { attributes: { vault: { id: 'SAME-CARD-TOKEN' } } } },
        },
        billing_info: {
          next_billing_time: '2027-09-01T00:00:00.000Z',
          ...(withPayment ? { last_payment: { id: 'PAY-50', amount: { value: '50.00', currency_code: 'USD' }, time: '2026-09-01T00:00:00.000Z' } } : {}),
        },
      })
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/clinics`) && method === 'GET') {
      return Response.json([{ data: {
        id: 'clinic-2', tier: 'pro', paid: false,
        paypalSubscriptionId: 'I-DUPLICATE', renewalPrice: 50,
        renewalPriceUpdatePending: false,
      } }])
    }
    if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/rpc/apply_subscription_patch`) && method === 'POST') {
      writes.push({ type: 'clinic-update', body: { data: body.p_patch } })
      return Response.json({ id: 'clinic-2', ...body.p_patch, subscriptionRevision: 'test-revision' })
    }
    if (url.includes('/subscription_trials') || url.endsWith('/cancel')) {
      writes.push({ type: 'forbidden-trial-operation', url, body })
      throw new Error(`Paid checkout touched trial protection: ${method} ${url}`)
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`)
  }
  return { fetchMock, writes }
}

for (const [name, handler] of [
  ['Cloudflare', (req) => cloudflareStatus({ request: req, env: ENV })],
  ['Netlify', (req) => {
    Object.assign(process.env, ENV)
    return netlifyStatus(req)
  }],
]) {
  test(`${name}: an immediate paid subscription is never cancelled as a duplicate trial`, async (t) => {
    const originalFetch = globalThis.fetch
    const { fetchMock, writes } = paidStatusFetch()
    globalThis.fetch = fetchMock
    t.after(() => { globalThis.fetch = originalFetch })

    const result = await (await handler(request())).json()
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.checkoutMode, 'paid')
    assert.equal(result.paid, false)
    assert.equal(result.paymentPending, true)
    assert.equal(writes.some((write) => write.type === 'forbidden-trial-operation'), false)
  })
}

function captureRequest() {
  return new Request('https://app.test/api/paypal-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    body: JSON.stringify({ type: 'subscription', subscriptionId: 'I-PAID', clinicId: 'clinic-2', tier: 'pro' }),
  })
}

function paidCaptureFetch() {
  const writes = []
  return {
    writes,
    fetchMock: async (input, init = {}) => {
      const url = String(input)
      const method = String(init.method || 'GET').toUpperCase()
      const body = typeof init.body === 'string' && /^[{[]/.test(init.body.trim()) ? JSON.parse(init.body) : null
      if (url === `${ENV.SUPABASE_URL}/auth/v1/user`) return Response.json({ id: 'user-2', email: 'second@example.com' })
      if (url === `${ENV.PAYPAL_BASE}/v1/oauth2/token`) return Response.json({ access_token: 'paypal-token' })
      if (url.includes('/v1/billing/subscriptions/I-PAID') && method === 'GET') {
        return Response.json({
          status: 'ACTIVE', custom_id: 'clinic-2--pro--paid--2',
          billing_info: {
            next_billing_time: '2027-09-01T00:00:00.000Z',
            last_payment: { id: 'PAY-50', amount: { value: '50.00', currency_code: 'USD' }, time: '2026-09-01T00:00:00.000Z' },
          },
        })
      }
      if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/doctors`)) return Response.json([{ id: 'user-2' }])
      if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/clinics`) && method === 'GET') return Response.json([{ data: { id: 'clinic-2', tier: 'student', paid: false } }])
      if (url.includes('/v1/billing/subscriptions/I-PAID') && method === 'PATCH') {
        writes.push({ type: 'price-update', body })
        return new Response(null, { status: 204 })
      }
      if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/rpc/apply_subscription_patch`) && method === 'POST') {
        writes.push({ type: 'clinic-update', body: { data: body.p_patch } })
        return Response.json({ id: 'clinic-2', ...body.p_patch, subscriptionRevision: 'test-revision' })
      }
      if (url.includes('/subscription_trials') || url.endsWith('/cancel')) throw new Error(`Paid capture touched trial protection: ${method} ${url}`)
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    },
  }
}

for (const [name, handler] of [
  ['Cloudflare', (req) => cloudflareCapture({ request: req, env: ENV })],
  ['Netlify', (req) => {
    Object.assign(process.env, ENV)
    return netlifyCapture(req)
  }],
]) {
  test(`${name}: paid checkout unlocks Pro only after an exact $50 payment`, async (t) => {
    const originalFetch = globalThis.fetch
    const { fetchMock, writes } = paidCaptureFetch()
    globalThis.fetch = fetchMock
    t.after(() => { globalThis.fetch = originalFetch })

    const result = await (await handler(captureRequest())).json()
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.trial, false)
    assert.equal(result.paid, true)
    assert.equal(result.paymentPending, false)
    assert.equal(writes.find((write) => write.type === 'price-update').body[0].path, '/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price')
    assert.equal(writes.find((write) => write.type === 'clinic-update').body.data.subscriptionVerifiedAmount, 50)
  })
}

function createRequest() {
  return new Request('https://app.test/api/paypal-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-token' },
    body: JSON.stringify({ tier: 'pro', clinicId: 'clinic-2', checkoutMode: 'paid' }),
  })
}

function paidCreateFetch() {
  const calls = []
  return {
    calls,
    fetchMock: async (input, init = {}) => {
      const url = String(input)
      const method = String(init.method || 'GET').toUpperCase()
      const body = typeof init.body === 'string' && /^[{[]/.test(init.body.trim()) ? JSON.parse(init.body) : null
      calls.push({ url, method, body })
      if (url === `${ENV.SUPABASE_URL}/auth/v1/user`) return Response.json({ id: 'user-2', email: 'second@example.com' })
      if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/doctors`)) return Response.json([{ id: 'user-2' }])
      if (url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/clinics`)) return Response.json([{ id: 'clinic-2', data: { tier: 'student', paid: false, trialUsedAt: '2026-01-01T00:00:00.000Z' } }])
      if (url === `${ENV.PAYPAL_BASE}/v1/oauth2/token`) return Response.json({ access_token: 'paypal-token' })
      if (url.includes('/v1/billing/plans/P-PAID/update-pricing-schemes')) return Response.json({})
      if (url === `${ENV.PAYPAL_BASE}/v1/billing/subscriptions`) return Response.json({ id: 'I-PAID', links: [{ rel: 'approve', href: 'https://paypal.test/approve-paid' }] })
      if (url.includes('/subscription_trials')) throw new Error(`Paid creation touched trial ledger: ${method} ${url}`)
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    },
  }
}

for (const [name, handler] of [
  ['Cloudflare', (req, env) => cloudflareCreate({ request: req, env })],
  ['Netlify', (req, env) => {
    Object.assign(process.env, env)
    return netlifyCreate(req)
  }],
]) {
  test(`${name}: a previous trial can purchase the no-trial Pro plan`, async (t) => {
    const originalFetch = globalThis.fetch
    const { fetchMock, calls } = paidCreateFetch()
    globalThis.fetch = fetchMock
    t.after(() => { globalThis.fetch = originalFetch })

    const env = { ...ENV, PAYPAL_PRO_PAID_PLAN_ID: 'P-PAID', SITE_URL: 'https://app.test' }
    const result = await (await handler(createRequest(), env)).json()
    assert.equal(result.url, 'https://paypal.test/approve-paid', JSON.stringify(result))
    assert.equal(result.checkoutMode, 'paid')
    const createCall = calls.find((call) => call.url === `${ENV.PAYPAL_BASE}/v1/billing/subscriptions`)
    assert.equal(createCall.body.plan_id, 'P-PAID')
    assert.match(createCall.body.custom_id, /^clinic-2--pro--paid--/)
    assert.equal(calls.some((call) => call.url.includes('/subscription_trials')), false)
  })
}
