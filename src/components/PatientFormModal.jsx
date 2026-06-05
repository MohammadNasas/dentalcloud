import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Save } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field, Segmented } from './ui'
import { calcAge } from '../lib/utils'

const empty = {
  name: '', nameAr: '', fileNo: '', phone: '', gender: '', dob: '',
  occupation: '', address: '', complaint: '',
}

export default function PatientFormModal({ open, onClose, patient, onSaved }) {
  const { t, lang } = useI18n()
  const { addPatient, updatePatient } = useStore()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)

  useEffect(() => {
    if (open) setForm(patient ? { ...empty, ...patient } : empty)
  }, [open, patient])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const age = form.dob ? calcAge(form.dob) : form.age || ''

  function submit() {
    const data = { ...form, age }
    if (patient) {
      updatePatient(patient.id, data)
      onSaved?.(patient.id)
      onClose()
    } else {
      const p = addPatient(data)
      onClose()
      if (onSaved) onSaved(p.id)
      else navigate(`/patients/${p.id}`)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={patient ? t('patient.editPatient') : t('patient.newPatient')}
      icon={<UserPlus size={18} className="text-brand-500" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={submit} className="btn-primary" disabled={!form.name}><Save size={16} /> {t('common.save')}</button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('patient.name')} required className="sm:col-span-2">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        {lang === 'ar' && (
          <Field label={`${t('patient.name')} (EN)`} className="sm:col-span-2">
            <input className="input" dir="ltr" value={form.nameAr === form.name ? '' : form.nameAr} placeholder="optional" onChange={(e) => set('nameAr', e.target.value)} />
          </Field>
        )}
        <Field label={t('patient.fileNo')}>
          <input className="input" value={form.fileNo} onChange={(e) => set('fileNo', e.target.value)} placeholder="auto" />
        </Field>
        <Field label={t('patient.phone')}>
          <input className="input" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+962 7…" />
        </Field>
        <Field label={t('patient.gender')}>
          <Segmented
            value={form.gender}
            onChange={(v) => set('gender', v)}
            options={[
              { value: 'male', label: t('patient.male') },
              { value: 'female', label: t('patient.female') },
            ]}
          />
        </Field>
        <Field label={`${t('patient.dob')} ${age !== '' ? `· ${t('patient.age')}: ${age}` : ''}`}>
          <input className="input" type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
        </Field>
        <Field label={t('patient.occupation')}>
          <input className="input" value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
        </Field>
        <Field label={t('patient.address')}>
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('patient.complaint')} className="sm:col-span-2">
          <textarea className="input min-h-[72px] resize-y" value={form.complaint} onChange={(e) => set('complaint', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
