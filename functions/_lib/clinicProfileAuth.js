import { ApiError } from './loyaltyAccess.js'

export const legacyProfile = data => Boolean(data && !data.profileDeletedAt &&
  (typeof data.passwordHash === 'string' || data.profileLoginMode === 'device'))

export async function authAdmin(env, path, method, body, missingOK = false) {
  const result = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/${path}`, {
    method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  })
  if (missingOK && result.status === 404) return null
  if (!result.ok) throw new ApiError('profile_auth_failed', 502)
  return result.status === 204 ? null : result.json()
}

export async function deviceTokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

export function listedProfiles(doctors, members, ownerId) {
  return doctors.flatMap(d => {
    const owner = d.id === ownerId, member = members.find(p => p.user_id === d.id)
    const legacy = legacyProfile(d.data)
    if (d.data.profileDeletedAt || (!owner && !member && !legacy)) return []
    return [{ id: d.id, name: d.data.name || d.data.nameAr, color: d.data.color,
      specialty: d.data.specialty || '', email: legacy ? null : d.data.email, owner,
      createdAt: d.created_at || null, passwordless: !owner && legacy, needsActivation: legacy && !member,
      active: owner || (member ? member.active === true : legacy) }]
  })
}
