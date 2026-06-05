import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, DollarSign, FileText, Lightbulb, Crown, Database,
  Plus, Trash2, Save, Globe, Check, UserCog, RotateCcw,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, DOCTOR_COLORS, tierPeriodLabel } from '../lib/db'
import { DEFAULT_PRICES, INSTRUCTIONS } from '../lib/treatments'
import FeatureLock from '../components/FeatureLock'
import { Modal, Field, Segmented, Avatar, Badge } from '../components/ui'
import { cx, CURRENCIES } from '../lib/utils'

const SECTIONS = [
  { id: 'clinic', icon: Building2, key: 'clinic' },
  { id: 'doctors', icon: Users, key: 'doctors' },
  { id: 'prices', icon: DollarSign, key: 'prices' },
  { id: 'suggestions', icon: Lightbulb, key: 'suggestions' },
  { id: 'plan', icon: Crown, key: 'yourPlan' },
]

export default function Settings() {
  const { t } = useI18n()
  const [section, setSection] = useState('clinic')

  return (
    <div className="space-y-5">
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={cx('flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all',
              section === s.id ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-500 hover:text-brand-600')}>
            <s.icon size={16} /> {t(`settings.${s.key}`)}
          </button>
        ))}
      </div>

      <div className="page-enter" key={section}>
        {section === 'clinic' && <ClinicSection />}
        {section === 'doctors' && <DoctorsSection />}
        {section === 'prices' && <PricesSection />}
        {section === 'suggestions' && <SuggestionsSection />}
        {section === 'plan' && <PlanSection />}
      </div>
    </div>
  )
}

function ClinicSection() {
  const { t, lang, setLang } = useI18n()
  const { clinic, updateClinic } = useStore()
  const [name, setName] = useState(clinic?.name || '')
  const [nameAr, setNameAr] = useState(clinic?.nameAr || '')
  const [currency, setCurrency] = useState(clinic?.settings?.currency || 'JOD')
  const [saved, setSaved] = useState(false)

  function save() {
    updateClinic({ name, nameAr, settings: { ...clinic.settings, currency } })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="card max-w-2xl p-6">
      <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-800"><Building2 size={20} className="text-brand-500" /> {t('settings.clinic')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t('settings.clinicName')} (EN)`}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={`${t('settings.clinicName')} (ع)`}><input className="input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} /></Field>
        <Field label={t('settings.currency')}>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>{code} — {lang === 'ar' ? c.ar : c.en} ({c.symbol})</option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.language')}>
          <Segmented value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        </Field>
      </div>
      <button onClick={save} className="btn-primary mt-5">{saved ? <><Check size={16} /> {t('common.saved')}</> : <><Save size={16} /> {t('common.save')}</>}</button>
    </div>
  )
}

