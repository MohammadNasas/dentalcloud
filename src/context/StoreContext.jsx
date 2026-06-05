import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { hashPassword, DOCTOR_COLORS, resetDB, seedDB } from '../lib/db'
import { backend } from '../lib/backend'

const StoreContext = createContext(null)

const TIER_ORDER = { student: 0, economy: 1, pro: 2 }
export const FEATURE_MIN_TIER = {
  appointments: 'economy', calendar: 'economy', multiDoctor: 'economy',
  priceCatalog: 'economy', perio: 'economy', plaque: 'economy',
  priorityTeeth: 'economy', reminders: 'economy', apptWorkLog: 'economy',
  paymentMethods: 'economy',
  photos: 'pro', reports: 'pro', splitPayments: 'pro',
  // instructions are available to every plan (their own main section)
}

const EMPTY = {
  clinic: null, currentUser: null,
  doctors: [], patients: [], toothRecords: [], appointments: [], payments: [], suggestions: [],
}

export function StoreProvider({ children }) {
  const [booting, setBooting] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [state, setState] = useState(EMPTY)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // ── Boot: restore existing session ─────────────────────────────────────
  const loadSession = useCallback(async () => {
    const me = await backend.restore()
    if (me && me.clinic) {
      const data = await backend.bootstrap(me.clinic.id)
      setState({
        clinic: data.clinic || me.clinic,
        currentUser: me.user,
        doctors: data.doctors, patients: data.patients, toothRecords: data.toothRecords,
        appointments: data.appointments, payments: data.payments, suggestions: data.suggestions,
      })
    } else {
      setState(EMPTY)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try { await loadSession() } catch (e) { console.error('restore failed', e) }
      finally { if (active) setBooting(false) }
    })()
    return () => { active = false }
  }, [loadSession])

  // Detect the password-recovery link (user clicked the reset email).
  useEffect(() => {
    const { data } = backend.onAuthEvent((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data?.subscription?.unsubscribe?.()
  }, [])

  const resetPassword = useCallback((email) => backend.resetPassword(email), [])
  const updatePassword = useCallback(async (newPassword) => {
    const res = await backend.updatePassword(newPassword)
    if (res.ok) { setRecovery(false); await loadSession() }
    return res
  }, [loadSession])

  const { clinic, currentUser } = state
  const tier = clinic?.tier || 'student'
  const can = useCallback((feature) => {
    const need = FEATURE_MIN_TIER[feature]
    if (!need) return true
    return TIER_ORDER[tier] >= TIER_ORDER[need]
  }, [tier])

  // ── Auth ────────────────────────────────────────────────────────────────
  const login = useCallback(async (identifier, password) => {
    const res = await backend.signIn(identifier, password)
    if (res.ok) await loadSession()
    return res
  }, [loadSession])

  const register = useCallback(async (payload) => {
    const res = await backend.signUp(payload)
    if (res.ok) await loadSession()
    return res
  }, [loadSession])

  const logout = useCallback(() => {
    setState(EMPTY)
    backend.signOut().catch((e) => console.error(e))
  }, [])

  // ── Optimistic write helpers ─────────────────────────────────────────────
  const upsert = useCallback((key, table, obj) => {
    setState((s) => {
      const exists = s[key].some((x) => x.id === obj.id)
      return { ...s, [key]: exists ? s[key].map((x) => (x.id === obj.id ? obj : x)) : [...s[key], obj] }
    })
    backend.save(table, obj).catch((e) => console.error('save', table, e))
  }, [])

  const drop = useCallback((key, table, id, extra) => {
    setState((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id), ...(extra ? extra(s) : {}) }))
    backend.remove(table, id).catch((e) => console.error('remove', table, e))
  }, [])

  // ── Selectors ─────────────────────────────────────────────────────────────
  const getPatient = useCallback((id) => state.patients.find((p) => p.id === id) || null, [state.patients])
  const getDoctor = useCallback((id) => state.doctors.find((u) => u.id === id) || null, [state.doctors])
  const recordsForPatient = useCallback((pid) => state.toothRecords.filter((t) => t.patientId === pid), [state.toothRecords])
  const apptsForPatient = useCallback((pid) => state.appointments.filter((a) => a.patientId === pid), [state.appointments])
  const paymentsForPatient = useCallback((pid) => state.payments.filter((p) => p.patientId === pid), [state.payments])
  const balanceForPatient = useCallback((pid) => {
    const fees = recordsForPatient(pid).reduce((s, r) => s + (Number(r.price) || 0), 0)
    const paid = paymentsForPatient(pid).reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return { fees, paid, debt: Math.max(0, fees - paid), raw: fees - paid }
  }, [recordsForPatient, paymentsForPatient])

  // ── Mutations (optimistic local state + background sync) ──────────────────
  const addPatient = useCallback((data) => {
    const patient = {
      id: backend.genId(), clinicId: clinic.id,
      fileNo: data.fileNo || String(1000 + state.patients.length + 1),
      name: data.name || '', nameAr: data.nameAr || data.name || '',
      phone: data.phone || '', gender: data.gender || '', dob: data.dob || '',
      age: data.age || '', occupation: data.occupation || '', address: data.address || '',
      complaint: data.complaint || '',
      history: data.history || { dental: {}, medical: {}, systems: {}, allergies: [], medications: [], social: {} },
      exam: data.exam || {}, perio: data.perio || {}, plaque: data.plaque || {}, photos: [],
      createdBy: currentUser?.id, createdAt: new Date().toISOString(),
    }
    upsert('patients', 'patients', patient)
    return patient
  }, [clinic, currentUser, state.patients.length, upsert])

  const updatePatient = useCallback((id, patch) => {
    const old = stateRef.current.patients.find((p) => p.id === id)
    if (!old) return
    upsert('patients', 'patients', { ...old, ...patch })
  }, [upsert])

  const deletePatient = useCallback((id) => {
    drop('patients', 'patients', id, (s) => ({
      toothRecords: s.toothRecords.filter((t) => t.patientId !== id),
      appointments: s.appointments.filter((a) => a.patientId !== id),
      payments: s.payments.filter((p) => p.patientId !== id),
    }))
  }, [drop])

  const addToothRecord = useCallback((data) => {
    const rec = {
      id: backend.genId(), clinicId: clinic.id, doctorId: data.doctorId || currentUser?.id,
      date: data.date || new Date().toISOString(), status: 'planned', surfaces: [], price: 0, notes: '', ...data,
    }
    upsert('toothRecords', 'toothRecords', rec)
    return rec
  }, [clinic, currentUser, upsert])
  const updateToothRecord = useCallback((id, patch) => {
    const old = stateRef.current.toothRecords.find((t) => t.id === id)
    if (old) upsert('toothRecords', 'toothRecords', { ...old, ...patch })
  }, [upsert])
  const deleteToothRecord = useCallback((id) => drop('toothRecords', 'toothRecords', id), [drop])

  const addAppointment = useCallback((data) => {
    const ap = { id: backend.genId(), clinicId: clinic.id, status: 'scheduled', notes: '', step: '', ...data }
    upsert('appointments', 'appointments', ap)
    return ap
  }, [clinic, upsert])
  const updateAppointment = useCallback((id, patch) => {
    const old = stateRef.current.appointments.find((a) => a.id === id)
    if (old) upsert('appointments', 'appointments', { ...old, ...patch })
  }, [upsert])
  const deleteAppointment = useCallback((id) => drop('appointments', 'appointments', id), [drop])

  const addPayment = useCallback((data) => {
    const pay = { id: backend.genId(), clinicId: clinic.id, doctorId: data.doctorId || currentUser?.id, date: data.date || new Date().toISOString(), note: '', methods: [], ...data }
    upsert('payments', 'payments', pay)
    return pay
  }, [clinic, currentUser, upsert])
  const deletePayment = useCallback((id) => drop('payments', 'payments', id), [drop])

  const updateClinic = useCallback((patch) => {
    const next = { ...stateRef.current.clinic, ...patch }
    setState((s) => ({ ...s, clinic: next }))
    backend.saveClinic(next).catch((e) => console.error(e))
  }, [])
  const setTier = useCallback((newTier) => updateClinic({ tier: newTier }), [updateClinic])

  const addUser = useCallback((data) => {
    const used = stateRef.current.doctors.map((d) => d.color)
    const color = DOCTOR_COLORS.find((c) => !used.includes(c)) || DOCTOR_COLORS[stateRef.current.doctors.length % DOCTOR_COLORS.length]
    if (stateRef.current.doctors.some((u) => (u.username || u.email || '').toLowerCase() === (data.username || '').toLowerCase()))
      return { ok: false, error: 'userExists' }
    const user = {
      id: backend.genId(), clinicId: clinic.id, username: data.username, email: data.username,
      passwordHash: hashPassword(data.password || '1234'), name: data.name, nameAr: data.name,
      role: data.role || 'doctor', color: data.color || color, specialty: data.specialty || '', isOwner: false,
    }
    upsert('doctors', 'doctors', user)
    return { ok: true, user }
  }, [clinic, upsert])
  const updateUser = useCallback((id, patch) => {
    const old = stateRef.current.doctors.find((u) => u.id === id)
    if (old) upsert('doctors', 'doctors', { ...old, ...patch })
  }, [upsert])
  const deleteUser = useCallback((id) => drop('doctors', 'doctors', id), [drop])

  const addSuggestion = useCallback((text) => {
    const s = { id: backend.genId(), clinicId: clinic.id, userId: currentUser?.id, text, date: new Date().toISOString() }
    upsert('suggestions', 'suggestions', s)
    return s
  }, [clinic, currentUser, upsert])

  const resetToDemo = useCallback(() => {
    if (backend.mode !== 'local') { logout(); return }
    resetDB(); seedDB()
    setState(EMPTY)
    setBooting(true)
    loadSession().finally(() => setBooting(false))
  }, [logout, loadSession])

  const value = {
    booting, recovery, mode: backend.mode,
    clinic, currentUser, tier, can,
    login, logout, register, resetPassword, updatePassword,
    patients: state.patients, doctors: state.doctors, appointments: state.appointments,
    toothRecords: state.toothRecords, payments: state.payments, suggestions: state.suggestions,
    getPatient, getDoctor, recordsForPatient, apptsForPatient, paymentsForPatient, balanceForPatient,
    addPatient, updatePatient, deletePatient,
    addToothRecord, updateToothRecord, deleteToothRecord,
    addAppointment, updateAppointment, deleteAppointment,
    addPayment, deletePayment,
    updateClinic, setTier, addUser, updateUser, deleteUser, addSuggestion, resetToDemo,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
