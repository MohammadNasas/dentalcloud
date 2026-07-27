const encoder = new TextEncoder()
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60
const TEXTBELT_ENDPOINT = 'https://textbelt.com/text'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function decodeBase64(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function webhookSecretBytes(secret) {
  let value = String(secret || '').trim()
  if (value.startsWith('v1,')) value = value.slice(3)
  if (value.startsWith('whsec_')) value = value.slice(6)
  if (!value) throw new Error('missing_hook_secret')
  return decodeBase64(value)
}

async function verifyStandardWebhook(request, rawBody, secret) {
  const messageId = request.headers.get('webhook-id')
  const timestamp = request.headers.get('webhook-timestamp')
  const signatureHeader = request.headers.get('webhook-signature')
  if (!messageId || !timestamp || !signatureHeader) return false

  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber)) return false
  if (Math.abs(Date.now() / 1000 - timestampNumber) > MAX_WEBHOOK_AGE_SECONDS) return false

  let secretBytes
  try {
    secretBytes = webhookSecretBytes(secret)
  } catch {
    return false
  }

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signedContent = encoder.encode(`${messageId}.${timestamp}.${rawBody}`)
  const signatures = signatureHeader.split(/\s+/)

  for (const candidate of signatures) {
    if (!candidate.startsWith('v1,')) continue
    try {
      const signature = decodeBase64(candidate.slice(3))
      if (await crypto.subtle.verify('HMAC', key, signature, signedContent)) return true
    } catch {
      // Keep checking in case Supabase is rotating between multiple signatures.
    }
  }
  return false
}

function authHookError(message, httpCode = 500, responseStatus = httpCode) {
  return json({ error: { http_code: httpCode, message } }, responseStatus)
}

async function sendWithTextbelt({ apiKey, phone, otp }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  try {
    const body = new URLSearchParams({
      phone,
      message: `DentalCloud verification code: ${otp}. Do not share this code.`,
      sender: 'DentalCloud',
      key: apiKey,
    })
    const response = await fetch(TEXTBELT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({}))
    return {
      ok: response.ok && result.success === true,
      status: response.status,
      error: String(result.error || ''),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function handleTextbeltSmsHook(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const apiKey = env.TEXTBELT_API_KEY
  const hookSecret = env.SUPABASE_AUTH_HOOK_SECRET
  if (!apiKey || !hookSecret) return authHookError('SMS hook is not configured', 503)

  const rawBody = await request.text()
  if (!(await verifyStandardWebhook(request, rawBody, hookSecret)))
    return authHookError('Invalid webhook signature', 401)

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return authHookError('Invalid webhook payload', 400)
  }

  const phone = String(event?.user?.phone || '').trim()
  const otp = String(event?.sms?.otp || '').trim()
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(otp))
    return authHookError('Invalid phone or verification code', 400)

  try {
    const result = await sendWithTextbelt({ apiKey, phone, otp })
    if (!result.ok) {
      console.error('Textbelt SMS send failed', {
        status: result.status,
        error: result.error || 'unknown_provider_error',
      })
      return authHookError('SMS provider could not send the verification code', 502)
    }
    return json({})
  } catch (error) {
    console.error('Textbelt SMS hook error', {
      name: error?.name || 'Error',
      message: error?.message || String(error),
    })
    return authHookError('SMS provider is temporarily unavailable', 503)
  }
}

export const _test = { verifyStandardWebhook, webhookSecretBytes }