function DoctorsSection() {
  const { t, lang } = useI18n()
  const { doctors, addUser, deleteUser, currentUser, can } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '', specialty: '', role: 'doctor', color: DOCTOR_COLORS[2] })
  const [error, setError] = useState('')

  const multiAllowed = can('multiDoctor')

  function submit() {
    setError('')
    if (!form.name || !form.username || !form.password) { setError(t('auth.fillAll')); return }
    const res = addUser(form)
    if (!res.ok) { setError(t(`auth.${res.error}`)); return }
    setOpen(false)
    setForm({ name: '', username: '', password: '', specialty: '', role: 'doctor', color: DOCTOR_COLORS[doctors.length + 1] || DOCTOR_COLORS[0] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-ink-800"><Users size={20} className="text-brand-500" /> {t('settings.doctors')}</h3>
        {multiAllowed ? (
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> {t('settings.addDoctor')}</button>
        ) : <FeatureLock feature="multiDoctor" soft />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {doctors.map((d) => (
          <div key={d.id} className="card flex items-center gap-3 p-4">
            <div className="relative">
              <Avatar name={d.name} size={48} />
              <span className="absolute bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white end-0" style={{ background: d.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-ink-800">{lang === 'ar' ? d.nameAr || d.name : d.name}</p>
              <p className="truncate text-xs text-ink-400">@{d.username} · {d.specialty}</p>
            </div>
            <Badge color={d.role === 'admin' ? 'brand' : 'ink'}>{t(`settings.${d.role}`)}</Badge>
            {!d.isOwner && d.id !== currentUser?.id && (
              <button onClick={() => deleteUser(d.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-400">{t('auth.anyDevice')}</p>

      <Modal open={open} onClose={() => setOpen(false)} size="md" title={t('settings.addDoctor')} icon={<UserCog size={18} className="text-brand-500" />}
        footer={<><button onClick={() => setOpen(false)} className="btn-ghost">{t('common.cancel')}</button><button onClick={submit} className="btn-primary">{t('common.save')}</button></>}>
        <div className="space-y-3">
          <Field label={t('auth.doctorName')} required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('settings.username')} required><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label={t('settings.password')} required><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          </div>
          <Field label={t('auth.specialty')}><input className="input" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('settings.role')}>
              <Segmented value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ value: 'doctor', label: t('settings.doctor') }, { value: 'admin', label: t('settings.admin') }]} />
            </Field>
            <Field label={t('settings.doctorColor')}>
              <div className="flex flex-wrap gap-1.5">
                {DOCTOR_COLORS.slice(0, 8).map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={cx('h-7 w-7 rounded-full transition-transform', form.color === c && 'ring-2 ring-offset-2 ring-ink-400 scale-110')} style={{ background: c }} />
                ))}
              </div>
            </Field>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
        </div>
      </Modal>
    </div>
  )
}

function PricesSection() {
  const { t, lang } = useI18n()
  const { clinic, updateClinic, can } = useStore()
  const [rows, setRows] = useState(clinic?.prices?.length ? clinic.prices : DEFAULT_PRICES.map((p) => ({ ...p })))
  const [saved, setSaved] = useState(false)
  const currency = clinic?.settings?.currency || 'JOD'

  if (!can('priceCatalog')) return <FeatureLock feature="priceCatalog" />

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows((rs) => [...rs, { key: 'custom_' + Date.now(), en: '', ar: '', price: 0 }])
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i))
  function save() { updateClinic({ prices: rows }); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  return (
    <div className="card max-w-3xl p-6">
      <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-800"><DollarSign size={20} className="text-brand-500" /> {t('settings.priceList')}</h3>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input flex-1" placeholder={lang === 'ar' ? r.en : r.ar} value={lang === 'ar' ? r.ar : r.en}
              onChange={(e) => setRow(i, lang === 'ar' ? { ar: e.target.value } : { en: e.target.value })} />
            <div className="relative w-32">
              <input type="number" className="input pe-12" value={r.price} onChange={(e) => setRow(i, { price: Number(e.target.value) })} />
              <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400 end-3">{currency}</span>
            </div>
            <button onClick={() => removeRow(i)} className="rounded-lg p-2 text-ink-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={addRow} className="btn-outline"><Plus size={16} /> {t('common.add')}</button>
        <button onClick={save} className="btn-primary">{saved ? <><Check size={16} /> {t('common.saved')}</> : <><Save size={16} /> {t('common.save')}</>}</button>
      </div>
    </div>
  )
}

function InstructionsSection() {
  const { t, lang } = useI18n()
  const { clinic, updateClinic, can } = useStore()
  const [editing, setEditing] = useState(null)

  if (!can('instructions')) return <FeatureLock feature="instructions" />

  const keys = Object.keys(INSTRUCTIONS)
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-bold text-ink-800"><FileText size={20} className="text-brand-500" /> {t('settings.instructions')}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((k) => {
          const custom = clinic?.customInstructions?.[k]?.[lang]
          const sheet = custom || INSTRUCTIONS[k][lang]
          return (
            <button key={k} onClick={() => setEditing(k)} className="card p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-soft">
              <p className="font-bold text-ink-800">{sheet.title}</p>
              <p className="mt-1 text-xs text-ink-400">{sheet.points.length} {lang === 'ar' ? 'بنود' : 'points'} {custom && <Badge color="brand">{lang === 'ar' ? 'مُعدّل' : 'edited'}</Badge>}</p>
            </button>
          )
        })}
      </div>
      {editing && <InstructionEditor instrKey={editing} onClose={() => setEditing(null)} />}
    </div>
  )

  function InstructionEditor({ instrKey, onClose }) {
    const custom = clinic?.customInstructions?.[instrKey]?.[lang]
    const base = custom || INSTRUCTIONS[instrKey][lang]
    const [title, setTitle] = useState(base.title)
    const [points, setPoints] = useState([...base.points])

    function save() {
      const ci = { ...(clinic.customInstructions || {}) }
      ci[instrKey] = { ...(ci[instrKey] || {}), [lang]: { title, points: points.filter((p) => p.trim()) } }
      updateClinic({ customInstructions: ci }); onClose()
    }

    return (
      <Modal open onClose={onClose} size="lg" title={t('settings.editInstructions')} icon={<FileText size={18} className="text-brand-500" />}
        footer={<><button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button><button onClick={save} className="btn-primary"><Save size={16} /> {t('common.save')}</button></>}>
        <input className="input mb-3 font-bold" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
              <textarea rows={1} className="input min-h-[40px] resize-none py-2 text-sm" value={p} onChange={(e) => setPoints((ps) => ps.map((x, idx) => idx === i ? e.target.value : x))} />
              <button onClick={() => setPoints((ps) => ps.filter((_, idx) => idx !== i))} className="mt-1.5 p-1.5 text-ink-300 hover:text-rose-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setPoints((p) => [...p, ''])} className="btn-ghost mt-2 text-brand-600"><Plus size={15} /> {t('instructions.addPoint')}</button>
      </Modal>
    )
  }
}

