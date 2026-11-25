import { ApiError, bodyJSON, database, handle, response, uuid } from '../_lib/loyaltyAccess.js'
import { authAdmin, deviceTokenHash, legacyProfile } from '../_lib/clinicProfileAuth.js'

export const onRequestOptions = ({ request }) => response(request, {})

// A device capability is issued only to the authenticated clinic owner. Names,
// emails and profile IDs alone are never sufficient to enter a passwordless profile.
export const onRequestPost = ({ request, env }) => handle(request, async () => {
  const input = await bodyJSON(request)
  if (!uuid(input.id) || !/^[a-f0-9]{64}$/.test(input.deviceToken || '')) throw new ApiError('device_sign_in_required', 401)
  const db = database(env)
  const hash = await deviceTokenHash(input.deviceToken)
  const device = (await db(`clinic_profile_devices?token_hash=eq.${hash}&select=clinic_id,profile_ids`))[0]
  if (!device || !device.profile_ids.includes(input.id)) throw new ApiError('device_sign_in_required', 401)
  const cid = device.clinic_id
  const [doctor] = await db(`doctors?id=eq.${input.id}&clinic_id=eq.${cid}&select=id,data`)
  const [clinic] = await db(`clinics?id=eq.${cid}&select=owner_id`)
  const [member] = await db(`clinic_profiles?user_id=eq.${input.id}&clinic_id=eq.${cid}&select=active`)
  if (!doctor || !clinic || clinic.owner_id === input.id || !legacyProfile(doctor.data) || member?.active === false) throw new ApiError('profile_unavailable', 403)
  const email = `${input.id}@profiles.dentalcloudapp.com`
  let auth = await authAdmin(env, `users/${input.id}`, 'GET', null, true)
  if (!auth) {
    auth = await authAdmin(env, 'users', 'POST', { id: input.id, email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`, email_confirm: true,
      user_metadata: { clinicProfile: true }, app_metadata: { legacyClinicId: cid } })
  }
  const user = auth.user || auth
  if (user.id !== input.id || user.email !== email || user.app_metadata?.legacyClinicId !== cid
    || Date.parse(user.banned_until) > Date.now()) throw new ApiError('profile_unavailable', 403)
  await db('rpc/clinic_profile_finish_legacy', 'POST', { p_clinic: cid, p_doctor: input.id, p_email: email })
  const link = await authAdmin(env, 'generate_link', 'POST', { type: 'magiclink', email })
  const tokenHash = link.hashed_token || link.properties?.hashed_token
  if (!tokenHash) throw new ApiError('profile_auth_failed', 502)
  return { ok: true, tokenHash }
})
