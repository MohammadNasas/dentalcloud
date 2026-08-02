import { useState } from 'react'
import { Printer, Plus, Trash2, Save, FileText } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { INSTRUCTIONS, instructionKeyFor, DENTAL_ITEMS } from '../lib/treatments'
import { Modal, Field } from './ui'
import { printSheet, escapeHtml } from '../lib/print'
import { waLink, waNumber, buildInstructionWhatsAppMessage } from '../lib/utils'
import WhatsAppIcon from './WhatsAppIcon'

// Editable, printable post-op / treatment instruction sheet. Each treatment has
// default instructions; the dentist can add/edit/remove points before printing,
// and optionally save the edits as the clinic default.
export default function InstructionsModal({ patient, treatmentKey, onClose }) {
  const { t, lang } = useI18n()
  const { clinic, updateClinic, updatePatient } = useStore()
  const key = instructionKeyFor(treatmentKey)
  const custom = clinic?.customInstructions?.[key]?.[lang]
  const base = custom || INSTRUCTIONS[key][lang]

  const [title, setTitle] = useState(base.title)
  const [points, setPoints] = useState([...base.points])
  const [phone, setPhone] = useState(patient.phone || '')

  const treatmentName = DENTAL_ITEMS[treatmentKey]?.[lang] || ''
  const patientName = lang === 'ar' ? patient.nameAr || patient.name : patient.name
  const whatsAppMessage = buildInstructionWhatsAppMessage({
    lang,
    clinicName: lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name,
    patientName,
    treatmentName,
    title,
    points,
  })

  function setPoint(i, v) { setPoints((p) => p.map((x, idx) => (idx === i ? v : x))) }
  function addPoint() { setPoints((p) => [...p, '']) }
  function removePoint(i) { setPoints((p) => p.filter((_, idx) => idx !== i)) }

  function saveDefault() {
    const ci = { ...(clinic.customInstructions || {}) }
    ci[key] = { ...(ci[key] || {}), [lang]: { title, points: points.filter((p) => p.trim()) } }
    updateClinic({ customInstructions: ci })
  }

  function doPrint() {
    const body = `
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span><b>${lang === 'ar' ? 'المريض' : 'Patient'}:</b> ${escapeHtml(patientName)}</span>
        ${treatmentName ? `<span><b>${lang === 'ar' ? 'العلاج' : 'Treatment'}:</b> ${escapeHtml(treatmentName)}</span>` : ''}
      </div>
      <ul>${points.filter((p) => p.trim()).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
    printSheet({
      title, lang,
      clinicName: lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name,
      subtitle: t('instructions.title'),
      bodyHtml: body,
    })
  }

  function rememberWhatsAppNumber() {
    if (phone.trim() !== (patient.phone || '').trim()) updatePatient(patient.id, { phone: phone.trim() })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t('instructions.title')}
      icon={<FileText size={18} className="text-brand-500" />}
      footer={
        <>
          <button onClick={saveDefault} className="btn-ghost"><Save size={15} /> {t('common.save')}</button>
          <button onClick={doPrint} className="btn-outline"><Printer size={16} /> {t('instructions.printGive')}</button>
          {waNumber(phone).length >= 8 ? (
            <a href={waLink(phone, whatsAppMessage)} target="_blank" rel="noopener noreferrer" onClick={rememberWhatsAppNumber}
              className="btn bg-emerald-500 text-white hover:bg-emerald-600"><WhatsAppIcon size={16} /> {lang === 'ar' ? 'إرسال على واتساب' : 'Send on WhatsApp'}</a>
          ) : (
            <button disabled className="btn bg-emerald-500 text-white"><WhatsAppIcon size={16} /> {lang === 'ar' ? 'إرسال على واتساب' : 'Send on WhatsApp'}</button>
          )}
        </>
      }
    >
      <p className="mb-3 text-xs text-ink-400">{t('instructions.editBeforePrint')}</p>
      <Field label={lang === 'ar' ? 'رقم واتساب المريض' : 'Patient WhatsApp number'}
        hint={lang === 'ar' ? 'اكتب الرقم مع رمز الدولة؛ سيُحفظ في ملف المريض عند الإرسال.' : 'Include the country code; it will be saved to the patient profile when sent.'}
        className="mb-3">
        <input dir="ltr" type="tel" className="input text-start" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+970… / +962…" />
      </Field>
      <input
        className="input mb-3 font-bold"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="space-y-2">
        {points.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
            <textarea
              className="input min-h-[40px] resize-none py-2 text-sm"
              value={p}
              onChange={(e) => setPoint(i, e.target.value)}
              rows={1}
            />
            <button onClick={() => removePoint(i)} className="mt-1 p-1.5 text-ink-300 hover:text-rose-500"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <button onClick={addPoint} className="btn-ghost mt-2 text-brand-600"><Plus size={15} /> {t('instructions.addPoint')}</button>
    </Modal>
  )
}
