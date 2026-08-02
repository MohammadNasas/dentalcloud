import { useState } from 'react'
import { FileText, Plus, Printer, Pencil, Trash2, Save, Lock, Phone } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { INSTRUCTIONS } from '../lib/treatments'
import { genId } from '../lib/db'
import { Modal, Field, Badge } from '../components/ui'
import PageHero from '../components/PageHero'
import FeatureLock from '../components/FeatureLock'
import { cx, waLink, waNumber, buildInstructionWhatsAppMessage } from '../lib/utils'
import { printSheet, escapeHtml } from '../lib/print'
import WhatsAppIcon from '../components/WhatsAppIcon'

// On the free Student plan only these 3 sheets are open; the rest are locked.
const FREE_SHEETS = ['extraction', 'rct', 'scaling']

export default function Instructions() {
  const { t, lang } = useI18n()
  const { clinic, updateClinic, can, patients, updatePatient } = useStore()
  const fullInstr = can('instructionsFull')
  const [editing, setEditing] = useState(null)
  const [sendingSheet, setSendingSheet] = useState(null)
  const customSheets = clinic?.customSheets || []
  const defaultKeys = Object.keys(INSTRUCTIONS)
  const clinicName = lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name

  function doPrint(title, points) {
    printSheet({
      title, lang, clinicName, subtitle: t('instructions.title'),
      bodyHtml: `<h1>${escapeHtml(title)}</h1><ul>${points.filter((p) => p.trim()).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`,
    })
  }
  const defaultSheet = (key) => clinic?.customInstructions?.[key]?.[lang] || INSTRUCTIONS[key][lang]
  function deleteCustom(id) {
    if (confirm(t('common.delete') + '?')) updateClinic({ customSheets: customSheets.filter((s) => s.id !== id) })
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={<FileText size={22} />}
        title={t('nav.instructions')}
        subtitle={lang === 'ar' ? 'أوراق جاهزة قابلة للتعديل والطباعة، مع إضافة أوراقك الخاصة.' : 'Ready, editable & printable sheets — plus add your own.'}
        actions={fullInstr ? <button onClick={() => setEditing({ type: 'custom', id: null })} className="btn bg-white font-bold text-brand-700 hover:bg-white/90"><Plus size={16} /> {lang === 'ar' ? 'إضافة ورقة' : 'Add sheet'}</button> : undefined}
      />

      {/* Custom sheets */}
      {customSheets.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{lang === 'ar' ? 'أوراقك الخاصة' : 'Your sheets'}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customSheets.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start gap-2">
                  <FileText size={18} className="mt-0.5 shrink-0 text-brand-500" />
                  <p className="flex-1 font-bold text-ink-800">{s.title}</p>
                </div>
                <p className="mt-1 text-xs text-ink-400">{s.points.length} {lang === 'ar' ? 'بنود' : 'points'}</p>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => doPrint(s.title, s.points)} className="btn-soft !py-1.5 flex-1 text-xs"><Printer size={13} /> {t('common.print')}</button>
                  <button onClick={() => setSendingSheet({ title: s.title, points: s.points })} title={lang === 'ar' ? 'إرسال للمريض على واتساب' : 'Send to patient on WhatsApp'}
                    className="btn !px-2.5 !py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><WhatsAppIcon size={14} /></button>
                  <button onClick={() => setEditing({ type: 'custom', id: s.id })} className="btn-outline !py-1.5 !px-2.5"><Pencil size={13} /></button>
                  <button onClick={() => deleteCustom(s.id)} className="btn-ghost !py-1.5 !px-2.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default sheets */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{lang === 'ar' ? 'أوراق جاهزة' : 'Ready-made sheets'}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defaultKeys.map((key) => {
            const sheet = defaultSheet(key)
            const edited = clinic?.customInstructions?.[key]?.[lang]
            const locked = !fullInstr && !FREE_SHEETS.includes(key)
            return (
              <div key={key} className={cx('card p-4', locked && 'opacity-70')}>
                <div className="flex items-start gap-2">
                  <FileText size={18} className="mt-0.5 shrink-0 text-brand-500" />
                  <p className="flex-1 font-bold text-ink-800">{sheet.title}</p>
                  {locked ? <Lock size={14} className="mt-0.5 shrink-0 text-amber-400" /> : edited && <Badge color="brand">{lang === 'ar' ? 'مُعدّل' : 'edited'}</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-400">{sheet.points.length} {lang === 'ar' ? 'بنود' : 'points'}</p>
                <div className="mt-3 flex gap-1.5">
                  {locked ? (
                    <FeatureLock feature="instructionsFull" soft />
                  ) : (
                    <>
                      <button onClick={() => doPrint(sheet.title, sheet.points)} className="btn-soft !py-1.5 flex-1 text-xs"><Printer size={13} /> {t('common.print')}</button>
                      <button onClick={() => setSendingSheet({ title: sheet.title, points: sheet.points })} title={lang === 'ar' ? 'إرسال للمريض على واتساب' : 'Send to patient on WhatsApp'}
                        className="btn !px-2.5 !py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><WhatsAppIcon size={14} /></button>
                      <button onClick={() => setEditing({ type: 'default', key })} className="btn-outline !py-1.5 !px-2.5"><Pencil size={13} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editing && <SheetEditor editing={editing} onClose={() => setEditing(null)} />}
      {sendingSheet && (
        <InstructionWhatsAppModal
          sheet={sendingSheet} patients={patients} clinic={clinic} lang={lang}
          updatePatient={updatePatient} onClose={() => setSendingSheet(null)}
        />
      )}
    </div>
  )

  function SheetEditor({ editing, onClose }) {
    const isCustom = editing.type === 'custom'
    const existingCustom = isCustom && editing.id ? customSheets.find((s) => s.id === editing.id) : null
    const base = isCustom
      ? (existingCustom || { title: '', points: [''] })
      : defaultSheet(editing.key)
    const [title, setTitle] = useState(base.title)
    const [points, setPoints] = useState(base.points.length ? [...base.points] : [''])

    function save() {
      const cleaned = points.filter((p) => p.trim())
      if (isCustom) {
        const id = editing.id || genId('sheet')
        const sheet = { id, title: title || (lang === 'ar' ? 'ورقة تعليمات' : 'Instruction sheet'), points: cleaned }
        const next = editing.id ? customSheets.map((s) => (s.id === id ? sheet : s)) : [...customSheets, sheet]
        updateClinic({ customSheets: next })
      } else {
        const ci = { ...(clinic.customInstructions || {}) }
        ci[editing.key] = { ...(ci[editing.key] || {}), [lang]: { title, points: cleaned } }
        updateClinic({ customInstructions: ci })
      }
      onClose()
    }

    return (
      <Modal open onClose={onClose} size="lg" title={t('settings.editInstructions')} icon={<FileText size={18} className="text-brand-500" />}
        footer={<><button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button><button onClick={save} className="btn-primary"><Save size={16} /> {t('common.save')}</button></>}>
        <Field label={lang === 'ar' ? 'اسم الورقة / العنوان' : 'Sheet name / title'}>
          <input className="input font-bold" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'ar' ? 'مثال: تعليمات بعد التبييض' : 'e.g. After whitening'} />
        </Field>
        <p className="label mt-3">{lang === 'ar' ? 'البنود' : 'Points'}</p>
        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
              <textarea rows={1} className="input min-h-[40px] resize-none py-2 text-sm" value={p}
                onChange={(e) => setPoints((ps) => ps.map((x, idx) => (idx === i ? e.target.value : x)))} />
              <button onClick={() => setPoints((ps) => ps.filter((_, idx) => idx !== i))} className="mt-1.5 p-1.5 text-ink-300 hover:text-rose-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setPoints((p) => [...p, ''])} className="btn-ghost mt-2 text-brand-600"><Plus size={15} /> {t('instructions.addPoint')}</button>
      </Modal>
    )
  }
}

function InstructionWhatsAppModal({ sheet, patients, clinic, lang, updatePatient, onClose }) {
  const [patientId, setPatientId] = useState('')
  const [phone, setPhone] = useState('')
  const patient = patients.find((item) => item.id === patientId)
  const patientName = patient ? (lang === 'ar' ? patient.nameAr || patient.name : patient.name) : ''
  const message = buildInstructionWhatsAppMessage({
    lang,
    clinicName: lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name,
    patientName,
    title: sheet.title,
    points: sheet.points,
  })

  function selectPatient(id) {
    const nextPatient = patients.find((item) => item.id === id)
    setPatientId(id)
    setPhone(nextPatient?.phone || '')
  }

  function rememberNumber() {
    if (patient && phone.trim() !== (patient.phone || '').trim()) updatePatient(patient.id, { phone: phone.trim() })
  }

  return (
    <Modal open onClose={onClose} size="md"
      title={lang === 'ar' ? 'إرسال ورقة التعليمات للمريض' : 'Send Instructions to Patient'}
      icon={<WhatsAppIcon size={18} className="text-emerald-600" />}
      footer={<>
        <button onClick={onClose} className="btn-ghost">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
        {patientId && waNumber(phone).length >= 8 ? (
          <a href={waLink(phone, message)} target="_blank" rel="noopener noreferrer" onClick={rememberNumber}
            className="btn bg-emerald-500 text-white hover:bg-emerald-600"><WhatsAppIcon size={16} /> {lang === 'ar' ? 'فتح الشات بالورقة' : 'Open chat with sheet'}</a>
        ) : (
          <button disabled className="btn bg-emerald-500 text-white"><WhatsAppIcon size={16} /> {lang === 'ar' ? 'فتح الشات بالورقة' : 'Open chat with sheet'}</button>
        )}
      </>}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
          <p className="text-xs font-semibold text-brand-600">{lang === 'ar' ? 'الورقة المختارة' : 'Selected sheet'}</p>
          <p className="mt-1 font-bold text-ink-800">{sheet.title}</p>
          <p className="mt-0.5 text-xs text-ink-400">{sheet.points.filter((point) => point.trim()).length} {lang === 'ar' ? 'بنود ستُرسل كاملة' : 'points will be sent in full'}</p>
        </div>
        <Field label={lang === 'ar' ? 'المريض' : 'Patient'} required>
          <select className="input" value={patientId} onChange={(e) => selectPatient(e.target.value)}>
            <option value="">{lang === 'ar' ? '— اختر مريضاً —' : '— Select patient —'}</option>
            {patients.map((item) => <option key={item.id} value={item.id}>{lang === 'ar' ? item.nameAr || item.name : item.name}</option>)}
          </select>
        </Field>
        <Field label={lang === 'ar' ? 'رقم واتساب المريض' : 'Patient WhatsApp number'} required
          hint={lang === 'ar' ? 'اكتب الرقم مع رمز الدولة؛ سيُحفظ في ملف المريض عند الإرسال.' : 'Include the country code; it will be saved to the patient profile when sent.'}>
          <div className="relative">
            <Phone size={15} className="absolute top-1/2 -translate-y-1/2 text-ink-400 start-3" />
            <input dir="ltr" type="tel" className="input ps-9 text-start" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+970… / +962…" />
          </div>
        </Field>
        <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
          {lang === 'ar' ? 'عند الضغط سيفتح شات المريض وفيه ورقة التعليمات كاملة وجاهزة؛ يبقى عليك ضغط إرسال فقط.' : 'The patient chat will open with the complete instruction sheet ready; you only need to press Send.'}
        </p>
      </div>
    </Modal>
  )
}
