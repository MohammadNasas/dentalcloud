// Cloudflare Pages Function: send a one-time payment follow-up email to clinics
// that chose the $70 Economy plan but have not completed payment.
// Route: POST /api/payment-followup
//
// Env vars:
//   CAMPAIGN_ADMIN_SECRET       required; send as Authorization: Bearer <secret>
//   RESEND_API_KEY              required when send=true
//   SUPABASE_URL                required
//   SUPABASE_SERVICE_ROLE_KEY   required; server-side only
//   RESEND_FROM                 optional; defaults to DentalCloud <dentalcloudd@gmail.com>
//   SUPPORT_EMAIL               optional; defaults to dentalcloudd@gmail.com
//   SUPPORT_WHATSAPP            optional; defaults to +972599510078

const TARGET_TIER = 'economy'
const DEFAULT_SUPPORT_EMAIL = 'dentalcloudd@gmail.com'
const DEFAULT_SUPPORT_WHATSAPP = '+972599510078'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

export const onRequestOptions = () => new Response('', { headers: cors })

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

function isPaid(value) {
  return value === true || String(value).toLowerCase() === 'true'
}

function isAuthorized(request, env, payload) {
  const secret = env.CAMPAIGN_ADMIN_SECRET
  if (!secret) return false
  const header = request.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim() || String(payload.adminSecret || '').trim()
  return token === secret
}

async function supabaseJson(env, path, init = {}) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('supabase_not_configured')

  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`supabase_${res.status}: ${text}`)
  return data
}

function pickRecipient(clinic, doctors) {
  const clinicDoctors = doctors.filter((d) => d.clinic_id === clinic.id)
  const owner =
    clinicDoctors.find((d) => d.id === clinic.owner_id) ||
    clinicDoctors.find((d) => d.data?.isOwner) ||
    clinicDoctors[0]
  const fallbackWithEmail = clinicDoctors.find((d) => cleanEmail(d.data?.email || d.data?.username))
  const doctor = cleanEmail(owner?.data?.email || owner?.data?.username) ? owner : fallbackWithEmail
  const email = cleanEmail(doctor?.data?.email || doctor?.data?.username)
  if (!email) return null
  return {
    email,
    doctorName: doctor?.data?.name || doctor?.data?.nameAr || '',
    clinicName: clinic.data?.name || clinic.data?.nameAr || '',
  }
}

