import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Printer, Stethoscope, Layers, Eye, Wrench } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { chartRows, getTooth, SURFACE_KEYS, SURFACES, toothLabel, bilingual, NUMBERING_SYSTEMS } from '../../lib/teeth'
import {
  DENTAL_ITEMS, CONDITION_KEYS, TREATMENT_KEYS, CARIES_CLASSES, instructionKeyFor,
  recordName, recordColor,
} from '../../lib/treatments'
import { Modal, Field, Segmented, Badge } from '../ui'
import Tooth from './Tooth'
import InstructionsModal from '../InstructionsModal'
import { fmtDate } from '../../lib/dates'
import { money, cx } from '../../lib/utils'

function computeDisplay(records, viewMode) {
  const relevant = records
    .filter((r) => r.kind === viewMode)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const surfaceColors = {}
  let wholeColor = null, wholeStatus = null, missing = false
  const symbols = []
  for (const r of relevant) {
    const item = DENTAL_ITEMS[r.itemKey]
    if (!item) {
      // custom "Other" entry → small neutral mark
      if (r.label) symbols.push({ symbol: '•', color: '#64748b' })
      continue
    }
    if (item.scope === 'surface') {
      for (const s of r.surfaces || []) surfaceColors[s] = { color: item.color, status: r.status }
    } else if (item.scope === 'tooth') {
      wholeColor = item.color; wholeStatus = r.status
      if (r.itemKey === 'missing') missing = true
      if (item.symbol) symbols.unshift({ symbol: item.symbol, color: item.color })
    } else if (item.scope === 'mark') {
      symbols.push({ symbol: item.symbol, color: item.color })
    }
  }
  return { surfaceColors, wholeColor, wholeStatus, missing, symbols }
}