function SuggestionsSection() {
  const { t, lang } = useI18n()
  const { addSuggestion, suggestions } = useStore()
  const [text, setText] = useState('')
  const [thanks, setThanks] = useState(false)
  const mine = suggestions || []

  function send() {
    if (!text.trim()) return
    addSuggestion(text.trim()); setText(''); setThanks(true); setTimeout(() => setThanks(false), 2500)
  }

  return (
    <div className="card max-w-2xl p-6">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-ink-800"><Lightbulb size={20} className="text-amber-500" /> {t('settings.suggestions')}</h3>
      <p className="mb-4 text-sm text-ink-400">{lang === 'ar' ? 'فكرتك تساعدنا على تحسين التطبيق' : 'Your idea helps us improve the app'}</p>
      <textarea className="input min-h-[120px] resize-y" placeholder={t('settings.suggestionPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={send} className="btn-primary mt-3"><Lightbulb size={16} /> {t('settings.sendSuggestion')}</button>
      {thanks && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600">{t('settings.thanksSuggestion')}</p>}

      {mine.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-ink-100 pt-4">
          {mine.slice().reverse().map((s) => (
            <div key={s.id} className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{s.text}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanSection() {
  const { t, L } = useI18n()
  const navigate = useNavigate()
  const { clinic, resetToDemo, mode } = useStore()
  const tier = TIERS[clinic?.tier || 'student']

  return (
    <div className="space-y-4">
      <div className="card max-w-2xl p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink-800"><Crown size={20} className="text-amber-500" /> {t('settings.yourPlan')}</h3>
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-brand-50 to-brand-100/40 p-4">
          <div>
            <p className="text-2xl font-extrabold text-ink-800">{L(tier)}</p>
            <p className="text-sm text-ink-400">${tier.price} {tierPeriodLabel(tier, t)}</p>
          </div>
          <button onClick={() => navigate('/packages')} className="btn-primary"><Crown size={16} /> {t('packages.title')}</button>
        </div>
      </div>

      {mode === 'local' && (
        <div className="card max-w-2xl p-6">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-ink-800"><Database size={20} className="text-ink-500" /> {t('settings.data')}</h3>
          <p className="mb-4 text-sm text-ink-400">{t('settings.resetConfirm')}</p>
          <button onClick={() => { if (confirm(t('settings.resetConfirm'))) resetToDemo() }} className="btn-outline text-rose-500"><RotateCcw size={16} /> {t('settings.resetDemo')}</button>
        </div>
      )}
    </div>
  )
}