function buildEmail({ doctorName, clinicName, supportEmail, supportWhatsapp, siteUrl }) {
  const safeName = escapeHtml(doctorName || clinicName || 'Ø¯ÙƒØªÙˆØ±Ù†Ø§ Ø§Ù„Ø¹Ø²ÙŠØ²')
  const safeClinic = escapeHtml(clinicName || 'Ø¹ÙŠØ§Ø¯ØªÙƒ')
  const safeEmail = escapeHtml(supportEmail)
  const safePhone = escapeHtml(supportWhatsapp)
  const waNumber = supportWhatsapp.replace(/\D/g, '')
  const completeUrl = siteUrl ? `${String(siteUrl).replace(/\/$/, '')}/#/packages` : ''

  const subject = 'Ù‡Ù„ ÙˆØ§Ø¬Ù‡ØªÙƒ Ù…Ø´ÙƒÙ„Ø© ÙÙŠ Ø¥ÙƒÙ…Ø§Ù„ Ø§Ø´ØªØ±Ø§Ùƒ DentalCloudØŸ'
  const text = [
    `Ù…Ø±Ø­Ø¨Ø§Ù‹ ${doctorName || clinicName || 'Ø¯ÙƒØªÙˆØ±Ù†Ø§ Ø§Ù„Ø¹Ø²ÙŠØ²'},`,
    '',
    'Ù„Ø§Ø­Ø¸Ù†Ø§ Ø£Ù†Ùƒ Ø§Ø®ØªØ±Øª Ø¨Ø§Ù‚Ø© Ø§Ù„Ø¹ÙŠØ§Ø¯Ø§Øª Ø§Ù„ØµØºÙŠØ±Ø© ÙÙŠ DentalCloud Ø¨Ù‚ÙŠÙ…Ø© $70 Ø³Ù†ÙˆÙŠØ§Ù‹ØŒ Ù„ÙƒÙ† Ø¹Ù…Ù„ÙŠØ© Ø§Ù„Ø¯ÙØ¹ Ù„Ù… ØªÙƒØªÙ…Ù„ Ø¨Ø¹Ø¯.',
    '',
    'Ø£Ø±Ø¯Ù†Ø§ ÙÙ‚Ø· Ø§Ù„Ø§Ø·Ù…Ø¦Ù†Ø§Ù†: Ù‡Ù„ ÙˆØ§Ø¬Ù‡ØªÙƒ Ø£ÙŠ Ù…Ø´ÙƒÙ„Ø© Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø¯ÙØ¹ Ø£Ùˆ Ø§Ù„ØªÙØ¹ÙŠÙ„ØŸ',
    'Ø¥Ø°Ø§ ÙˆØ§Ø¬Ù‡ØªÙƒ Ù…Ø´ÙƒÙ„Ø© ÙÙŠ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø©ØŒ ØµÙØ­Ø© Ø§Ù„Ø¯ÙØ¹ØŒ Ø§Ù„Ù…ØªØµÙØ­ØŒ Ø£Ùˆ Ø¥Ø°Ø§ ÙƒÙ†Øª ØªÙØ¶Ù„ Ø·Ø±ÙŠÙ‚Ø© Ø¯ÙØ¹ Ø£Ø®Ø±Ù‰ØŒ ÙŠØ³Ø¹Ø¯Ù†Ø§ Ù…Ø³Ø§Ø¹Ø¯ØªÙƒ Ù…Ø¨Ø§Ø´Ø±Ø©.',
    '',
    `ØªÙˆØ§ØµÙ„ Ù…Ø¹Ù†Ø§ Ø¹Ø¨Ø± Ø§Ù„Ø¨Ø±ÙŠØ¯: ${supportEmail}`,
    `Ø£Ùˆ Ø¹Ø¨Ø± ÙˆØ§ØªØ³Ø§Ø¨/Ù‡Ø§ØªÙ: ${supportWhatsapp}`,
    '',
    'Ø¥Ø°Ø§ Ù„Ù… ØªØ¹Ø¯ Ù…Ù‡ØªÙ…Ø§Ù‹ Ø§Ù„Ø¢Ù†ØŒ Ù„Ø§ ÙŠÙ„Ø²Ù…Ùƒ Ø£ÙŠ Ø¥Ø¬Ø±Ø§Ø¡. Ù‡Ø°Ù‡ Ø±Ø³Ø§Ù„Ø© Ù…ØªØ§Ø¨Ø¹Ø© Ù„Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø·.',
    '',
    'Ù…Ø¹ Ø§Ù„ØªØ­ÙŠØ©ØŒ',
    'ÙØ±ÙŠÙ‚ DentalCloud',
  ].join('\n')

  const button = completeUrl
    ? `<p style="margin:26px 0"><a href="${escapeHtml(completeUrl)}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Ø¥ÙƒÙ…Ø§Ù„ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ</a></p>`
    : ''

  const html = `
  <div dir="rtl" style="margin:0;background:#f6f8fb;padding:28px 0;font-family:Arial,Tahoma,sans-serif;color:#1e293b">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
      <div style="background:#0d9488;padding:22px 26px;color:#ffffff">
        <div style="font-size:22px;font-weight:800;letter-spacing:.2px">DentalCloud</div>
        <div style="margin-top:6px;font-size:14px;opacity:.9">Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø³ÙŠØ·Ø© Ø¨Ø®ØµÙˆØµ Ø§Ø´ØªØ±Ø§ÙƒÙƒ</div>
      </div>
      <div style="padding:28px 26px;line-height:1.9;font-size:16px">
        <p style="margin:0 0 14px">Ù…Ø±Ø­Ø¨Ø§Ù‹ ${safeName}ØŒ</p>
        <p style="margin:0 0 14px">
          Ù„Ø§Ø­Ø¸Ù†Ø§ Ø£Ù†Ùƒ Ø£Ù†Ø´Ø£Øª Ø­Ø³Ø§Ø¨Ø§Ù‹ Ù„Ø¹ÙŠØ§Ø¯Ø© <strong>${safeClinic}</strong> ÙˆØ§Ø®ØªØ±Øª
          <strong>Ø¨Ø§Ù‚Ø© Ø§Ù„Ø¹ÙŠØ§Ø¯Ø§Øª Ø§Ù„ØµØºÙŠØ±Ø© Ø¨Ù‚ÙŠÙ…Ø© $70 Ø³Ù†ÙˆÙŠØ§Ù‹</strong>ØŒ Ù„ÙƒÙ† Ø¹Ù…Ù„ÙŠØ© Ø§Ù„Ø¯ÙØ¹ Ù„Ù… ØªÙƒØªÙ…Ù„ Ø¨Ø¹Ø¯.
        </p>
        <p style="margin:0 0 14px">
          Ø£Ø±Ø¯Ù†Ø§ ÙÙ‚Ø· Ø§Ù„Ø§Ø·Ù…Ø¦Ù†Ø§Ù†: Ù‡Ù„ ÙˆØ§Ø¬Ù‡ØªÙƒ Ø£ÙŠ Ù…Ø´ÙƒÙ„Ø© Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø¯ÙØ¹ Ø£Ùˆ Ø§Ù„ØªÙØ¹ÙŠÙ„ØŸ
        </p>
        <p style="margin:0 0 14px">
          Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ù…Ø´ÙƒÙ„Ø© Ù…Ù† Ø§Ù„Ø¨Ø·Ø§Ù‚Ø©ØŒ ØµÙØ­Ø© Ø§Ù„Ø¯ÙØ¹ØŒ Ø§Ù„Ù…ØªØµÙØ­ØŒ Ø£Ùˆ Ø¥Ø°Ø§ ÙƒÙ†Øª ØªÙØ¶Ù„ Ø·Ø±ÙŠÙ‚Ø© Ø¯ÙØ¹ Ø£Ø®Ø±Ù‰ØŒ
          ÙŠØ³Ø¹Ø¯Ù†Ø§ Ù…Ø³Ø§Ø¹Ø¯ØªÙƒ Ù…Ø¨Ø§Ø´Ø±Ø© ÙˆØ¥ÙƒÙ…Ø§Ù„ Ø§Ù„ØªÙØ¹ÙŠÙ„ Ù…Ø¹Ùƒ Ø®Ø·ÙˆØ© Ø¨Ø®Ø·ÙˆØ©.
        </p>
        ${button}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;margin:20px 0">
          <div style="font-weight:800;margin-bottom:8px">Ù„Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© Ø§Ù„Ø³Ø±ÙŠØ¹Ø©:</div>
          <div>Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ: <a href="mailto:${safeEmail}" style="color:#0d9488;font-weight:700">${safeEmail}</a></div>
          <div>ÙˆØ§ØªØ³Ø§Ø¨ / Ù‡Ø§ØªÙ: <a href="https://wa.me/${waNumber}" style="color:#0d9488;font-weight:700" dir="ltr">${safePhone}</a></div>
        </div>
        <p style="margin:0;color:#64748b;font-size:14px">
          Ø¥Ø°Ø§ Ù„Ù… ØªØ¹Ø¯ Ù…Ù‡ØªÙ…Ø§Ù‹ Ø§Ù„Ø¢Ù†ØŒ Ù„Ø§ ÙŠÙ„Ø²Ù…Ùƒ Ø£ÙŠ Ø¥Ø¬Ø±Ø§Ø¡. Ù‡Ø°Ù‡ Ø±Ø³Ø§Ù„Ø© Ù…ØªØ§Ø¨Ø¹Ø© Ù„Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø·.
        </p>
        <p style="margin:24px 0 0">Ù…Ø¹ Ø§Ù„ØªØ­ÙŠØ©ØŒ<br><strong>ÙØ±ÙŠÙ‚ DentalCloud</strong></p>
      </div>
    </div>
  </div>`

  return { subject, text, html }
}

