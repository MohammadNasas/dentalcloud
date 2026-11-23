import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockKeyhole, Plus, ShieldCheck, Users, ArrowRight } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { Avatar, Modal, Field } from './ui'
import { manageProfiles, rememberProfiles, profileDirectory, forgetProfiles, announceProfileSwitch, profileRPC } from '../lib/clinicProfiles'

const errorText = ar => ar ? 'تعذّر إتمام العملية. تحقق من الاتصال والصلاحيات وحاول مجددًا.' : 'Could not complete this action. Check your connection and permissions, then try again.'

export function ProfileSwitcher() {
  const { clinic, currentUser, logout, demoMode, mode } = useStore()
  const { lang } = useI18n(); const ar = lang === 'ar'
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  if (demoMode || mode !== 'cloud') return null
  async function lock() {
    setBusy(true); setError('')
    try {
      if (!currentUser.staffProfile) {
        const data = await manageProfiles({ action: 'list' })
        rememberProfiles(clinic, data.profiles.map(p => p.owner ? { ...p, email: currentUser.email } : p))
      }
      if (await logout()) { announceProfileSwitch(); navigate('/profiles', { replace: true }) }
    } catch { setError(errorText(ar)) } finally { setBusy(false) }
  }
  return <div className="px-2"><button disabled={busy} onClick={lock} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/10"><LockKeyhole size={14}/>{ar ? 'قفل وتبديل البروفايل' : 'Lock & switch profile'}</button>{error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}</div>
}

export function ProfileSelector() {
  const { login } = useStore(); const { lang } = useI18n(); const ar = lang === 'ar'
  const navigate = useNavigate()
  const [directory, setDirectory] = useState(profileDirectory)
  const [selected, setSelected] = useState(null); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function enter(e) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try {
      const result = await login(selected.email, password)
      if (!result.ok) setError(ar ? 'كلمة المرور غير صحيحة أو البروفايل موقوف.' : 'Incorrect password or disabled profile.')
      else { setPassword(''); announceProfileSwitch(); navigate(selected.owner ? '/' : '/patients', { replace: true }) }
    } catch { setError(errorText(ar)) } finally { setBusy(false) }
  }
  return <main dir={ar ? 'rtl' : 'ltr'} className="flex min-h-screen items-center justify-center bg-[#f3f8f7] p-6">
    <div className="w-full max-w-3xl text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft"><Users size={26}/></div>
      <p className="mb-2 text-sm font-semibold text-brand-700">{directory?.name || 'DentalCloud'}</p>
      <h1 className="text-3xl font-extrabold text-ink-900">{ar ? 'مين معنا اليوم؟' : 'Who’s working today?'}</h1>
      <p className="mt-3 text-sm text-ink-500">{ar ? 'مساحة لكل شخص، ومواعيد تجمع العيادة.' : 'Your own workspace. One shared clinic calendar.'}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-5">
        {directory?.profiles.map(p => <button key={p.id} onClick={() => { setSelected(p); setPassword(''); setError('') }} className="group flex w-40 flex-col items-center gap-4 rounded-3xl border border-ink-100 bg-white px-4 py-7 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
          <Avatar name={p.name} size={68}/><span className="font-bold text-ink-800">{p.name}</span>
          <span className="flex items-center gap-1 text-xs text-ink-400">{p.owner ? <ShieldCheck size={13}/> : <LockKeyhole size={13}/>}{p.owner ? (ar ? 'صاحب العيادة' : 'Clinic owner') : (ar ? 'فريق العيادة' : 'Clinic team')}</span>
        </button>)}
      </div>
      {!directory && <p className="mt-8 text-ink-500">{ar ? 'يسجّل صاحب العيادة دخوله أولًا لتجهيز البروفايلات على هذا الجهاز.' : 'The clinic owner can sign in to set up profiles on this device.'}</p>}
      <button className="btn-ghost mt-8" onClick={() => navigate('/login')}>{ar ? 'تسجيل الدخول بحساب آخر' : 'Sign in with another account'}<ArrowRight size={15}/></button>
      {directory && <button className="mx-auto mt-3 block text-xs text-ink-400" onClick={() => { forgetProfiles(); setDirectory(null) }}>{ar ? 'إزالة أسماء العيادة من هذا الجهاز' : 'Remove this clinic’s names from this device'}</button>}
    </div>
    <Modal open={Boolean(selected)} onClose={() => { if (!busy) { setSelected(null); setPassword('') } }} title={selected?.name || ''} size="sm">
      <form onSubmit={enter} className="space-y-4">
        <p className="text-sm text-ink-500">{selected?.owner ? (ar ? 'أدخل كلمة مرور حساب صاحب العيادة.' : 'Enter the clinic owner’s account password.') : (ar ? 'أدخل كلمة مرور بروفايلك.' : 'Enter your profile password.')}</p>
        <input autoFocus type="password" autoComplete="current-password" className="input" value={password} onChange={e => setPassword(e.target.value)} aria-label={ar ? 'كلمة المرور' : 'Password'} required/>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button disabled={busy || !password} className="btn-primary w-full">{busy ? '…' : ar ? 'دخول' : 'Enter'}</button>
      </form>
    </Modal>
  </main>
}

