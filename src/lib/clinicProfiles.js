import { supabase } from './supabaseClient'
import { paymentApiUrl } from './apiUrl'
import { loadStaffClinic } from './clinicBootstrap.js'

const DIRECTORY = 'dc_clinic_profile_directory_v1'
const CHANNEL = 'dc_profile_session_changed'
const DEVICE = 'dc_clinic_profile_device_v1'
export function profileDirectory() {
  try { const value = JSON.parse(localStorage.getItem(DIRECTORY)); return Array.isArray(value?.profiles) ? value : null } catch { return null }
}
export function rememberProfiles(clinic, profiles) {
  // Names/login identifiers only. Never save a password or a previous session.
  localStorage.setItem(DIRECTORY, JSON.stringify({ clinicId: clinic.id, name: clinic.nameAr || clinic.name,
    profiles: profiles.filter(p => p.active).map(({ id, name, color, email, owner, passwordless, createdAt }) => ({ id, name, color, email, owner, passwordless, createdAt })) }))
}
export function forgetProfiles() { localStorage.removeItem(DIRECTORY); sessionStorage.removeItem(DEVICE) }
export async function prepareProfileDevice() {
  const { device } = await manageProfiles({ action: 'device' })
  if (device) sessionStorage.setItem(DEVICE, JSON.stringify(device))
  else sessionStorage.removeItem(DEVICE)
}
export async function signInDeviceProfile(id) {
  let device
  try { device = JSON.parse(sessionStorage.getItem(DEVICE)) } catch {}
  if (!device || device.clinicId !== profileDirectory()?.clinicId) return { ok: false, error: 'device_sign_in_required' }
  const response = await fetch(paymentApiUrl('/api/clinic-profile-entry', window.location.protocol), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, deviceToken: device.token }),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) return { ok: false, error: result.error }
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: 'magiclink' })
  if (error) return { ok: false, error: 'profile_unavailable' }
  if (data.user?.id !== id) { await supabase.auth.signOut({ scope: 'local' }); return { ok: false, error: 'profile_unavailable' } }
  return { ok: true }
}
export function announceProfileSwitch() { localStorage.setItem(CHANNEL, crypto.randomUUID()) }
export function watchProfileSwitch(callback) {
  const listener = e => { if (e.key === CHANNEL) callback() }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
export async function profileRPC(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}
export async function manageProfiles(input) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('sign_in_required')
  const r = await fetch(paymentApiUrl('/api/clinic-profiles', window.location.protocol), {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await r.json()
  if (!r.ok || !data.ok) throw new Error(data.error || 'profile_save_failed')
  return data
}
export async function staffBootstrap(clinic) {
  return loadStaffClinic(profileRPC, clinic)
}
export const profileTables = { patients: 'patients', toothRecords: 'tooth_records', appointments: 'appointments', payments: 'payments', lab_orders: 'lab_orders' }
export function patientFinanceAllowed(user, patient) {
  return !user?.staffProfile || patient?.canViewFinance === true
}
