import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Check, FileText, Search, UserRound, X } from 'lucide-react'
import WhatsAppIcon from './WhatsAppIcon'
import { buildInstructionWhatsAppMessage, cx, waLink } from '../lib/utils'
import { createPatientMatcher } from '../lib/patientSearch'
import { instructionRecipientPhone } from '../lib/instructionRecipient'

export default function InstructionWhatsAppModal({ sheet, patients = [], clinic, lang, onClose }) {
  const ar = lang === 'ar'
  const id = useId()
  const dialog = useRef(null)
  const search = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const reducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [patientId, setPatientId] = useState('')
  const name = (patient) => ar ? patient.nameAr || patient.name : patient.name || patient.nameAr
  const matches = useMemo(() => patients.filter(createPatientMatcher(query)), [patients, query])
  const patient = patients.find((item) => item.id === patientId)
  const recipient = instructionRecipientPhone(patient?.phone)
  const ready = Boolean(patient && recipient.status === 'ready')
  const message = ready ? buildInstructionWhatsAppMessage({
    lang, clinicName: ar ? clinic?.nameAr || clinic?.name : clinic?.name,
    patientName: name(patient), title: sheet.title, points: sheet.points,
  }) : ''

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    search.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = [...dialog.current.querySelectorAll('button:not(:disabled), input, a[href]')]
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) {
        event.preventDefault(); first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  const buttonClass = 'btn w-full justify-center rounded-xl !py-3 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
  return createPortal(
    <motion.div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ink-950/40 p-3 backdrop-blur-sm sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <motion.section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id + '-title'} aria-describedby={id + '-description'}
        dir={ar ? 'rtl' : 'ltr'}
        initial={{ y: reducedMotion ? 0 : 12, scale: reducedMotion ? 1 : 0.97 }}
        animate={{ y: 0, scale: 1 }} exit={{ y: reducedMotion ? 0 : 8, scale: reducedMotion ? 1 : 0.98 }}
        transition={{ duration: reducedMotion ? 0 : 0.18 }}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[460px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><WhatsAppIcon size={23} /></span>
          <div className="min-w-0 flex-1">
            <h2 id={id + '-title'} className="text-base font-extrabold text-ink-900">{ar ? 'إرسال عبر واتساب' : 'Share via WhatsApp'}</h2>
            <p id={id + '-description'} className="mt-1 text-xs leading-5 text-ink-400">{ar ? 'اختر المريض الذي تريد مشاركة التعليمة معه' : 'Choose the patient to share this instruction with'}</p>
          </div>
          <button onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50"><X size={18} /></button>
        </header>
        <div className="min-h-0 space-y-3 overflow-y-auto px-5 pb-4">
          <div className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-3 text-sm font-bold text-ink-700"><FileText size={17} className="shrink-0 text-brand-600" /><span>{sheet.title}</span></div>
          <div>
            <label htmlFor={id + '-search'} className="mb-2 block text-xs font-bold text-ink-700">{ar ? 'المريض' : 'Patient'}</label>
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input ref={search} id={id + '-search'} type="search" autoComplete="off" className="input !ps-10 !text-sm"
                placeholder={ar ? 'ابحث بالاسم أو رقم الهاتف' : 'Search by name or phone'}
                value={query} onChange={(event) => { setQuery(event.target.value); setPatientId('') }} />
            </div>
          </div>
          <div role="group" aria-label={ar ? 'اختيار المريض' : 'Choose patient'} className="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
            {matches.length ? matches.map((item) => {
              const selected = item.id === patientId
              const missing = !String(item.phone || '').trim()
              return <button key={item.id} type="button" aria-pressed={selected} onClick={() => setPatientId(item.id)}
                className={cx('flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-emerald-600', selected ? 'border-emerald-300 bg-emerald-50/70' : 'border-ink-100 hover:border-emerald-200 hover:bg-ink-50')}>
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', selected ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-50 text-ink-400')}><UserRound size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-800">{name(item)}</span>
                  <span dir={missing ? undefined : 'ltr'} className="mt-0.5 block truncate text-start text-xs text-ink-400">{missing ? (item.fileNo ? (ar ? 'ملف ' : 'File ') + item.fileNo : (ar ? 'لا يوجد رقم مسجّل' : 'No saved number')) : item.phone}</span>
                </span>
                {missing && <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{ar ? 'بدون رقم' : 'No number'}</span>}
                <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink-200')}>{selected && <Check size={13} />}</span>
              </button>
            }) : <p className="px-3 py-7 text-center text-sm text-ink-400">{patients.length ? (ar ? 'لا يوجد مريض يطابق بحثك' : 'No patients match your search') : (ar ? 'أضف مريضًا أولًا من صفحة المرضى' : 'Add a patient from the Patients page first')}</p>}
          </div>
          <div aria-live="polite">
            {patient && !ready ? <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div><p className="text-xs font-bold">{recipient.status === 'missing' ? (ar ? 'لا يوجد رقم هاتف مسجّل لهذا المريض' : 'This patient has no saved phone number') : (ar ? 'رقم المريض بحاجة إلى تعديل' : 'This patient’s number needs updating')}</p>
                <p className="mt-1 text-xs leading-5">{ar ? 'أضف رقمًا يستخدمه المريض على واتساب مع رمز الدولة إلى ملفه، ثم أعد المحاولة.' : 'Add the patient’s WhatsApp number, including country code, to their profile and try again.'}</p>
              </div>
            </div> : patient ? <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-emerald-800">
              <p className="text-xs font-bold">{ar ? 'إلى ' : 'To '}{name(patient)}</p>
              <p className="mt-1 text-xs leading-5">{ar ? 'ستُجهّز التعليمة المحددة في محادثة هذا المريض.' : 'The selected instruction will be prepared in this patient’s chat.'}</p>
            </div> : null}
          </div>
        </div>
        <footer className="shrink-0 border-t border-ink-100 px-5 pb-4 pt-4">
          {ready ? <a className={buttonClass} href={waLink(recipient.number, message)} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={17} />{ar ? 'المتابعة إلى واتساب' : 'Continue to WhatsApp'}</a>
            : <button disabled className={buttonClass + ' cursor-not-allowed !bg-ink-100 !text-ink-400'}><WhatsAppIcon size={17} />{ar ? 'المتابعة إلى واتساب' : 'Continue to WhatsApp'}</button>}
          <p className="mt-3 text-center text-[11px] leading-5 text-ink-400">{ar ? 'تراجع الرسالة وتؤكّد إرسالها داخل واتساب.' : 'Review the message and confirm sending in WhatsApp.'}</p>
        </footer>
      </motion.section>
    </motion.div>, document.body,
  )
}