export default function ClinicProfiles() {
  const { clinic, currentUser, refreshClinic, doctors, demoMode, readOnly } = useStore(); const { lang } = useI18n(); const ar = lang === 'ar'
  const [profiles, setProfiles] = useState([]); const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  async function refresh() {
    const data = await manageProfiles({ action: 'list' })
    const rows = data.profiles.map(p => p.owner ? { ...p, email: currentUser.email } : p)
    setProfiles(rows); rememberProfiles(clinic, rows)
  }
  useEffect(() => { if (demoMode) { setProfiles(doctors.map(d => ({ ...d, active:true, owner:d.id===currentUser.id }))); return } refresh().catch(() => setError(errorText(ar))) }, [])
  async function save(e) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await manageProfiles(form)
      await refresh(); await refreshClinic(); setForm(null)
      setNotice(ar ? 'تم حفظ البروفايل. كلمة المرور لا تظهر مرة أخرى؛ شاركها مع صاحبها مباشرة.' : 'Profile saved. Passwords are never displayed again; share it directly with its owner.')
    } catch { setError(errorText(ar)) } finally { setBusy(false) }
  }
  async function toggle(p) {
    if (busy) return; setBusy(true); setError('')
    try { await manageProfiles({ action: 'active', id: p.id, active: !p.active }); await refresh() }
    catch { setError(errorText(ar)) } finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-ink-900">{ar ? 'بروفايلات العيادة' : 'Clinic profiles'}</h2><p className="mt-2 text-sm text-ink-500">{ar ? 'التقويم مشترك. حساب المريض يظهر للطبيب المسؤول وصاحب العيادة فقط.' : 'Shared calendar. Patient finances are visible only to the assigned clinician and clinic owner.'}</p></div><button disabled={demoMode || readOnly} onClick={() => { setError(''); setForm({ action: 'create', name: '', password: '', role: 'doctor' }) }} className="btn-primary"><Plus size={16}/>{ar ? 'إضافة بروفايل' : 'Add profile'}</button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{notice}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{profiles.map(p => <div key={p.id} className="card p-5"><div className="flex items-center gap-3"><Avatar name={p.name} size={48}/><div><p className="font-bold">{p.name}</p><p className="mt-1 text-xs text-ink-400">{p.owner ? (ar ? 'صاحب العيادة · جميع الصلاحيات' : 'Owner · full access') : p.active ? (ar ? 'مفعّل · صلاحيات الفريق' : 'Active · team access') : (ar ? 'موقوف' : 'Disabled')}</p></div></div>{p.owner ? <p className="mt-4 text-xs text-ink-500">{ar ? 'محمي بكلمة مرور حسابك الحالية.' : 'Protected by your existing account password.'}</p> : <div className="mt-5 flex flex-wrap gap-2"><button disabled={demoMode} className="btn-outline !px-3 !py-2 text-xs" onClick={() => { setError(''); setForm({ action: 'update', id: p.id, name: p.name, specialty: p.specialty }) }}>{ar ? 'تعديل' : 'Edit'}</button><button disabled={demoMode} className="btn-outline !px-3 !py-2 text-xs" onClick={() => { setError(''); setForm({ action: 'password', id: p.id, password: '' }) }}>{ar ? 'كلمة المرور' : 'Password'}</button><button disabled={busy || demoMode} className="btn-ghost !px-3 !py-2 text-xs" onClick={() => toggle(p)}>{p.active ? (ar ? 'إيقاف' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}</button></div>}</div>)}</div>
    <p className="text-xs leading-6 text-ink-500">{ar ? 'تعيين المريض يتم من ملفه. الملفات القديمة تبقى عند الشخص الذي أضافها إلى أن تغيّر التعيين. افتح حساب صاحب العيادة على جهاز الفريق مرة واحدة، ثم اضغط «قفل وتبديل البروفايل».' : 'Assign patients from their files. Existing records stay with their creator until reassigned. On a team device, sign in as the owner once, then use “Lock & switch profile”.'}</p>
    <Modal open={Boolean(form)} onClose={() => { if (!busy) setForm(null) }} title={ar ? 'إعداد البروفايل' : 'Profile settings'} size="sm">
      {form && <form onSubmit={save} className="space-y-4">
        {form.action !== 'password' && <Field label={ar ? 'الاسم' : 'Name'}><input autoFocus className="input" maxLength={80} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></Field>}
        {form.action === 'create' && <Field label={ar ? 'الصفة' : 'Role'}><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="doctor">{ar ? 'طبيب' : 'Doctor'}</option><option value="assistant">{ar ? 'مساعد' : 'Assistant'}</option></select></Field>}
        {form.action !== 'update' && <Field label={ar ? 'كلمة المرور · 10 أحرف على الأقل' : 'Password · at least 10 characters'}><input className="input" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/></Field>}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? '…' : ar ? 'حفظ' : 'Save'}</button>
      </form>}
    </Modal>
  </div>
}

export function PatientAssignment({ patient }) {
  const { doctors, currentUser, retryLoad } = useStore(); const { lang } = useI18n(); const ar = lang === 'ar'
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  if (currentUser?.staffProfile) return null
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><label htmlFor="patient-assignment" className="text-ink-500">{ar ? 'الطبيب المسؤول' : 'Assigned clinician'}</label><select id="patient-assignment" className="rounded-lg border border-ink-100 bg-white px-2 py-1.5" disabled={busy} value={patient.assignedDoctorId || patient.createdBy || ''} onChange={async e => {
    setBusy(true); setError('')
    try { await profileRPC('clinic_profile_assign', { p_patient: patient.id, p_doctor: e.target.value }); await retryLoad() }
    catch { setError(errorText(ar)) } finally { setBusy(false) }
  }}><option value="" disabled>{ar ? 'اختر الطبيب' : 'Choose clinician'}</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.nameAr || d.name}</option>)}</select>{error && <span role="alert" className="text-rose-600">{error}</span>}</div>
}
