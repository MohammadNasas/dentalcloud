import { Stethoscope, HeartPulse, Pill, AlertTriangle, ClipboardCheck, Info } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import {
  DENTAL_HISTORY, MEDICAL_HISTORY, SOCIAL_HISTORY, SYSTEMS_HISTORY,
  ALLERGIES, MEDICATIONS, CLINICAL_EXAM, DENTAL_CONSIDERATIONS,
} from '../../lib/history'
import { Toggle } from '../ui'
import { cx } from '../../lib/utils'

export default function HistoryForm({ patient }) {
  const { t, lang, L } = useI18n()
  const { updatePatient } = useStore()

  const h = patient.history || { dental: {}, medical: {}, social: {}, systems: {}, allergies: [], medications: [] }
  const exam = patient.exam || {}

  const writeHistory = (next) => updatePatient(patient.id, { history: { ...h, ...next } })
  const setField = (sec, field, val) => writeHistory({ [sec]: { ...(h[sec] || {}), [field]: val } })
  const toggleSystem = (gid, key) => {
    const cur = h.systems?.[gid] || []
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    writeHistory({ systems: { ...(h.systems || {}), [gid]: next } })
  }
  const toggleArr = (field, key) => {
    const cur = h[field] || []
    writeHistory({ [field]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] })
  }
  const setExam = (sec, val) => updatePatient(patient.id, { exam: { ...exam, [sec]: val } })
  const toggleExamCheck = (sec, key) => {
    const cur = Array.isArray(exam[sec]) ? exam[sec] : []
    setExam(sec, cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
  }
  const setConsiderationNote = (key, val) =>
    writeHistory({ considerationNotes: { ...(h.considerationNotes || {}), [key]: val } })

  // Selected conditions that have dental considerations (deduplicated)
  const allDiseaseOpts = SYSTEMS_HISTORY.groups.flatMap((g) => g.options)
  const labelFor = (key) =>
    key === 'pregnancy' ? (lang === 'ar' ? 'الحمل' : 'Pregnancy')
      : L(allDiseaseOpts.find((o) => o.key === key) || { en: key, ar: key })
  const selectedConsiderations = [
    ...Object.values(h.systems || {}).flat(),
    ...(h.medical?.pregnant ? ['pregnancy'] : []),
  ].filter((k, i, arr) => arr.indexOf(k) === i && DENTAL_CONSIDERATIONS[k])

  function FieldsSection({ schema, icon }) {
    return (
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-800">{icon} {L(schema.title)}</h3>
        <div className="space-y-1">
          {schema.fields.map((f) => {
            const val = h[schema.id]?.[f.id]
            if (f.type === 'toggle') {
              return (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-ink-50/60">
                  <span className="text-sm font-medium text-ink-700">{L(f)}</span>
                  <Toggle checked={!!val} onChange={(v) => setField(schema.id, f.id, v)} />
                </div>
              )
            }
            if (f.type === 'checks') {
              return (
                <div key={f.id} className="px-2 py-2">
                  <p className="mb-1.5 text-sm font-medium text-ink-700">{L(f)}</p>
                  <Chips options={f.options} selected={Array.isArray(val) ? val : []} onToggle={(k) => {
                    const cur = Array.isArray(val) ? val : []
                    setField(schema.id, f.id, cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])
                  }} />
                </div>
              )
            }
            return (
              <div key={f.id} className="px-2 py-2">
                <p className="mb-1.5 text-sm font-medium text-ink-700">{L(f)}</p>
                <input className="input" value={val || ''} onChange={(e) => setField(schema.id, f.id, e.target.value)} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <FieldsSection schema={DENTAL_HISTORY} icon={<Stethoscope size={18} className="text-brand-500" />} />
      <FieldsSection schema={MEDICAL_HISTORY} icon={<HeartPulse size={18} className="text-rose-500" />} />

      {/* Systemic review */}
      <div className="card p-5 lg:col-span-2">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-800"><HeartPulse size={18} className="text-rose-500" /> {L(SYSTEMS_HISTORY.title)}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEMS_HISTORY.groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-ink-100 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{L(g)}</p>
              <Chips options={g.options} selected={h.systems?.[g.id] || []} onToggle={(k) => toggleSystem(g.id, k)} />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <p className="label">{lang === 'ar' ? 'أمراض أخرى (اكتبها)' : 'Other conditions'}</p>
          <input className="input" value={h.systemsOther || ''} onChange={(e) => writeHistory({ systemsOther: e.target.value })}
            placeholder={lang === 'ar' ? 'اكتب أي مرض غير موجود بالقائمة…' : 'Type any condition not listed…'} />
        </div>
      </div>

      {/* Dental considerations for selected conditions */}
      {selectedConsiderations.length > 0 && (
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-800"><Info size={18} className="text-blue-500" /> {lang === 'ar' ? 'اعتبارات سنّية للحالات المختارة' : 'Dental considerations'}</h3>
          <div className="space-y-3">
            {selectedConsiderations.map((key) => (
              <div key={key} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <p className="mb-1.5 font-bold text-ink-800">{labelFor(key)}</p>
                <ul className="mb-2 space-y-1">
                  {L(DENTAL_CONSIDERATIONS[key]).map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />{pt}
                    </li>
                  ))}
                </ul>
                <input className="input !py-1.5 text-sm" value={h.considerationNotes?.[key] || ''}
                  onChange={(e) => setConsiderationNote(key, e.target.value)}
                  placeholder={lang === 'ar' ? 'ملاحظتك الخاصة…' : 'Your own note…'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Allergies + medications */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-800"><AlertTriangle size={18} className="text-amber-500" /> {L(ALLERGIES.title)}</h3>
        <Chips options={ALLERGIES.options} selected={h.allergies || []} onToggle={(k) => toggleArr('allergies', k)} danger />
        {(h.allergies || []).includes('other') && (
          <input className="input mt-3" value={h.allergiesOther || ''} onChange={(e) => writeHistory({ allergiesOther: e.target.value })}
            placeholder={lang === 'ar' ? 'حدّد نوع الحساسية…' : 'Specify the allergy…'} />
        )}
      </div>
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-800"><Pill size={18} className="text-brand-500" /> {L(MEDICATIONS.title)}</h3>
        <Chips options={MEDICATIONS.options} selected={h.medications || []} onToggle={(k) => toggleArr('medications', k)} />
        <input className="input mt-3" value={h.medicationsOther || ''} onChange={(e) => writeHistory({ medicationsOther: e.target.value })}
          placeholder={lang === 'ar' ? 'اكتب أسماء الأدوية…' : 'Type medication names…'} />
      </div>

      {/* Social */}
      <FieldsSection schema={SOCIAL_HISTORY} icon={<ClipboardCheck size={18} className="text-ink-500" />} />

      {/* Clinical exam */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-800"><ClipboardCheck size={18} className="text-brand-500" /> {L(CLINICAL_EXAM.title)}</h3>
        <div className="space-y-3">
          {CLINICAL_EXAM.sections.map((s) => (
            <div key={s.id}>
              <p className="mb-1.5 text-sm font-medium text-ink-700">{L(s)}</p>
              {s.type === 'checks'
                ? <Chips options={s.options} selected={Array.isArray(exam[s.id]) ? exam[s.id] : []} onToggle={(k) => toggleExamCheck(s.id, k)} />
                : <input className="input" value={exam[s.id] || ''} onChange={(e) => setExam(s.id, e.target.value)} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  function Chips({ options, selected, onToggle, danger }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.key)
          return (
            <button key={o.key} onClick={() => onToggle(o.key)}
              className={cx('rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all',
                on ? (danger ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-brand-300 bg-brand-50 text-brand-700')
                   : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300')}>
              {L(o)}
            </button>
          )
        })}
      </div>
    )
  }
}
