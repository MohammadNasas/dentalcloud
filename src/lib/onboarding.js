// Presentation-only progress, scoped to the signed-in user and clinic on this device.
// Never use these flags for permissions or subscription access.
export const ONBOARDING_EVENT = 'dc-onboarding-change'
const memory = new Map()
export const onboardingKey = (clinicId, userId) => `dc:onboarding:v1:${clinicId}:${userId}`

export function readOnboarding(key) {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(key) || 'null')
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch { /* Storage may be unavailable. */ }
  return memory.get(key) || null
}

export function writeOnboarding(key, patch) {
  const value = { ...readOnboarding(key), ...patch }
  memory.set(key, value)
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)) } catch { /* Keep session progress. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ONBOARDING_EVENT))
  return value
}

export function initialOnboarding({ patients = [], appointments = [] } = {}) {
  // Existing working clinics do not need first-use guidance.
  return { clinic: false, patient: patients.length > 0, appointment: appointments.length > 0,
    dismissed: patients.length > 0 || appointments.length > 0, collapsed: false }
}

export function confirmOnboardingSave(clinicId, userId, step, saved) {
  if (!saved || !clinicId || !userId || !['clinic', 'patient', 'appointment'].includes(step)) return
  writeOnboarding(onboardingKey(clinicId, userId), { [step]: true })
}

export function onboardingSteps(progress, allowAppointments) {
  return ['clinic', 'patient', ...(allowAppointments ? ['appointment'] : [])].map(id => ({ id, done: progress?.[id] === true }))
}
