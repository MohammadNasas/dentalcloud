import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { webcrypto } from 'node:crypto'
import { handleTextbeltSmsHook } from './textbeltSmsHook.js'

globalThis.crypto ||= webcrypto

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

async function signedRequest(payload, secretBytes, signatureOverride) {
  const rawBody = JSON.stringify(payload)
  const messageId = 'msg_test'
  const timestamp = String(Math.floor(Date.now() / 1000))
  const secret = `v1,whsec_${Buffer.from(secretBytes).toString('base64')}`
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${messageId}.${timestamp}.${rawBody}`),
  )
  const signature = signatureOverride || `v1,${Buffer.from(signatureBytes).toString('base64')}`
  const request = new Request('https://dentalcloud.pages.dev/api/send-sms-hook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': messageId,
      'webhook-timestamp': timestamp,
      'webhook-signature': signature,
    },
    body: rawBody,
  })
  return { request, secret }
}

test('forwards a valid Supabase OTP to Textbelt', async () => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const { request, secret } = await signedRequest(
    { user: { phone: '+970591234567' }, sms: { otp: '561166' } },
    secretBytes,
  )
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls += 1
    assert.equal(url, 'https://textbelt.com/text')
    assert.equal(options.method, 'POST')
    assert.equal(options.body.get('phone'), '+970591234567')
    assert.match(options.body.get('message'), /561166/)
    assert.equal(options.body.get('key'), 'textbelt-key')
    return Response.json({ success: true, quotaRemaining: 24, textId: 'text_test' })
  }

  const response = await handleTextbeltSmsHook(request, {
    TEXTBELT_API_KEY: 'textbelt-key',
    SUPABASE_AUTH_HOOK_SECRET: secret,
  })

  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.equal(calls, 1)
})

test('accepts the phone from Supabase identity data and an enveloped payload', async () => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const { request, secret } = await signedRequest(
    {
      data: {
        user: {
          phone: '',
          identities: [{ identity_data: { phone: '+970 59 123 4567' } }],
        },
        sms: { otp: 561166 },
      },
    },
    secretBytes,
  )
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.body.get('phone'), '+970591234567')
    assert.match(options.body.get('message'), /561166/)
    return Response.json({ success: true, quotaRemaining: 24, textId: 'text_test' })
  }

  const response = await handleTextbeltSmsHook(request, {
    TEXTBELT_API_KEY: 'textbelt-key',
    SUPABASE_AUTH_HOOK_SECRET: secret,
  })

  assert.equal(response.status, 204)
})

test('restores the plus prefix when Supabase sends E.164 digits only', async () => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const { request, secret } = await signedRequest(
    { user: { phone: '970599510078' }, sms: { otp: '561166' } },
    secretBytes,
  )
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.body.get('phone'), '+970599510078')
    return Response.json({ success: true, quotaRemaining: 24, textId: 'text_test' })
  }

  const response = await handleTextbeltSmsHook(request, {
    TEXTBELT_API_KEY: 'textbelt-key',
    SUPABASE_AUTH_HOOK_SECRET: secret,
  })

  assert.equal(response.status, 204)
})

test('rejects an invalid webhook signature before sending', async () => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const { request, secret } = await signedRequest(
    { user: { phone: '+970591234567' }, sms: { otp: '561166' } },
    secretBytes,
    'v1,ZmFrZS1zaWduYXR1cmU=',
  )
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return Response.json({ success: true })
  }

  const response = await handleTextbeltSmsHook(request, {
    TEXTBELT_API_KEY: 'textbelt-key',
    SUPABASE_AUTH_HOOK_SECRET: secret,
  })

  assert.equal(response.status, 401)
  assert.equal(calls, 0)
})

test('returns an Auth hook error when Textbelt rejects the send', async () => {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32))
  const { request, secret } = await signedRequest(
    { user: { phone: '+970591234567' }, sms: { otp: '561166' } },
    secretBytes,
  )
  globalThis.fetch = async () =>
    Response.json({ success: false, error: 'Out of quota' }, { status: 400 })

  const response = await handleTextbeltSmsHook(request, {
    TEXTBELT_API_KEY: 'textbelt-key',
    SUPABASE_AUTH_HOOK_SECRET: secret,
  })
  const body = await response.json()

  assert.equal(response.status, 502)
  assert.equal(body.error.http_code, 502)
  assert.match(body.error.message, /SMS provider/)
})