async function sendEmail(env, message) {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) throw new Error('email_not_configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`resend_${res.status}: ${text}`)
  return text ? JSON.parse(text) : {}
}

async function markFollowupSent(env, clinic, sentAt) {
  const nextData = { ...(clinic.data || {}), paymentFollowupSentAt: sentAt }
  await supabaseJson(env, `clinics?id=eq.${encodeURIComponent(clinic.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ data: nextData }),
  })
}

export const onRequestPost = async ({ request, env }) => {
  let payload
  try { payload = await request.json() } catch { return json({ ok: false, error: 'bad_json' }, 400) }
  if (!isAuthorized(request, env, payload || {})) return json({ ok: false, error: 'unauthorized' }, 401)

  const send = payload?.send === true
  const force = payload?.force === true
  const limit = Math.min(Math.max(Number(payload?.limit || 50), 1), 200)
  const supportEmail = env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL
  const supportWhatsapp = env.SUPPORT_WHATSAPP || DEFAULT_SUPPORT_WHATSAPP
  const from = env.RESEND_FROM || `DentalCloud <${supportEmail}>`
  const siteUrl = env.SITE_URL || ''

  try {
    const clinics = await supabaseJson(env, 'clinics?select=id,owner_id,data,created_at')
    const doctors = await supabaseJson(env, 'doctors?select=id,clinic_id,data')
    const candidates = (clinics || [])
      .filter((clinic) => clinic.data?.tier === TARGET_TIER)
      .filter((clinic) => !isPaid(clinic.data?.paid))
      .filter((clinic) => force || !clinic.data?.paymentFollowupSentAt)
      .slice(0, limit)

    const results = []
    const sentEmails = new Set()
    const sentAt = new Date().toISOString()

    for (const clinic of candidates) {
      const recipient = pickRecipient(clinic, doctors || [])
      if (!recipient) {
        results.push({ clinicId: clinic.id, ok: false, skipped: true, reason: 'no_owner_email' })
        continue
      }
      if (sentEmails.has(recipient.email)) {
        results.push({ clinicId: clinic.id, email: recipient.email, ok: false, skipped: true, reason: 'duplicate_email' })
        continue
      }

      const email = buildEmail({ ...recipient, supportEmail, supportWhatsapp, siteUrl })
      const row = {
        clinicId: clinic.id,
        clinicName: recipient.clinicName,
        email: recipient.email,
        subject: email.subject,
      }

      if (!send) {
        results.push({ ...row, ok: true, dryRun: true })
        continue
      }

      try {
        await sendEmail(env, {
          from,
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          reply_to: supportEmail,
        })
        await markFollowupSent(env, clinic, sentAt)
        sentEmails.add(recipient.email)
        results.push({ ...row, ok: true, sentAt })
      } catch (e) {
        results.push({ ...row, ok: false, error: String(e.message || e) })
      }
    }

    return json({
      ok: true,
      dryRun: !send,
      matched: candidates.length,
      sent: results.filter((r) => r.ok && !r.dryRun).length,
      results,
    })
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e.message || e) }, 500)
  }
}
