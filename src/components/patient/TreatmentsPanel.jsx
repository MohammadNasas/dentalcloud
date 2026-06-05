import { useState } from 'react'
import { Plus, Trash2, Printer, CheckCircle2, Clock, Stethoscope } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { DENTAL_ITEMS, recordName, recordColor } from '../../lib/treatments'
import { getTooth, PERMANENT_TEETH, PRIMARY_TEETH } from '../../lib/teeth'
import { Modal, Field, Segmented, Badge, EmptyState } from '../ui'
import InstructionsModal from '../InstructionsModal'
import { fmtDate } from '../../lib/dates'
import { money, cx } from '../../lib/utils'

export default function TreatmentsPanel({ patient }) {
  const { t, lang } = useI18n()
  const { recordsForPatient, updateToothRecord, deleteToothRecord, getDoctor, clinic, can } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const [instrFor, setInstrFor] = useState(null)
  const currency = clinic?.settings?.currency || 'JOD'

  const records = recordsForPatient(patient.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const done = records.filter((r) => r.status === 'done').length
  const planned = records.filter((r) => r.status === 'planned').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge color="green"><CheckCircle2 size={13} /> {done} {t('chart.done')}</Badge>
        <Badge color="amber"><Clock size={13} /> {planned} {t('chart.planned')}</Badge>
        <button onClick={() => setAddOpen(true)} className="btn-primary ms-auto"><Plus size={16} /> {t('patient.treatments')}</button>
      </div>

      <div className="card overflow-hidden">
        {records.length === 0 ? (
          <EmptyState icon={<Stethoscope size={26} />} title={t('chart.noEntries')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-start text-xs font-bold uppercase text-ink-400">
                  <th className="px-4 py-3 text-start">{t('common.date')}</th>
                  <th className="px-4 py-3 text-start">{t('chart.tooth')}</th>
                  <th className="px-4 py-3 text-start">{t('settings.treatment')}</th>
                  <th className="px-4 py-3 text-start">{t('common.status')}</th>
                  {can('multiDoctor') && <th className="px-4 py-3 text-start">{t('appt.doctor')}</th>}
                  <th className="px-4 py-3 text-start">{t('chart.price')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {records.map((r) => {
                  const doc = getDoctor(r.doctorId)
                  const tooth = r.toothId && r.toothId !== '0' ? getTooth(r.toothId) : null
                  return (
                    <tr key={r.id} className="hover:bg-ink-50/40">
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{fmtDate(r.date, lang)}</td>
                      <td className="px-4 py-2.5">{tooth ? <Badge color="ink">{tooth.label}</Badge> : <span className="text-ink-300">—</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 font-semibold text-ink-700">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: recordColor(r) }} />
                          {recordName(r, lang)}
                          {r.kind === 'condition' && <Badge color="rose">{t('chart.condition')}</Badge>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => updateToothRecord(r.id, { status: r.status === 'done' ? 'planned' : 'done' })}
                          className={cx('chip', r.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}
                        >
                          {r.status === 'done' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {r.status === 'done' ? t('chart.done') : t('chart.planned')}
                        </button>
                      </td>
                      {can('multiDoctor') && (
                        <td className="px-4 py-2.5">
                          {doc && <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: doc.color }}>
                            <span className="h-2 w-2 rounded-full" style={{ background: doc.color }} />{(lang === 'ar' ? doc.nameAr : doc.name)?.replace(/Dr\. |د\. /, '')}
                          </span>}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-ink-700">{r.price > 0 ? money(r.price, currency) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {r.kind === 'treatment' && can('instructions') && (
                            <button onClick={() => setInstrFor(r.itemKey)} title={t('instructions.title')} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Printer size={15} /></button>
                          )}
                          <button onClick={() => deleteToothRecord(r.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && <AddProcedureModal patient={patient} onClose={() => setAddOpen(false)} />}
      {instrFor && <InstructionsModal patient={patient} treatmentKey={instrFor} onClose={() => setInstrFor(null)} />}
    </div>
  )
}

function AddProcedureModal({ patient, onClose }) {
  const { t, lang } = useI18n()
  const { addToothRecord, clinic, doctors, currentUser, can } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'
  const catalog = clinic?.prices?.length ? clinic.prices : []

  const [priceKey, setPriceKey] = useState(catalog[0]?.key || 'composite')
  const [toothId, setToothId] = useState('0')
  const [dentition, setDentition] = useState('permanent')
  const [status, setStatus] = useState('done')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [doctorId, setDoctorId] = useState(currentUser?.id)
  const [price, setPrice] = useState(String(catalog[0]?.price ?? 0))
  const [notes, setNotes] = useState('')

  const teeth = dentition === 'permanent' ? PERMANENT_TEETH : PRIMARY_TEETH

  function pick(key) {
    setPriceKey(key)
    const item = catalog.find((c) => c.key === key)
    if (item) setPrice(String(item.price))
  }

  function save() {
    const item = catalog.find((c) => c.key === priceKey)
    // itemKey is a chartable key when possible, else keep catalog key + label
    const itemKey = DENTAL_ITEMS[priceKey] ? priceKey : (priceKey === 'surgical_ext' ? 'extraction' : priceKey)
    addToothRecord({
      patientId: patient.id, toothId, dentition,
      itemKey, kind: 'treatment',
      label: item ? { en: item.en, ar: item.ar } : undefined,
      surfaces: [], status, date: new Date(date).toISOString(),
      doctorId, price: Number(price) || 0, notes,
    })
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="md" title={t('patient.treatments')} icon={<Plus size={18} className="text-brand-500" />}
      footer={<><button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button><button onClick={save} className="btn-primary">{t('common.save')}</button></>}>
      <div className="space-y-3">
        <Field label={t('settings.treatment')}>
          <select className="input" value={priceKey} onChange={(e) => pick(e.target.value)}>
            {catalog.map((c) => <option key={c.key} value={c.key}>{lang === 'ar' ? c.ar : c.en}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('patient.chart')}>
            <Segmented size="sm" value={dentition} onChange={(v) => { setDentition(v); setToothId('0') }}
              options={[{ value: 'permanent', label: t('chart.permanent') }, { value: 'primary', label: t('chart.primary') }]} />
          </Field>
          <Field label={t('chart.tooth')}>
            <select className="input" value={toothId} onChange={(e) => setToothId(e.target.value)}>
              <option value="0">{lang === 'ar' ? 'عام / كامل الفم' : 'General / whole mouth'}</option>
              {teeth.map((tt) => <option key={tt.id} value={tt.id}>{tt.label} — {tt.names[lang]}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.status')}>
            <Segmented size="sm" value={status} onChange={setStatus}
              options={[{ value: 'done', label: t('chart.done') }, { value: 'planned', label: t('chart.planned') }]} />
          </Field>
          <Field label={t('common.date')}>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {can('multiDoctor') && (
            <Field label={t('appt.doctor')}>
              <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                {doctors.map((d) => <option key={d.id} value={d.id}>{lang === 'ar' ? d.nameAr : d.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={`${t('chart.price')} (${currency})`} hint={lang === 'ar' ? 'يمكن التعديل لمنح خصم' : 'editable for discount'}>
            <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>

        <Field label={t('common.notes')}>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