export default function DentalChart({ patient }) {
  const { t, lang } = useI18n()
  const { recordsForPatient, clinic, updateClinic } = useStore()
  const [dentition, setDentition] = useState('permanent')
  const [viewMode, setViewMode] = useState('condition')
  const [selected, setSelected] = useState(null)
  const numbering = clinic?.settings?.numbering || 'fdi'
  const setNumbering = (v) => updateClinic({ settings: { ...clinic.settings, numbering: v } })

  const allRecords = recordsForPatient(patient.id)
  const rows = chartRows(dentition)

  const displayByTooth = useMemo(() => {
    const map = {}
    const teeth = [...rows.upper.right, ...rows.upper.left, ...rows.lower.right, ...rows.lower.left]
    for (const tt of teeth) {
      const recs = allRecords.filter((r) => r.toothId === tt.id)
      map[tt.id] = computeDisplay(recs, viewMode)
    }
    return map
  }, [allRecords, rows, viewMode])

  const Arch = ({ side }) => {
    const r = side === 'upper' ? rows.upper : rows.lower
    return (
      <div className="flex items-center justify-center gap-3">
        <div className="flex gap-1">
          {r.right.map((tt) => (
            <Tooth key={tt.id} tooth={tt} label={toothLabel(tt, numbering)} display={displayByTooth[tt.id]} selected={selected === tt.id} onClick={() => setSelected(tt.id)} />
          ))}
        </div>
        <div className="mx-1 h-12 w-px bg-ink-200" />
        <div className="flex gap-1">
          {r.left.map((tt) => (
            <Tooth key={tt.id} tooth={tt} label={toothLabel(tt, numbering)} display={displayByTooth[tt.id]} selected={selected === tt.id} onClick={() => setSelected(tt.id)} />
          ))}
        </div>
      </div>
    )
  }

  const legendItems = viewMode === 'condition' ? CONDITION_KEYS : TREATMENT_KEYS

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={dentition}
            onChange={(v) => { setDentition(v); setSelected(null) }}
            options={[
              { value: 'permanent', label: t('chart.permanent'), icon: <Layers size={14} /> },
              { value: 'primary', label: t('chart.primary'), icon: <Stethoscope size={14} /> },
            ]}
          />
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'condition', label: t('chart.currentState'), icon: <Eye size={14} /> },
              { value: 'treatment', label: t('chart.completedTreatment'), icon: <Wrench size={14} /> },
            ]}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink-400">{lang === 'ar' ? 'نظام الترقيم' : 'Numbering'}:</span>
          <Segmented size="sm" value={numbering} onChange={setNumbering}
            options={Object.entries(NUMBERING_SYSTEMS).map(([k, v]) => ({ value: k, label: v[lang] }))} />
        </div>

        {/* The chart itself — forced LTR so the arch is anatomically standard */}
        <div dir="ltr" className="space-y-4 overflow-x-auto rounded-xl bg-gradient-to-b from-ink-50/60 to-white p-4">
          <div className="min-w-max">
            <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-400">{t('chart.upper')}</p>
            <Arch side="upper" />
            <div className="my-3 h-px bg-ink-200" />
            <Arch side="lower" />
            <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-400">{t('chart.lower')}</p>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-ink-400">{t('chart.clickTooth')}</p>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <p className="mb-2 text-xs font-bold text-ink-500">{t('chart.legend')} — {viewMode === 'condition' ? t('chart.condition') : t('chart.treatment')}</p>
        <div className="flex flex-wrap gap-2">
          {legendItems.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-600">
              <span className="h-3 w-3 rounded" style={{ background: DENTAL_ITEMS[k].color }} />
              {bilingual(DENTAL_ITEMS[k], lang)}
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <ToothModal
          patient={patient}
          toothId={selected}
          dentition={dentition}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function ToothModal({ patient, toothId, dentition, onClose }) {
  const { t, lang } = useI18n()
  const { recordsForPatient, addToothRecord, deleteToothRecord, doctors, getDoctor, can, clinic, currentUser } = useStore()
  const tooth = getTooth(toothId)
  const currency = clinic?.settings?.currency || 'JOD'
  const numbering = clinic?.settings?.numbering || 'fdi'
  const records = recordsForPatient(patient.id)
    .filter((r) => r.toothId === toothId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const customInputRef = useRef(null)
  const [itemKey, setItemKey] = useState('caries')
  const [customLabel, setCustomLabel] = useState('')
  const [surfaces, setSurfaces] = useState([])
  const [cariesClass, setCariesClass] = useState('')
  const [status, setStatus] = useState('done')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [doctorId, setDoctorId] = useState(currentUser?.id)
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [instrFor, setInstrFor] = useState(null)

  const customPrices = (clinic?.prices || []).filter((p) => p.key.startsWith('custom_'))
  const isOther = itemKey === 'otherCondition' || itemKey === 'otherTreatment'
  const isCustomPrice = customPrices.some((p) => p.key === itemKey)
  const item = DENTAL_ITEMS[itemKey]
  const needsSurfaces = item?.scope === 'surface'
  const isTreatment = isCustomPrice ? true : isOther ? itemKey === 'otherTreatment' : item?.kind === 'treatment'

  function pickItem(k) {
    setItemKey(k)
    const it = DENTAL_ITEMS[k]
    if (it.kind === 'treatment') {
      const pr = (clinic?.prices || []).find((p) => p.key === k)
      setPrice(pr ? String(pr.price) : '')
    } else setPrice('')
    if (it.scope !== 'surface') { setSurfaces([]); setCariesClass('') }
  }
  function pickCustomPrice(priceItem) {
    setItemKey(priceItem.key)
    setPrice(String(priceItem.price || ''))
    setSurfaces([]); setCariesClass(''); setCustomLabel('')
  }
  function pickOther(kind) {
    setItemKey(kind === 'treatment' ? 'otherTreatment' : 'otherCondition')
    setSurfaces([]); setCariesClass(''); setPrice('')
  }

  function applyClass(cls) {
    setCariesClass(cls)
    setSurfaces(CARIES_CLASSES[cls]?.surfaces || [])
  }
  function toggleSurface(s) {
    setSurfaces((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]))
    setCariesClass('')
  }

  function save() {
    if (isCustomPrice) {
      const priceItem = customPrices.find((p) => p.key === itemKey)
      if (!priceItem) return
      addToothRecord({
        patientId: patient.id, toothId, dentition,
        itemKey: 'other', kind: 'treatment',
        label: { en: priceItem.en || priceItem.ar, ar: priceItem.ar || priceItem.en },
        surfaces: [], status, date: new Date(date).toISOString(),
        doctorId, price: Number(price) || 0, notes,
      })
      setNotes(''); setSurfaces([]); setCariesClass(''); setCustomLabel(''); setPrice('')
      return
    }
    if (isOther) {
      if (!customLabel.trim()) return
      const kind = itemKey === 'otherTreatment' ? 'treatment' : 'condition'
      addToothRecord({
        patientId: patient.id, toothId, dentition,
        itemKey: 'other', kind, label: { en: customLabel, ar: customLabel },
        surfaces: [], status, date: new Date(date).toISOString(),
        doctorId, price: kind === 'treatment' ? Number(price) || 0 : 0, notes,
      })
      setCustomLabel('')
      setTimeout(() => customInputRef.current?.focus(), 30)
      return
    } else {
      addToothRecord({
        patientId: patient.id, toothId, dentition,
        itemKey, kind: item.kind, surfaces: needsSurfaces ? surfaces : [],
        cariesClass: cariesClass || undefined, status, date: new Date(date).toISOString(),
        doctorId, price: item.kind === 'treatment' ? Number(price) || 0 : 0, notes,
      })
    }
    setNotes(''); setSurfaces([]); setCariesClass(''); setCustomLabel('')
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${t('chart.tooth')} ${toothLabel(tooth, numbering)} — ${bilingual(tooth?.names, lang)}`}
      icon={<span className="text-lg">🦷</span>}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* History */}
        <div>
          <p className="mb-2 text-xs font-bold text-ink-500">{t('chart.toothHistory')}</p>
          <div className="max-h-72 space-y-2 overflow-y-auto pe-1">
            {records.length === 0 ? (
              <p className="rounded-xl bg-ink-50 px-3 py-6 text-center text-sm text-ink-400">{t('chart.noEntries')}</p>
            ) : records.map((r) => {
              const doc = getDoctor(r.doctorId)
              return (
                <div key={r.id} className="rounded-xl border border-ink-100 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: recordColor(r) }} />
                    <span className="flex-1 text-sm font-bold text-ink-800">{recordName(r, lang)}</span>
                    <Badge color={r.status === 'done' ? 'green' : 'amber'}>{r.status === 'done' ? t('chart.done') : t('chart.planned')}</Badge>
                    <button onClick={() => deleteToothRecord(r.id)} className="text-ink-300 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-400">
                    <span>{fmtDate(r.date, lang)}</span>
                    {r.surfaces?.length > 0 && <span>{r.surfaces.map((s) => SURFACES[s].short).join('')}</span>}
                    {r.cariesClass && <span>Class {r.cariesClass}</span>}
                    {doc && <span className="flex items-center gap-1">• {(lang === 'ar' ? doc.nameAr : doc.name)}</span>}
                    {r.price > 0 && <span className="font-semibold text-ink-500">{money(r.price, currency)}</span>}
                  </div>
                  {r.notes && <p className="mt-1 text-xs text-ink-500">{r.notes}</p>}
                  {r.kind === 'treatment' && can('instructions') && (
                    <button onClick={() => setInstrFor(r.itemKey)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
                      <Printer size={12} /> {t('instructions.title')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Add form */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-ink-500">{t('chart.addEntry')}</p>

          <div>
            <p className="label">{t('chart.condition')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CONDITION_KEYS.map((k) => (
                <ItemChip key={k} k={k} active={itemKey === k} onClick={() => pickItem(k)} lang={lang} />
              ))}
              <OtherChip active={itemKey === 'otherCondition'} onClick={() => pickOther('condition')} lang={lang} />
            </div>
          </div>
          <div>
            <p className="label">{t('chart.treatment')}</p>
            <div className="flex flex-wrap gap-1.5">
              {TREATMENT_KEYS.map((k) => (
                <ItemChip key={k} k={k} active={itemKey === k} onClick={() => pickItem(k)} lang={lang} />
              ))}
              {customPrices.map((p) => (
                <button key={p.key} onClick={() => pickCustomPrice(p)}
                  className={cx('inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all',
                    itemKey === p.key ? 'border-violet-400 bg-violet-50 text-violet-700 ring-2 ring-violet-400/20' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300')}>
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
                  {lang === 'ar' ? (p.ar || p.en) : (p.en || p.ar)}
                </button>
              ))}
              <OtherChip active={itemKey === 'otherTreatment'} onClick={() => pickOther('treatment')} lang={lang} />
            </div>
          </div>

          {isOther && (
            <Field label={lang === 'ar' ? 'اسم آخر — اكتبه واضغط Enter أو ＋' : 'Custom name — type and press Enter or ＋'}>
              <div className="flex gap-2">
                <input
                  ref={customInputRef}
                  className="input"
                  value={customLabel}
                  autoFocus
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
                  placeholder={lang === 'ar' ? 'اكتب الاسم واضغط Enter…' : 'Type a name and press Enter…'}
                />
                <button type="button" onClick={save} disabled={!customLabel.trim()}
                  className="btn-primary shrink-0 !px-3.5" title={lang === 'ar' ? 'إضافة' : 'Add'}>
                  <Plus size={18} />
                </button>
              </div>
            </Field>
          )}

          {needsSurfaces && (
            <div className="space-y-2 rounded-xl bg-ink-50 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-ink-500">{t('chart.surfaces')}:</span>
                {SURFACE_KEYS.map((s) => (
                  <button key={s} onClick={() => toggleSurface(s)}
                    className={cx('h-7 w-7 rounded-lg text-xs font-bold transition-colors',
                      surfaces.includes(s) ? 'bg-brand-500 text-white' : 'bg-white text-ink-500 hover:bg-ink-100')}>
                    {SURFACES[s].short}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-ink-500">{t('chart.cariesClass')}:</span>
                {Object.keys(CARIES_CLASSES).map((c) => (
                  <button key={c} onClick={() => applyClass(c)}
                    className={cx('rounded-lg px-2 py-1 text-xs font-bold transition-colors',
                      cariesClass === c ? 'bg-brand-500 text-white' : 'bg-white text-ink-500 hover:bg-ink-100')}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('common.status')}>
              <Segmented size="sm" value={status} onChange={setStatus}
                options={[{ value: 'done', label: t('chart.done') }, { value: 'planned', label: t('chart.planned') }]} />
            </Field>
            <Field label={t('common.date')}>
              <input type="date" className="input !py-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {can('multiDoctor') && (
              <Field label={t('appt.doctor')}>
                <select className="input !py-1.5" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{lang === 'ar' ? d.nameAr : d.name}</option>)}
                </select>
              </Field>
            )}
            {isTreatment && (
              <Field label={`${t('chart.price')} (${currency})`}>
                <input type="number" className="input !py-1.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
              </Field>
            )}
          </div>

          <Field label={t('common.notes')}>
            <input className="input !py-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <button onClick={save} className="btn-primary w-full"><Plus size={16} /> {t('chart.saveRecord')}</button>
        </div>
      </div>

      {instrFor && (
        <InstructionsModal patient={patient} treatmentKey={instrFor} onClose={() => setInstrFor(null)} />
      )}
    </Modal>
  )
}

function ItemChip({ k, active, onClick, lang }) {
  const it = DENTAL_ITEMS[k]
  return (
    <button onClick={onClick}
      className={cx('inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all',
        active ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-400/20' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300')}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
      {bilingual(it, lang)}
    </button>
  )
}

function OtherChip({ active, onClick, lang }) {
  return (
    <button onClick={onClick}
      className={cx('inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1 text-xs font-semibold transition-all',
        active ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-400/20' : 'border-ink-300 bg-white text-ink-500 hover:border-ink-400')}>
      <Plus size={11} /> {lang === 'ar' ? 'أخرى' : 'Other'}
    </button>
  )
}
