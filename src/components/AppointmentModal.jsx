import { useState, useEffect, useRef } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field } from './ui'
import { appointmentConflicts } from '../lib/appointmentConflicts.js'
import { backend } from '../lib/backend'
import { useSaveAction } from '../lib/useSaveAction'

export default function AppointmentModal({ open, onClose, appointment, defaultDate, defaultPatientId }) {
  const { t, lang } = useI18n()
  const { patients, doctors, appointments, addAppointment, updateAppointment, deleteAppointment, currentUser, can } = useStore()

  const [form, setForm] = useState({})
  const [acceptedConflict, setAcceptedConflict] = useState(null)
  const draftId = useRef(null)
  const { saving, runSave } = useSaveAction()

  useEffect(() => {
    if (!open) return
    setAcceptedConflict(null)
    draftId.current = appointment?.id || backend.genId('appointment')
    if (appointment) {
      const d = new Date(appointment.start)
      const dur = Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60000) || 30
      setForm({
        patientId: appointment.patientId, doctorId: appointment.doctorId,
        date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm'),
        duration: dur, reason: appointment.reason || '', step: appointment.step || '',
        status: appointment.status || 'scheduled', notes: appointment.notes || '',
      })
    } else {
      const d = defaultDate ? (typeof defaultDate === 'string' ? parseISO(defaultDate) : new Date(defaultDate)) : new Date()
      setForm({
        patientId: defaultPatientId || patients[0]?.id || '', doctorId: currentUser?.id,
        // Date inputs use the selected local calendar day, not its UTC date.
        date: format(d, 'yyyy-MM-dd'), time: '09:00', duration: 30,
        reason: '', step: '', status: 'scheduled', notes: '',
      })
    }
  }, [open, appointment?.id, defaultDate, defaultPatientId])

  const set = (k, v) => {
    if (['date', 'time', 'duration', 'doctorId', 'patientId', 'status'].includes(k)) setAcceptedConflict(null)
    setForm((f) => ({ ...f, [k]: v }))
  }

  const startMs = new Date(`${form.date}T${form.time}`).getTime()
  const endMs = startMs + (Number(form.duration) || 30) * 60000
  const validTime = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
  const candidate = {
    id: draftId.current, patientId: form.patientId, doctorId: form.doctorId, status: form.status,
    start: validTime ? new Date(startMs).toISOString() : '',
    end: validTime ? new Date(endMs).toISOString() : '',
  }
  const conflicts = appointmentConflicts(candidate, appointments)
  // A changed time, person, or conflicting appointment requires fresh consent.
  const conflictKey = JSON.stringify([candidate, conflicts.map(({ id, start, end, doctorId, patientId, status }) => ({ id, start, end, doctorId, patientId, status }))])
  const needsConfirmation = conflicts.length > 0 && acceptedConflict !== conflictKey

  function save() { return runSave(async () => {
    if (!form.patientId || !validTime || needsConfirmation) return
    const start = new Date(`${form.date}T${form.time}`)
    const end = new Date(start.getTime() + (Number(form.duration) || 30) * 60000)
    const data = {
      id: draftId.current,
      patientId: form.patientId, doctorId: form.doctorId,
      start: start.toISOString(), end: end.toISOString(),
      reason: form.reason, step: form.step, status: form.status, notes: form.notes,
    }
    const saved = appointment ? await updateAppointment(appointment.id, data) : await addAppointment(data)
    if (saved) onClose()
  }) }

  function remove() { return runSave(async () => {
    if (await deleteAppointment(appointment.id)) onClose()
  }) }

  return (
    <Modal open={open} onClose={() => { if (!saving) onClose() }} size="md"
      title={appointment ? t('appt.edit') : t('appt.new')}
      icon={<CalendarPlus size={18} className="text-brand-500" />}
      footer={
        <>
          {appointment && <button onClick={remove} disabled={saving} className="btn-ghost me-auto text-rose-500 hover:bg-rose-50"><Trash2 size={15} /> {t('common.delete')}</button>}
          <button onClick={onClose} disabled={saving} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} disabled={saving || !form.patientId || !validTime || needsConfirmation} className="btn-primary">{saving ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('common.save')}</button>
        </>
      }
    >
      <fieldset disabled={saving} className="space-y-3">
        <Field label={t('appt.selectPatient')}>
          <select className="input" value={form.patientId} onChange={(e) => set('patientId', e.target.value)}>
            {patients.map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.nameAr || p.name : p.name} — #{p.fileNo}</option>)}
          </select>
        </Field>

        {can('multiDoctor') && (
          <Field label={t('appt.doctor')}>
            <div className="flex flex-wrap gap-2">
              {doctors.map((d) => (
                <button key={d.id} onClick={() => set('doctorId', d.id)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${form.doctorId === d.id ? 'border-transparent text-white' : 'border-ink-200 text-ink-600'}`}
                  style={form.doctorId === d.id ? { background: d.color } : {}}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: form.doctorId === d.id ? '#fff' : d.color }} />
                  {(lang === 'ar' ? d.nameAr : d.name)?.replace(/Dr\. |د\. /, '')}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label={t('common.date')}><input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label={t('appt.start')}><input type="time" className="input" value={form.time} onChange={(e) => set('time', e.target.value)} /></Field>
          <Field label={t('appt.duration')}>
            <select className="input" value={form.duration} onChange={(e) => set('duration', e.target.value)}>
              {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} {t('appt.minutes')}</option>)}
            </select>
          </Field>
        </div>

        {conflicts.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <div role="alert">
            <p className="font-bold">{lang === 'ar' ? 'تنبيه: يوجد تعارض بالمواعيد' : 'Warning: overlapping appointments'}</p>
            <p className="mt-1">{lang === 'ar' ? 'للطبيب أو المريض موعد آخر بنفس الفترة. عدّل الوقت أو أكّد الحجز رغم التعارض.' : 'This doctor or patient has another appointment during this time. Change the time or confirm the overlap.'}</p>
            <ul className="my-2 space-y-1">
              {conflicts.slice(0, 3).map((item) => {
                const patient = patients.find((p) => p.id === item.patientId)
                const doctor = doctors.find((d) => d.id === item.doctorId)
                return <li key={item.id}>
                  <span dir="ltr">{format(new Date(item.start), 'yyyy-MM-dd HH:mm')} – {format(new Date(item.end), 'HH:mm')}</span>
                  {' · '}{(lang === 'ar' ? patient?.nameAr || patient?.name : patient?.name) || (lang === 'ar' ? 'مريض' : 'Patient')}
                  {doctor && <> · {lang === 'ar' ? doctor.nameAr || doctor.name : doctor.name}</>}
                </li>
              })}
            </ul>
            {conflicts.length > 3 && <p>{lang === 'ar' ? `و${conflicts.length - 3} مواعيد أخرى` : `And ${conflicts.length - 3} more appointments`}</p>}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={!needsConfirmation} onChange={(e) => setAcceptedConflict(e.target.checked ? conflictKey : null)} />
            {lang === 'ar' ? 'أريد حفظ الموعد رغم التعارض' : 'Save this appointment despite the overlap'}
          </label>
        </div>}

        <Field label={t('appt.reason')}><input className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)} /></Field>

        {can('apptWorkLog') && (
          <Field label={t('appt.step')} hint={lang === 'ar' ? 'الخطوة التي وصل إليها العلاج' : 'treatment step reached'}>
            <input className="input" value={form.step} onChange={(e) => set('step', e.target.value)} />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('common.status')}>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="scheduled">{t('appt.scheduled')}</option>
              <option value="completed">{t('appt.completed')}</option>
              <option value="cancelled">{t('appt.cancelled')}</option>
              <option value="noShow">{t('appt.noShow')}</option>
            </select>
          </Field>
          <Field label={t('common.notes')}><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </fieldset>
    </Modal>
  )
}
