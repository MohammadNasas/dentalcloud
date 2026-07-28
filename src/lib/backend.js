// ──────────────────────────────────────────────────────────────────────────
//  Backend adapter. One interface, two implementations:
//   • localBackend   — offline, this device only (localStorage). Always works.
//   • cloudBackend   — Supabase: shared online accounts, web + desktop sync.
//  Selected automatically based on whether Supabase env config is present.
//
//  Interface (all async):
//    restore()                      -> { user, clinic } | null
//    signIn(identifier, password)   -> { ok, error? }
//    signUp({...})                  -> { ok, error?, message? }
//    signOut()
//    bootstrap(clinicId)            -> { clinic, doctors, patients, toothRecords,
//                                        appointments, payments, suggestions }
//    save(table, obj)               -> obj           (insert or update by id)
//    remove(table, id)
//    saveClinic(clinicObj)
//    genId()                        -> new id (uuid in cloud)
// ──────────────────────────────────────────────────────────────────────────
import { isCloud, supabase } from './supabaseClient'
import {
  getOrInitDB, saveDB, genId as localGenId, hashPassword, DOCTOR_COLORS,
} from './db'

// logical table -> Supabase table name
const SB = {
  patients: 'patients', toothRecords: 'tooth_records', appointments: 'appointments',
  payments: 'payments', suggestions: 'suggestions', doctors: 'doctors', lab_orders: 'lab_orders',
}
// logical table -> local db collection name
const LOCAL = {
  patients: 'patients', toothRecords: 'toothRecords', appointments: 'appointments',
  payments: 'payments', suggestions: 'suggestions', doctors: 'users', lab_orders: 'labOrders',
}

function newClinic(clinicName, tier, paid = false) {
  return {
    name: clinicName, nameAr: clinicName, tier, paid,
    createdAt: new Date().toISOString(), prices: [],
    settings: { currency: 'JOD', appointmentReminders: true, logo: null },
    customInstructions: {},
  }
}
function newDoctor(name, email, specialty) {
  return {
    email, name, nameAr: name, role: 'admin', color: DOCTOR_COLORS[0],
    specialty: specialty || '', isOwner: true,
  }
}

// ── LOCAL ──────────────────────────────────────────────────────────────────
const localBackend = {
  mode: 'local',
  genId: localGenId,

  async restore() {
    const db = getOrInitDB()
    const uid = db.session.currentUserId
    if (!uid) return null
    const user = db.users.find((u) => u.id === uid)
    if (!user) return null
    const clinic = db.clinics.find((c) => c.id === user.clinicId)
    return { user, clinic }
  },

  async signIn(identifier, password) {
    const db = getOrInitDB()
    const id = identifier.trim().toLowerCase()
    const u = db.users.find(
      (x) => (x.username || '').toLowerCase() === id || (x.email || '').toLowerCase() === id
    )
    if (!u || u.passwordHash !== hashPassword(password)) return { ok: false, error: 'wrongCreds' }
    db.session.currentUserId = u.id
    saveDB(db)
    return { ok: true }
  },

  async signUp({ clinicName, doctorName, email, password, specialty, tier = 'student' }) {
    const db = getOrInitDB()
    const ident = (email || '').trim().toLowerCase()
    if (db.users.some((u) => (u.email || '').toLowerCase() === ident || (u.username || '').toLowerCase() === ident))
      return { ok: false, error: 'userExists' }
    const clinicId = localGenId('clinic')
    const userId = localGenId('user')
    const clinic = { id: clinicId, ...newClinic(clinicName, tier, true) } // local mode = no payment
    const user = {
      id: userId, clinicId, username: email, ...newDoctor(doctorName, email, specialty),
      passwordHash: hashPassword(password),
    }
    db.clinics.push(clinic)
    db.users.push(user)
    db.session.currentUserId = userId
    saveDB(db)
    return { ok: true }
  },

  async signOut() {
    const db = getOrInitDB()
    db.session.currentUserId = null
    saveDB(db)
  },

  async bootstrap(clinicId) {
    const db = getOrInitDB()
    const f = (arr) => arr.filter((x) => x.clinicId === clinicId)
    if (!db.labOrders) db.labOrders = []
    return {
      clinic: db.clinics.find((c) => c.id === clinicId),
      doctors: f(db.users), patients: f(db.patients), toothRecords: f(db.toothRecords),
      appointments: f(db.appointments), payments: f(db.payments), suggestions: f(db.suggestions),
      labOrders: f(db.labOrders),
    }
  },

  async save(table, obj) {
    const db = getOrInitDB()
    const col = LOCAL[table]
    const i = db[col].findIndex((x) => x.id === obj.id)
    if (i >= 0) db[col][i] = obj
    else db[col].push(obj)
    saveDB(db)
    return obj
  },

  async remove(table, id) {
    const db = getOrInitDB()
    const col = LOCAL[table]
    db[col] = db[col].filter((x) => x.id !== id)
    if (table === 'patients') {
      db.toothRecords = db.toothRecords.filter((t) => t.patientId !== id)
      db.appointments = db.appointments.filter((a) => a.patientId !== id)
      db.payments = db.payments.filter((p) => p.patientId !== id)
    }
    saveDB(db)
  },

  async saveClinic(clinic) {
    const db = getOrInitDB()
    const i = db.clinics.findIndex((c) => c.id === clinic.id)
    if (i >= 0) db.clinics[i] = clinic
    saveDB(db)
    return clinic
  },

  async resetPassword() { return { ok: false, error: 'localMode' } },
  async updatePassword() { return { ok: false, error: 'localMode' } },
  async verifyOtp() { return { ok: true } },
  async resendOtp() { return { ok: true } },
  onAuthEvent() { return { data: { subscription: { unsubscribe() {} } } } },
}

