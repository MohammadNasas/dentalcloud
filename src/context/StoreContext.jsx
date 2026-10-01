import { hasVerifiedPaidAccess } from '../lib/entitlement.js'
import { clearDraftScope, draftScope } from '../lib/draftStorage.js'
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { hashPassword, DOCTOR_COLORS, resetDB, seedDB, isComplimentary, isAppOwner } from '../lib/db'
import { backend } from '../lib/backend'
import { clearPaymentReturn, getPaypalReturn, capturePaypal, syncPaypalSubscription } from '../lib/payments'
import { buildDemoState } from '../lib/demo'
import { trackDailyActive } from '../lib/analytics'
import { purgeCloudBackedImageCache } from '../lib/media'
import { toast } from '../components/anim'
import { createWriteQueue } from '../lib/writeQueue.js'
import { createUndoDelete, withoutDeletedRecords } from '../lib/undoDelete.js'

const StoreContext = createContext(null)

const TIER_ORDER = { student: 0, pro: 1 }
export const FEATURE_MIN_TIER = {
  appointments: 'pro', calendar: 'pro', multiDoctor: 'pro',
  priceCatalog: 'pro',
  priorityTeeth: 'pro', reminders: 'pro', apptWorkLog: 'pro',
  paymentMethods: 'pro', clinicBalances: 'pro', consent: 'pro',
  instructionsFull: 'pro',
  photos: 'pro', reports: 'pro', splitPayments: 'pro', lab: 'pro', orthodontics: 'pro',
  // Free for the Student plan: dental chart, perio/gum chart (perio, plaque),
  // a single X-ray gallery (see Gallery), and 3 ready instruction sheets.
}

const EMPTY = {
  clinic: null, currentUser: null,
  doctors: [], patients: [], toothRecords: [], appointments: [], payments: [], suggestions: [], labOrders: [],
}

