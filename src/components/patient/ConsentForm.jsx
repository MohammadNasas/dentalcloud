import { useState } from 'react'
import { Printer, Save, FileSignature, Check } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { Field } from '../ui'
import { toast } from '../anim'
import { printSheet, escapeHtml } from '../../lib/print'

// Editable, printable treatment-consent sheet. Auto-fills patient/clinic/doctor,
// the doctor types the treatment plan, then prints a clean A4 form with two
// signature lines. Everything is editable before printing.
export default function ConsentForm({ patient }) {
  const { lang } = useI18n()
  const { clinic, currentUser, updatePatient } = useStore()
  const L = (ar, en) => (lang === 'ar' ? ar : en)

  const c = patient.consent || {}
  const pName = lang === 'ar' ? (patient.nameAr || patient.name) : patient.name
  const clinicName = lang === 'ar' ? (clinic?.nameAr || clinic?.name) : clinic?.name
  const docName = lang === 'ar' ? (currentUser?.nameAr || currentUser?.name) : currentUser?.name
  const defaultStatement = L(
    'أنا الموقّع أدناه أوافق على خطة العلاج المذكورة أركانها فيما يلي، وقد شُرحت لي وفهمتها بالكامل بما فيها من فوائد ومخاطر وبدائل:',
    'I, the undersigned, consent to the treatment plan whose elements are listed below, which — including its benefits, risks and alternatives — has been explained to me and fully understood:'
  )

  const [form, setForm] = useState({
    name: c.name || pName || '',
    phone: c.phone ?? (patient.phone || ''),
    fileNo: c.fileNo || patient.fileNo || '',
    doctor: c.doctor || docName || '',
    clinicName: c.clinicName || clinicName || '',
    date: c.date || new Date().toISOString().slice(0, 10),
    statement: c.statement || defaultStatement,
    plan: c.plan || '',
  })
  const [saved, setSaved] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function save() {
    updatePatient(patient.id, { consent: form })
    setSaved(true); setTimeout(() => setSaved(false), 1500)
    toast(L('تم الحفظ', 'Saved'))
  }

  function print() {
    const planHtml = form.plan.trim()
      ? `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:14px 16px;white-space:pre-wrap;font-size:14px;margin-top:10px;min-height:90px">${escapeHtml(form.plan)}</div>`
      : `<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:28px;margin-top:10px"></div>`
    const body = `
      <h1>${L('نموذج موافقة على العلاج', 'Treatment Consent Form')}</h1>
      <div class="meta">
        <span><b>${L('المريض', 'Patient')}:</b> ${escapeHtml(form.name)}</span>
        <span><b>${L('الهاتف', 'Phone')}:</b> ${escapeHtml(form.phone)}</span>
        ${form.fileNo ? `<span><b>${L('رقم الملف', 'File no.')}:</b> ${escapeHtml(form.fileNo)}</span>` : ''}
        <span><b>${L('الطبيب', 'Doctor')}:</b> ${escapeHtml(form.doctor)}</span>
        <span><b>${L('التاريخ', 'Date')}:</b> ${escapeHtml(form.date)}</span>
      </div>
      <p style="font-size:15px;font-weight:600;margin:6px 0 14px">${escapeHtml(form.statement)}</p>
      <p style="font-size:13px;color:#64748b;margin:0">${L('خطة العلاج', 'Treatment plan')}:</p>
      ${planHtml}
      <div style="display:flex;justify-content:space-between;gap:50px;margin-top:74px">
        <div style="flex:1;text-align:center"><div style="border-top:1px solid #1e293b;padding-top:8px;font-size:14px">${L('توقيع الطبيب', "Doctor's signature")}</div></div>
        <div style="flex:1;text-align:center"><div style="border-top:1px solid #1e293b;padding-top:8px;font-size:14px">${L('توقيع المريض', "Patient's signature")}</div></div>
      </div>`
    printSheet({
      title: L('نموذج موافقة', 'Consent'),
      lang,
      clinicName: form.clinicName,
      subtitle: L('نموذج موافقة على العلاج', 'Treatment consent form'),
      bodyHtml: body,
    })
  }

  return (
    <div className="card max-w-3xl space-y-4 p-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-ink-800"><FileSignature size={20} className="text-brand-500" /> {L('نموذج موافقة على العلاج', 'Treatment consent form')}</h3>
        <p className="mt-1 text-sm text-ink-400">{L('عدّل البيانات وخطة العلاج كما تشاء قبل الطباعة.', 'Edit the details and treatment plan as needed before printing.')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={L('اسم المريض الكامل', 'Patient full name')}><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={L('رقم الجوال', 'Mobile number')}><input className="input" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={L('اسم العيادة', 'Clinic name')}><input className="input" value={form.clinicName} onChange={(e) => set('clinicName', e.target.value)} /></Field>
        <Field label={L('اسم الطبيب', 'Doctor name')}><input className="input" value={form.doctor} onChange={(e) => set('doctor', e.target.value)} /></Field>
        <Field label={L('رقم الملف', 'File no.')}><input className="input" value={form.fileNo} onChange={(e) => set('fileNo', e.target.value)} /></Field>
        <Field label={L('التاريخ', 'Date')}><input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
      </div>

      <Field label={L('صيغة الموافقة', 'Consent statement')}>
        <textarea className="input min-h-[80px] resize-y" value={form.statement} onChange={(e) => set('statement', e.target.value)} />
      </Field>

      <Field label={L('خطة العلاج (أركانها — سطر لكل بند)', 'Treatment plan (one item per line)')}>
        <textarea className="input min-h-[150px] resize-y" placeholder={L('مثال:\n- حشوة العصب للسن 36\n- تركيب تاج خزفي\n- قلع الضرس 48', 'e.g.\n- Root canal for tooth 36\n- Porcelain crown\n- Extraction of tooth 48')} value={form.plan} onChange={(e) => set('plan', e.target.value)} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <button onClick={print} className="btn-primary"><Printer size={16} /> {L('طباعة', 'Print')}</button>
        <button onClick={save} className="btn-outline">{saved ? <><Check size={16} /> {L('تم الحفظ', 'Saved')}</> : <><Save size={16} /> {L('حفظ', 'Save')}</>}</button>
      </div>
    </div>
  )
}
