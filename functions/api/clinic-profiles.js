import { ApiError, bodyJSON, database, handle, response, uuid } from '../_lib/loyaltyAccess.js'
import { authAdmin, deviceTokenHash, legacyProfile, listedProfiles } from '../_lib/clinicProfileAuth.js'

export const onRequestOptions = ({ request }) => response(request, {})

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
  if (input.action === 'list' || input.action === 'device') {
    const doctors = await db(`doctors?clinic_id=eq.${cid}&select=id,data,created_at`)
    const profiles = listedProfiles(doctors, members, context.user.id)
    if (input.action === 'list') return { ok: true, profiles }
    const ids = profiles.filter(p => p.passwordless && p.active).map(p => p.id)
    if (!ids.length) return { ok: true, device: null }
    const deviceToken = (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '')
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    await db('clinic_profile_devices', 'POST', { token_hash: await deviceTokenHash(deviceToken), clinic_id: cid, profile_ids: ids, expires_at: expiresAt })
    // Capabilities are session-scoped on the client and cannot enter the owner profile.
    return { ok: true, device: { token: deviceToken, clinicId: cid, expiresAt } }
  }
  if (input.action === 'create') {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80
      || typeof input.password !== 'string' || input.password.length < 6 || input.password.length > 128) throw new ApiError('invalid_profile')
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
  if (!uuid(input.id) || input.id === context.user.id) throw new ApiError('unknown_profile', 404)
  const member = members.find(p => p.user_id === input.id)
  if (input.action !== 'delete' && member) {
    const [record] = await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}&select=data`)
    if (!record || record.data.profileDeletedAt) throw new ApiError('unknown_profile', 404)
    if (input.action === 'password' && legacyProfile(record.data)) throw new ApiError('passwordless_profile', 400)
  }
  if (input.action === 'delete') {
    if (!member) {
      const [old] = await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}&select=data`)
      if (!old || !legacyProfile(old.data)) throw new ApiError('unknown_profile', 404)
    }
    await scoped('rpc/clinic_profile_archive', 'POST', { p_doctor: input.id })
    const auth = await authAdmin(env, `users/${input.id}`, 'GET', null, true)
    if (auth) await authAdmin(env, `users/${input.id}`, 'PUT', { ban_duration: '876000h' })
    await db(`clinic_profiles?user_id=eq.${input.id}&clinic_id=eq.${cid}`, 'DELETE')
  } else if (!member) {
    throw new ApiError('unknown_profile', 404)
  } else if (input.action === 'update') {
    const old = (await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}&select=data`))[0]
    if (!old || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) throw new ApiError('invalid_profile')
    await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}`, 'PATCH', { data: { ...old.data, name: input.name.trim(), nameAr: input.name.trim(), specialty: String(input.specialty || '').slice(0, 100) } })
  } else if (input.action === 'password') {
    if (typeof input.password !== 'string' || input.password.length < 6 || input.password.length > 128) throw new ApiError('invalid_password')
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