export function StoreProvider({ children }) {
  const [booting, setBooting] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [pendingOtp, setPendingOtp] = useState(null) // { email, pending } when email confirmation is on
  const [paymentResult, setPaymentResult] = useState(null) // result after returning from PayPal
  const [isOwner, setIsOwner] = useState(false) // app owner → sees the global suggestions inbox
  const [loadError, setLoadError] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ pending: 0, failed: 0 })
  const queueRef = useRef(null)
  if (!queueRef.current) queueRef.current = createWriteQueue(setSaveStatus)
  const [storedState, setStateValue] = useState(EMPTY)
  const [pendingDeletes, setPendingDeletes] = useState([])
  const undoRef = useRef(null)
  if (!undoRef.current) undoRef.current = createUndoDelete(setPendingDeletes)
  const state = useMemo(() => withoutDeletedRecords(storedState, pendingDeletes), [storedState, pendingDeletes])
  const stateRef = useRef(storedState)
  const setState = useCallback((update) => {
    const next = typeof update === 'function' ? update(stateRef.current) : update
    stateRef.current = next
    setStateValue(next)
  }, [])

  useEffect(() => {
    const warn = (event) => {
      if (!queueRef.current.hasUnsaved() && !undoRef.current.hasPending()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  useEffect(() => () => undoRef.current.reset(), [])

  // Read-only showcase mode: reached via ?demo=1 → loads in-memory example data
  // and blocks every write so visitors can browse but never change anything.
  const isDemo = useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      return sp.has('demo') || /demo/i.test(window.location.hash)
    } catch { return false }
  }, [])

  // ── Boot: restore existing session ─────────────────────────────────────
  const loadSession = useCallback(async () => {
    setLoadError(false)
    try {
      const me = await backend.restore()
      if (me && me.clinic) {
        const data = await backend.bootstrap(me.clinic.id)
        let clinic = data.clinic || me.clinic
        // Economy was retired in July 2026. Upgrade legacy accounts in place so
        // they immediately receive the complete Pro feature set.
        if (clinic?.tier === 'economy') {
          clinic = { ...clinic, tier: 'pro' }
          clinic = await backend.saveClinic(clinic)
        }
        // Complimentary accounts → free Pro (skip the paywall).
        if (backend.mode === 'cloud' && (!clinic.paid || clinic.tier !== 'pro') && await isComplimentary(me.user?.email)) {
          clinic = { ...clinic, tier: 'pro', paid: true }
          clinic = await backend.saveClinic(clinic)
        }
        if (backend.mode === 'cloud' && clinic?.paypalSubscriptionId) {
          const synced = await syncPaypalSubscription({ subscriptionId: clinic.paypalSubscriptionId, clinicId: clinic.id })
          if (synced.ok && synced.clinic) clinic = synced.clinic
        }
        if (backend.mode === 'cloud') {
          purgeCloudBackedImageCache(data.patients).catch((e) => console.warn('Could not clear old patient image cache', e))
        }
        setState({
          clinic,
          currentUser: me.user,
          doctors: data.doctors, patients: data.patients, toothRecords: data.toothRecords,
          appointments: data.appointments, payments: data.payments, suggestions: data.suggestions,
          labOrders: data.labOrders || [],
        })
      } else {
        setState(EMPTY)
      }
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (isDemo) { setState(buildDemoState()); return }
        await loadSession()
      } catch { setLoadError(true) }
      finally { if (active) setBooting(false) }
    })()
    return () => { active = false }
  }, [loadSession, isDemo])

  const retryLoad = useCallback(async () => {
    setBooting(true)
    try { await loadSession() } catch { setLoadError(true) }
    finally { setBooting(false) }
  }, [loadSession])

  // Detect the password-recovery link (user clicked the reset email).
  useEffect(() => {
    const { data } = backend.onAuthEvent((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data?.subscription?.unsubscribe?.()
  }, [])

  // Handle the return from a PayPal payment → capture & refresh the plan.
  useEffect(() => {
    const paypalPayment = getPaypalReturn()
    if (!paypalPayment) return
    let cancelled = false
    let pollTimer = null
    clearPaymentReturn()
    ;(async () => {
      const res = await capturePaypal(paypalPayment)
      if (res.ok) await loadSession()
      // Keep checkout metadata so the result dialog can distinguish a free
      // trial from an immediate paid subscription, or offer the paid fallback.
      if (!cancelled) setPaymentResult(res)
      if (res.ok && res.paymentPending && res.subscriptionId && res.clinicId) {
        let attempts = 0
        const pollPayment = async () => {
          if (cancelled) return
          attempts += 1
          const synced = await syncPaypalSubscription({ subscriptionId: res.subscriptionId, clinicId: res.clinicId })
          if (synced.ok && synced.paid) {
            await loadSession()
            if (!cancelled) setPaymentResult({ ...res, paid: true, paymentPending: false })
            return
          }
          // PayPal's sale event can arrive shortly after subscription approval.
          // Keep the account locked while checking; stop after about one minute.
          if (attempts < 20) pollTimer = setTimeout(pollPayment, 3000)
        }
        pollTimer = setTimeout(pollPayment, 3000)
      }
    })()
    return () => { cancelled = true; if (pollTimer) clearTimeout(pollTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const dismissPaymentResult = useCallback(() => setPaymentResult(null), [])

  const resetPassword = useCallback((email) => backend.resetPassword(email), [])
  const updatePassword = useCallback(async (newPassword) => {
    const res = await backend.updatePassword(newPassword)
    if (res.ok) { setRecovery(false); await loadSession() }
    return res
  }, [loadSession])

  const { clinic, currentUser } = state
  const [accessNow, setAccessNow] = useState(Date.now())
  useEffect(() => {
    const tick = () => setAccessNow(Date.now())
    const timer = setInterval(tick, 30000)
    window.addEventListener('focus', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [])
  const expiredClinic = (value, now = Date.now()) => backend.mode === 'cloud' && value
    && value.tier !== 'student' && !hasVerifiedPaidAccess(value, now)
    && !(Date.parse(value.trialEndsAt || '') > now)
  const subscriptionReadOnly = !isDemo && Boolean(expiredClinic(clinic, accessNow))
  const rejectExpiredWrite = () => {
    if (!expiredClinic(stateRef.current.clinic)) return false
    toast('انتهى الاشتراك: يمكنك العرض والتصدير أو التجديد. / Subscription expired: view, export or renew.')
    return true
  }

  const tier = clinic?.tier === 'economy' ? 'pro' : (clinic?.tier || 'student')
  const can = useCallback((feature) => {
    const need = FEATURE_MIN_TIER[feature]
    if (!need) return true
    return TIER_ORDER[tier] >= TIER_ORDER[need]
  }, [tier])

  // Cloud usage analytics: one lightweight heartbeat on open, then every few
  // minutes while the app is visible. It records only account/app metadata.
  useEffect(() => {
    if (backend.mode !== 'cloud' || isDemo || !clinic?.id || !currentUser?.id) return
    let stopped = false
    const send = (force = false) => {
      if (stopped) return
      const latest = stateRef.current
      trackDailyActive({ clinic: latest.clinic, user: latest.currentUser }, { force })
    }
    send(true)
    const timer = setInterval(() => send(false), 5 * 60 * 1000)
    const onFocus = () => send(false)
    const onVisibility = () => { if (document.visibilityState === 'visible') send(false) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [clinic?.id, currentUser?.id, isDemo])

  // Keep subscription-gated access aligned with PayPal while the app is open.
  useEffect(() => {
    if (backend.mode !== 'cloud' || isDemo || !clinic?.id || !clinic?.paypalSubscriptionId) return
    let stopped = false
    const sync = async () => {
      const latest = stateRef.current.clinic
      if (!latest?.paypalSubscriptionId) return
      const res = await syncPaypalSubscription({ subscriptionId: latest.paypalSubscriptionId, clinicId: latest.id })
      if (!stopped && res.ok && res.clinic && !queueRef.current.hasUnsaved()) setState((s) => ({ ...s, clinic: res.clinic }))
    }
    const timer = setInterval(sync, 10 * 60 * 1000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [clinic?.id, clinic?.paypalSubscriptionId, isDemo])

  // Resolve the app-owner flag whenever the logged-in user changes (async hash).
  useEffect(() => {
    let active = true
    isAppOwner(currentUser?.email).then((v) => { if (active) setIsOwner(v) })
    return () => { active = false }
  }, [currentUser?.email])

  // ── Auth ────────────────────────────────────────────────────────────────
  const login = useCallback(async (identifier, password) => {
    const res = await backend.signIn(identifier, password)
    if (res.ok) await loadSession()
    return res
  }, [loadSession])

  const register = useCallback(async (payload) => {
    const res = await backend.signUp(payload)
    if (res.ok) await loadSession()
    else if (res.needsOtp) setPendingOtp({ email: res.email, pending: res.pending })
    return res
  }, [loadSession])

  const verifyOtp = useCallback(async (token) => {
    if (!pendingOtp) return { ok: false }
    const res = await backend.verifyOtp(pendingOtp.email, token, pendingOtp.pending)
    if (res.ok) { setPendingOtp(null); await loadSession() }
    return res
  }, [pendingOtp, loadSession])
  const resendOtp = useCallback(() => (pendingOtp ? backend.resendOtp(pendingOtp.email) : Promise.resolve({ ok: false })), [pendingOtp])
  const cancelOtp = useCallback(() => setPendingOtp(null), [])

  const logout = useCallback(() => {
    if (undoRef.current.hasPending()) {
      toast('انتظر تأكيد الحذف أو اضغط تراجع قبل تسجيل الخروج. / Wait for deletion or undo before signing out.', 'info')
      return
    }
    if (queueRef.current.hasUnsaved()) {
      toast('يوجد تعديلات لم تُحفظ. أعد المحاولة قبل تسجيل الخروج. / Please retry unsaved changes before signing out.')
      return
    }
    clearDraftScope(draftScope(stateRef.current.currentUser?.id, stateRef.current.clinic?.id)).catch(() => toast('تعذّر مسح مسودات الجهاز. / Could not clear device drafts.'))
    queueRef.current.reset()
    setState(EMPTY)
    backend.signOut().catch((e) => console.error(e))
  }, [])

  // Drafts update immediately for typing. Success is reported only after the
  // server confirms; failed drafts remain visible with an explicit retry.
  const upsert = useCallback((key, table, obj) => {
    if (undoRef.current.has(`${key}:${obj.id}`)) return Promise.resolve(null)
    if (obj.patientId && undoRef.current.has(`patients:${obj.patientId}`)) return Promise.resolve(null)
    if (rejectExpiredWrite()) return Promise.resolve(null)
    if (isDemo) { toast('🔒 وضع العرض فقط — لا يمكن التعديل'); return Promise.resolve(null) }
    const apply = (saved) => setState((s) => {
      const exists = s[key].some((x) => x.id === saved.id)
      return { ...s, [key]: exists ? s[key].map((x) => (x.id === saved.id ? saved : x)) : [...s[key], saved] }
    })
    apply(obj)
    return queueRef.current.enqueue(`${table}:${obj.id}`, () => backend.save(table, obj), apply)
  }, [isDemo])

  const drop = useCallback((key, table, id, extra) => {
    const existing = stateRef.current[key].find((item) => item.id === id)
    if (existing?.patientId && undoRef.current.has(`patients:${existing.patientId}`)) return Promise.resolve(null)
    if (rejectExpiredWrite()) return Promise.resolve(null)
    if (isDemo) { toast('🔒 وضع العرض فقط — لا يمكن التعديل'); return Promise.resolve(null) }
    return queueRef.current.enqueue(`${table}:${id}`, () => backend.remove(table, id), () => {
      setState((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id), ...(extra ? extra(s) : {}) }))
    })
  }, [isDemo])

  const scheduleDelete = useCallback((key, table, id, kind) => {
    if (isDemo || rejectExpiredWrite()) return Promise.resolve(null)
    if (queueRef.current.hasUnsaved()) {
      toast('انتظر حفظ التعديلات قبل الحذف. / Save pending changes before deleting.', 'info')
      return Promise.resolve(null)
    }
    const current = stateRef.current
    const record = current[key].find((item) => item.id === id)
    if (!record || (record.patientId && undoRef.current.has(`patients:${record.patientId}`))) return Promise.resolve(null)
    const clinicId = current.clinic?.id
    const userId = current.currentUser?.id
    const accepted = undoRef.current.add({ key: `${key}:${id}`, kind,
      commit: async () => {
        if (stateRef.current.clinic?.id !== clinicId || stateRef.current.currentUser?.id !== userId || rejectExpiredWrite()) return null
        const removed = await backend.remove(table, id)
        if (!removed) return null
        if (stateRef.current.clinic?.id === clinicId && stateRef.current.currentUser?.id === userId)
          setState((s) => withoutDeletedRecords(s, [{ key: `${key}:${id}` }]))
        return removed
      },
      failed: () => toast('تعذّر تأكيد الحذف. تحقق من الاتصال وحدّث الصفحة. / Could not confirm deletion. Check your connection and refresh.', 'error'),
    })
    return Promise.resolve(accepted || null)
  }, [isDemo])

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

  // ── Mutations (draft state + confirmed result) ───────────────────────────
  const addPatient = useCallback((data) => {
    const patient = {
      id: data.id || backend.genId(), clinicId: clinic.id,
      fileNo: data.fileNo || String(1000 + stateRef.current.patients.length + 1),
      name: data.name || '', nameAr: data.nameAr || data.name || '',
      phone: data.phone || '', gender: data.gender || '', dob: data.dob || '',
      age: data.age || '', occupation: data.occupation || '', address: data.address || '',
      complaint: data.complaint || '',
      history: data.history || { dental: {}, medical: {}, systems: {}, allergies: [], medications: [], social: {} },
      exam: data.exam || {}, orthodontics: data.orthodontics || {}, perio: data.perio || {}, plaque: data.plaque || {}, photos: [],
      createdBy: currentUser?.id, createdAt: new Date().toISOString(),
    }
    return upsert('patients', 'patients', patient)
  }, [clinic, currentUser, state.patients.length, upsert])

  const updatePatient = useCallback((id, patch) => {
    const old = stateRef.current.patients.find((p) => p.id === id)
    if (!old) return
    const resolvedPatch = typeof patch === 'function' ? patch(old) : patch
    if (!resolvedPatch) return
    return upsert('patients', 'patients', { ...old, ...resolvedPatch })
  }, [upsert])

  const deletePatient = useCallback((id) => {
    if (queueRef.current.hasUnsaved() || undoRef.current.hasPending()) {
      toast('احفظ التعديلات المعلّقة قبل حذف المريض. / Save pending changes before deleting the patient.')
      return Promise.resolve(null)
    }
    return scheduleDelete('patients', 'patients', id, 'patient')
  }, [scheduleDelete])

  const addToothRecord = useCallback((data) => {
    const rec = {
      id: backend.genId(), clinicId: clinic.id, doctorId: data.doctorId || currentUser?.id,
      date: data.date || new Date().toISOString(), status: 'planned', surfaces: [], price: 0, notes: '', ...data,
    }
    return upsert('toothRecords', 'toothRecords', rec)
  }, [clinic, currentUser, upsert])
  const updateToothRecord = useCallback((id, patch) => {
    const old = stateRef.current.toothRecords.find((t) => t.id === id)
    if (old) return upsert('toothRecords', 'toothRecords', { ...old, ...patch })
  }, [upsert])
  const deleteToothRecord = useCallback((id) => scheduleDelete('toothRecords', 'toothRecords', id, 'treatment'), [scheduleDelete])

  const addAppointment = useCallback((data) => {
    const ap = { id: backend.genId(), clinicId: clinic.id, status: 'scheduled', notes: '', step: '', ...data }
    return upsert('appointments', 'appointments', ap)
  }, [clinic, upsert])
  const updateAppointment = useCallback((id, patch) => {
    const old = stateRef.current.appointments.find((a) => a.id === id)
    if (old) return upsert('appointments', 'appointments', { ...old, ...patch })
  }, [upsert])
  const deleteAppointment = useCallback((id) => scheduleDelete('appointments', 'appointments', id, 'appointment'), [scheduleDelete])

  const addPayment = useCallback((data) => {
    const pay = { id: backend.genId(), clinicId: clinic.id, doctorId: data.doctorId || currentUser?.id, date: data.date || new Date().toISOString(), note: '', methods: [], ...data }
    return upsert('payments', 'payments', pay)
  }, [clinic, currentUser, upsert])
  const deletePayment = useCallback((id) => drop('payments', 'payments', id), [drop])

  const updateClinic = useCallback((patch) => {
    if (isDemo) { toast('🔒 وضع العرض فقط — لا يمكن التعديل'); return Promise.resolve(null) }
    const next = { ...stateRef.current.clinic, ...patch }
    setState((s) => ({ ...s, clinic: next }))
    return queueRef.current.enqueue(`clinics:${next.id}`, () => backend.saveClinic(next),
      (saved) => setState((s) => ({ ...s, clinic: saved })))
  }, [isDemo])
  const setTier = useCallback((newTier) => updateClinic({ tier: newTier }), [updateClinic])

  const addUser = useCallback(async (data) => {
    const used = stateRef.current.doctors.map((d) => d.color)
    const color = DOCTOR_COLORS.find((c) => !used.includes(c)) || DOCTOR_COLORS[stateRef.current.doctors.length % DOCTOR_COLORS.length]
    if (stateRef.current.doctors.some((u) => u.id !== data.id && (u.username || u.email || '').toLowerCase() === (data.username || '').toLowerCase()))
      return { ok: false, error: 'userExists' }
    const user = {
      id: data.id || backend.genId(), clinicId: clinic.id, username: data.username, email: data.username,
      passwordHash: hashPassword(data.password || '1234'), name: data.name, nameAr: data.name,
      role: data.role || 'doctor', color: data.color || color, specialty: data.specialty || '', isOwner: false,
    }
    const saved = await upsert('doctors', 'doctors', user)
    return saved ? { ok: true, user: saved } : { ok: false, error: 'saveFailed' }
  }, [clinic, upsert])
  const updateUser = useCallback((id, patch) => {
    const old = stateRef.current.doctors.find((u) => u.id === id)
    if (old) return upsert('doctors', 'doctors', { ...old, ...patch })
  }, [upsert])
  const deleteUser = useCallback((id) => drop('doctors', 'doctors', id), [drop])

  const addSuggestion = useCallback((text, id) => {
    const s = {
      id: id || backend.genId(), clinicId: clinic.id, clinicName: clinic.name, tier: clinic.tier,
      userId: currentUser?.id, userName: currentUser?.name, userEmail: currentUser?.email,
      text, date: new Date().toISOString(),
    }
    return upsert('suggestions', 'suggestions', s)
  }, [clinic, currentUser, upsert])

  const addLabOrder = useCallback((data) => {
    const order = {
      id: backend.genId(), clinicId: clinic.id, createdBy: currentUser?.id,
      createdAt: new Date().toISOString(), status: 'sent', toothIds: [], pieces: 1, ...data,
    }
    return upsert('labOrders', 'lab_orders', order)
  }, [clinic, currentUser, upsert])
  const updateLabOrder = useCallback((id, patch) => {
    const old = stateRef.current.labOrders.find((o) => o.id === id)
    if (old) return upsert('labOrders', 'lab_orders', { ...old, ...patch })
  }, [upsert])
  const deleteLabOrder = useCallback((id) => drop('labOrders', 'lab_orders', id), [drop])

  const resetToDemo = useCallback(() => {
    if (backend.mode !== 'local') { logout(); return }
    undoRef.current.reset()
    resetDB(); seedDB()
    setState(EMPTY)
    setBooting(true)
    loadSession().finally(() => setBooting(false))
  }, [logout, loadSession])

  const value = {
    booting, loadError, retryLoad, recovery, mode: backend.mode,
    saveStatus, retrySaves: queueRef.current.retry,
    pendingDeletes, undoDelete: undoRef.current.undo,
    otpEmail: pendingOtp?.email || null, verifyOtp, resendOtp, cancelOtp,
    paymentResult, dismissPaymentResult,
    clinic, currentUser, tier, can, isOwner, readOnly: isDemo || subscriptionReadOnly, subscriptionReadOnly, demoMode: isDemo,
    login, logout, register, resetPassword, updatePassword,
    patients: state.patients, doctors: state.doctors, appointments: state.appointments,
    toothRecords: state.toothRecords, payments: state.payments, suggestions: state.suggestions,
    labOrders: state.labOrders,
    getPatient, getDoctor, recordsForPatient, apptsForPatient, paymentsForPatient, balanceForPatient,
    addPatient, updatePatient, deletePatient,
    addToothRecord, updateToothRecord, deleteToothRecord,
    addAppointment, updateAppointment, deleteAppointment,
    addPayment, deletePayment,
    addLabOrder, updateLabOrder, deleteLabOrder,
    updateClinic, setTier, addUser, updateUser, deleteUser, addSuggestion, resetToDemo,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
