import { ApiError, bodyJSON, database, handle, response, uuid } from '../_lib/loyaltyAccess.js'

export const onRequestOptions = ({ request }) => response(request, {})

async function authAdmin(env, path, method, body) {
  const result = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/${path}`, {
    method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  })
  if (!result.ok) throw new ApiError('profile_auth_failed', 502)
  return result.status === 204 ? null : result.json()
}

export const onRequestPost = ({ request, env }) => handle(request, async () => {
  const bearer = request.headers.get('Authorization')
  if (!/^Bearer [\w.-]+$/.test(bearer || '')) throw new ApiError('sign_in_required', 401)
  const scoped = database(env, bearer)
  // The context RPC derives ownership from clinics.owner_id, never editable JSON.
  const context = await scoped('rpc/clinic_profile_context', 'POST', {})
  if (!context?.user?.isClinicOwner) throw new ApiError('owner_required', 403)
  const cid = context.clinic.id
  const db = database(env)
  const input = await bodyJSON(request)
  const members = await db(`clinic_profiles?clinic_id=eq.${cid}&select=user_id,active`)
  if (input.action === 'list') {
    const doctors = await db(`doctors?clinic_id=eq.${cid}&select=id,data`)
    return { ok: true, profiles: doctors.filter(d => d.id === context.user.id || members.some(p => p.user_id === d.id)).map(d => ({
      id: d.id, name: d.data.name, color: d.data.color, specialty: d.data.specialty || '',
      email: d.data.email, owner: d.id === context.user.id,
      active: d.id === context.user.id || members.find(p => p.user_id === d.id)?.active === true,
    })) }
  }
  if (input.action === 'create') {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80
      || typeof input.password !== 'string' || input.password.length < 10 || input.password.length > 128) throw new ApiError('invalid_profile')
    if (members.length >= 30) throw new ApiError('profile_limit')
    // A no-op owner assignment is not used as an entitlement bypass. Validate the
    // same subscription helper through the database's owner-only provisioning RPC.
    await scoped('rpc/clinic_profile_can_manage', 'POST', {})
    const email = `${crypto.randomUUID()}@profiles.dentalcloudapp.com`
    const auth = await authAdmin(env, 'users', 'POST', { email, password: input.password, email_confirm: true,
      user_metadata: { clinicProfile: true } })
    const id = auth.id || auth.user?.id
    if (!uuid(id)) throw new ApiError('profile_auth_failed', 502)
    try {
      await db('doctors', 'POST', { id, clinic_id: cid, data: { id, clinicId: cid, name: input.name.trim(), nameAr: input.name.trim(),
        email, role: input.role === 'assistant' ? 'assistant' : 'doctor', isOwner: false,
        specialty: String(input.specialty || '').slice(0, 100), color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#0d9488' } })
      await db('clinic_profiles', 'POST', { user_id: id, clinic_id: cid, active: true })
    } catch (error) {
      // Disable any partial provision before best-effort cleanup; never publish it.
      await authAdmin(env, `users/${id}`, 'PUT', { ban_duration: '876000h' }).catch(() => {})
      await db(`doctors?id=eq.${id}&clinic_id=eq.${cid}`, 'DELETE').catch(() => {})
      await authAdmin(env, `users/${id}`, 'DELETE').catch(() => {})
      throw error
    }
    return { ok: true, id }
  }
  if (!uuid(input.id) || !members.some(p => p.user_id === input.id) || input.id === context.user.id) throw new ApiError('unknown_profile', 404)
  if (input.action === 'delete') {
    // Revoke membership first: existing JWTs must lose clinic access immediately.
    // Retain the doctor identity for clinical/audit references; deleting Auth or
    // doctor rows could cascade into historical records. This login stays banned.
    await db(`clinic_profiles?user_id=eq.${input.id}&clinic_id=eq.${cid}`, 'PATCH', { active: false })
    await authAdmin(env, `users/${input.id}`, 'PUT', { ban_duration: '876000h' })
    await db(`clinic_profiles?user_id=eq.${input.id}&clinic_id=eq.${cid}`, 'DELETE')
  } else if (input.action === 'update') {
    const old = (await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}&select=data`))[0]
    if (!old || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) throw new ApiError('invalid_profile')
    await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}`, 'PATCH', { data: { ...old.data, name: input.name.trim(), nameAr: input.name.trim(), specialty: String(input.specialty || '').slice(0, 100) } })
  } else if (input.action === 'password') {
    if (typeof input.password !== 'string' || input.password.length < 10 || input.password.length > 128) throw new ApiError('invalid_password')
    await authAdmin(env, `users/${input.id}`, 'PUT', { password: input.password })
  } else if (input.action === 'active') {
    if (typeof input.active !== 'boolean') throw new ApiError('invalid_profile')
    if (input.active) await scoped('rpc/clinic_profile_can_manage', 'POST', {})
    // DB membership is checked on every request, even with a still-valid JWT.
    await db(`clinic_profiles?user_id=eq.${input.id}&clinic_id=eq.${cid}`, 'PATCH', { active: input.active })
    await authAdmin(env, `users/${input.id}`, 'PUT', { ban_duration: input.active ? 'none' : '876000h' })
  } else throw new ApiError('invalid_action')
  return { ok: true }
})