// ── CLOUD (Supabase) ─────────────────────────────────────────────────────
async function loadMe(uid) {
  const d = await supabase.from('doctors').select('*').eq('id', uid).maybeSingle()
  if (!d.data) return null
  const user = { ...d.data.data, id: d.data.id, clinicId: d.data.clinic_id }
  const c = await supabase.from('clinics').select('*').eq('id', user.clinicId).maybeSingle()
  const clinic = c.data ? { ...c.data.data, id: c.data.id } : null
  return { user, clinic }
}

// Creates the clinic + owner-doctor rows for a freshly-authenticated user.
async function createClinicForUser(uid, { clinicName, doctorName, email, specialty, tier = 'student' }) {
  const clinicId = crypto.randomUUID ? crypto.randomUUID() : localGenId()
  const clinicObj = { id: clinicId, ...newClinic(clinicName, tier) }
  const doctorObj = { id: uid, clinicId, ...newDoctor(doctorName, email, specialty) }
  let r = await supabase.from('clinics').insert({ id: clinicId, owner_id: uid, data: clinicObj })
  if (r.error) return { ok: false, error: 'dbError', message: r.error.message }
  r = await supabase.from('doctors').insert({ id: uid, clinic_id: clinicId, data: doctorObj })
  if (r.error) return { ok: false, error: 'dbError', message: r.error.message }
  return { ok: true }
}

const cloudBackend = {
  mode: 'cloud',
  genId: () => (crypto.randomUUID ? crypto.randomUUID() : localGenId()),

  async restore() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    return await loadMe(session.user.id)
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, error: 'wrongCreds' }
    return { ok: true }
  },

  async signUp(payload) {
    const email = (payload.email || '').trim()
    const { data, error } = await supabase.auth.signUp({ email, password: payload.password })
    if (error) {
      const msg = error.message || ''
      if (/registered|exists/i.test(msg)) return { ok: false, error: 'userExists' }
      return { ok: false, error: 'signupFailed', message: msg }
    }
    // Supabase returns an empty identities array when the email already exists.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
      return { ok: false, error: 'userExists' }

    if (data.session) {
      // Email confirmation is OFF → create the clinic immediately.
      return await createClinicForUser(data.user.id, { ...payload, email })
    }
    // Email confirmation is ON → ask for the code, create clinic after verifying.
    return { ok: false, needsOtp: true, email, pending: { ...payload, email } }
  },

  // Verify the emailed signup code, then create the clinic.
  async verifyOtp(email, token, pending) {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'signup' })
    if (error || !data.session) return { ok: false, error: 'wrongCode', message: error?.message }
    return await createClinicForUser(data.user.id, pending)
  },
  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    return { ok: !error, error: error?.message }
  },

  async signOut() { await supabase.auth.signOut() },

  async bootstrap() {
    const out = { clinic: null, doctors: [], patients: [], toothRecords: [], appointments: [], payments: [], suggestions: [], labOrders: [] }
    const cl = await supabase.from('clinics').select('*').limit(1).maybeSingle()
    if (cl.data) out.clinic = { ...cl.data.data, id: cl.data.id }
    const pairs = [['doctors', 'doctors'], ['patients', 'patients'], ['tooth_records', 'toothRecords'],
      ['appointments', 'appointments'], ['payments', 'payments'], ['suggestions', 'suggestions'],
      ['lab_orders', 'labOrders']]
    for (const [sb, key] of pairs) {
      const r = await supabase.from(sb).select('*').maybeSingle ? await supabase.from(sb).select('*') : { data: [] }
      // lab_orders table may not exist yet — skip gracefully
      if (r.error) { console.warn(`bootstrap: table ${sb} not ready`, r.error.message); continue }
      out[key] = (r.data || []).map((row) => ({ ...row.data, id: row.id, clinicId: row.clinic_id }))
    }
    return out
  },

  async save(table, obj) {
    const r = await supabase.from(SB[table]).upsert({ id: obj.id, clinic_id: obj.clinicId, data: obj })
    if (r.error) console.error('cloud save', table, r.error.message)
    return obj
  },

  async remove(table, id) {
    // Deleting a patient cascades to its tooth records, appointments & payments.
    if (table === 'patients') {
      for (const child of ['tooth_records', 'appointments', 'payments']) {
        await supabase.from(child).delete().eq('data->>patientId', id)
      }
    }
    const r = await supabase.from(SB[table]).delete().eq('id', id)
    if (r.error) console.error('cloud remove', table, r.error.message)
  },

  async saveClinic(clinic) {
    const r = await supabase.from('clinics').update({ data: clinic }).eq('id', clinic.id)
    if (r.error) console.error('cloud saveClinic', r.error.message)
    return clinic
  },

  // Sends a reset link to the account's registered email (identity = inbox).
  async resetPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    return { ok: !error, error: error?.message }
  },
  // Called on the recovery screen to set the new password.
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { ok: !error, error: error?.message }
  },
  onAuthEvent(cb) {
    return supabase.auth.onAuthStateChange((event, session) => cb(event, session))
  },
}

export const backend = isCloud ? cloudBackend : localBackend
export const backendMode = backend.mode
