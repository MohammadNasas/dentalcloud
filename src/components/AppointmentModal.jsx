import { useState, useEffect } from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field, Segmented } from './ui'

export default function AppointmentModal({ open, onClose, appointment, defaultDate, defaultPatientId }) {
  const { t, lang } = useI18n()
  const { patients, doctors, addAppointment, updateAppointment, deleteAppointment, currentUser, can } = useStore()

  const [form, setForm] = useState({})

  useEffect(() => {
    if (!open) return
    if (appointment) {
      const d = new Date(appointment.start)
      const dur = Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60000) || 30
      setForm({
        patientId: appointment.patientId, doctorId: appointment.doctorId,
        date: d.toISOString().slice(0, 10), time: d.toTimeString().slice(0, 5),
        duration: dur, reason: appointment.reason || '', step: appointment.step || '',
        status: appointment.status || 'scheduled', notes: appointment.notes || '',
      })
    } else {
      const d = defaultDate ? new Date(defaultDate) : new Date()
      setForm({
        patientId: defaultPatientId || patients[0]?.id || '', doctorId: currentUser?.id,
        date: d.toISOString().slice(0, 10), time: '09:00', duration: 30,
        reason: '', step: '', status: 'scheduled', notes: '',
      })
    }
  }, [open, appointment, defaultDate, defaultPatientId])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function save() {
    if (!form.patientId) return
    const start = new Date(`${form.date}T${form.time}`)
    const end = new Date(start.getTime() + (Number(form.duration) || 30) * 60000)
    const data = {
      patientId: form.patientId, doctorId: form.doctorId,
      start: start.toISOString(), end: end.toISOString(),
      reason: form.reason, step: form.step, status: form.status, notes: form.notes,
    }
    if (appointment) updateAppointment(appointment.id, data)
    else addAppointment(data)
    onClose()
  }

  function remove() {
    deleteAppointment(appointment.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="md"
      title={appointment ? t('appt.edit') : t('appt.new')}
      icon={<CalendarPlus size={18} className="text-brand-500" />}
      footer={
        <>
          {appointment && <button onClick={remove} className="btn-ghost me-auto text-rose-500 hover:bg-rose-50"><Trash2 size={15} /> {t('common.delete')}</button>}
          <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('common.save')}</button>
        </>
      }
    >
      <div className="space-y-3">
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
      </div>
    </Modal>
  )
}
