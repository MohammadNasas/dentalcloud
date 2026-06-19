import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Pencil, FileDown, Trash2, Phone, MapPin, Briefcase,
  CalendarClock, Wallet, ClipboardList, Stethoscope, Grid3x3, Activity,
  Images, History, NotebookPen, FileSignature,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Avatar, Badge, Segmented } from '../components/ui'
import PatientFormModal from '../components/PatientFormModal'
import FeatureLock from '../components/FeatureLock'
import HistoryForm from '../components/patient/HistoryForm'
import DentalChart from '../components/patient/DentalChart'
import PerioChart from '../components/patient/PerioChart'
import TreatmentsPanel from '../components/patient/TreatmentsPanel'
import PaymentsPanel from '../components/patient/PaymentsPanel'
import ConsentForm from '../components/patient/ConsentForm'
import Gallery from '../components/patient/Gallery'
import Timeline from '../components/patient/Timeline'
import Overview from '../components/patient/Overview'
import { money, waLink } from '../lib/utils'
import { dayLabel, parseISO } from '../lib/dates'
import { exportPatient } from '../lib/wordExport'
import WhatsAppIcon from '../components/WhatsAppIcon'

const TABS = [
  { id: 'overview', icon: ClipboardList, key: 'overview' },
  { id: 'history', icon: Stethoscope, key: 'history' },
  { id: 'chart', icon: Grid3x3, key: 'chart' },
  { id: 'perio', icon: Activity, key: 'perio', feature: 'perio' },
  { id: 'treatments', icon: NotebookPen, key: 'treatments' },
  { id: 'consent', icon: FileSignature, key: 'consent', feature: 'consent' },
  { id: 'payments', icon: Wallet, key: 'paymentsTab', feature: 'clinicBalances' },
  { id: 'gallery', icon: Images, key: 'gallery' },
  { id: 'timeline', icon: History, key: 'timeline' },
]

export default function PatientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang, isRTL } = useI18n()
  const store = useStore()
  const { getPatient, getDoctor, deletePatient, apptsForPatient, balanceForPatient, recordsForPatient, paymentsForPatient, clinic, can } = store
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const patient = getPatient(id)
  const Back = isRTL ? ArrowRight : ArrowLeft
  if (!patient) return <Navigate to="/patients" replace />

  const currency = clinic?.settings?.currency || 'JOD'
  const bal = can('clinicBalances') ? balanceForPatient(patient.id) : null
  const nextAppt = apptsForPatient(patient.id)
    .filter((a) => parseISO(a.start) >= new Date() && a.status === 'scheduled')
    .sort((a, b) => a.start.localeCompare(b.start))[0]

  const visibleTabs = TABS.filter((tb) => !tb.feature || can(tb.feature) || true) // show all, lock inside

  const pName = lang === 'ar' ? (patient.nameAr || patient.name) : patient.name
  const clinicName = lang === 'ar' ? (clinic?.nameAr || clinic?.name) : clinic?.name
  const waMsg = nextAppt
    ? (lang === 'ar'
        ? `مرحباً ${pName}، تذكير بموعدك في ${clinicName || ''} يوم ${dayLabel(nextAppt.start, lang, t)}.`
        : `Hi ${pName}, a reminder of your appointment at ${clinicName || ''} on ${dayLabel(nextAppt.start, lang, t)}.`)
    : (lang === 'ar'
        ? `مرحباً ${pName}، من ${clinicName || ''}.`
        : `Hi ${pName}, from ${clinicName || ''}.`)

  async function doExport() {
    setExporting(true)
    try { await exportPatient(patient, { clinic, lang, getDoctor: store.getDoctor, recordsForPatient, paymentsForPatient, balanceForPatient }) }
    finally { setExporting(false) }
  }

  function doDelete() {
    if (confirm(t('patient.deleteConfirm'))) { deletePatient(patient.id); navigate('/patients') }
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/patients')} className="flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600">
        <Back size={16} /> {t('patient.patients')}
      </button>

      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-brand-500 to-teal-400" />
        <div className="flex flex-wrap items-start gap-4 p-5">
          <Avatar name={patient.name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-ink-800">{lang === 'ar' ? patient.nameAr || patient.name : patient.name}</h2>
              <Badge color="ink">#{patient.fileNo}</Badge>
              {patient.gender && <Badge color="brand">{t(`patient.${patient.gender}`)}</Badge>}
              {patient.age !== '' && <Badge color="ink">{patient.age} {lang === 'ar' ? 'سنة' : 'yrs'}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
              {patient.phone && (
                <span className="flex items-center gap-2">
                  <Phone size={14} /> <span dir="ltr">{patient.phone}</span>
                  <a href={waLink(patient.phone, waMsg)} target="_blank" rel="noopener noreferrer"
                    title="WhatsApp" aria-label="WhatsApp"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#25D366] text-white hover:opacity-90">
                    <WhatsAppIcon size={13} />
                  </a>
                  <a href={`tel:${patient.phone.replace(/\s/g, '')}`}
                    title={t('patient.call')} aria-label={t('patient.call')}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600">
                    <Phone size={13} />
                  </a>
                </span>
              )}
              {patient.occupation && <span className="flex items-center gap-1.5"><Briefcase size={14} /> {patient.occupation}</span>}
              {patient.address && <span className="flex items-center gap-1.5"><MapPin size={14} /> {patient.address}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditOpen(true)} className="btn-outline !py-2"><Pencil size={15} /> {t('common.edit')}</button>
            <button onClick={doExport} disabled={exporting} className="btn-outline !py-2"><FileDown size={15} /> Word</button>
            <button onClick={doDelete} className="btn-ghost !py-2 text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
          </div>
        </div>

        {/* quick facts */}
        <div className="grid grid-cols-2 gap-px border-t border-ink-100 bg-ink-50 sm:grid-cols-3">
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-semibold text-ink-400">{t('patient.nextAppointment')}</p>
            <p className="mt-0.5 font-bold text-ink-800">{nextAppt ? dayLabel(nextAppt.start, lang, t) : t('patient.noNext')}</p>
          </div>
          {bal && (
            <div className="bg-white px-5 py-3">
              <p className="text-xs font-semibold text-ink-400">{t('patient.balance')}</p>
              <p className={`mt-0.5 font-bold ${bal.debt > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {bal.debt > 0 ? money(bal.debt, currency) : t('pay.settled')}
              </p>
            </div>
          )}
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-semibold text-ink-400">{t('patient.complaint')}</p>
            <p className="mt-0.5 line-clamp-1 font-bold text-ink-800">{patient.complaint || '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {visibleTabs.map((tb) => {
          const locked = tb.feature && !can(tb.feature)
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                tab === tb.id ? 'bg-brand-600 text-white shadow-soft' : 'bg-white text-ink-500 hover:text-brand-600'
              }`}
            >
              <tb.icon size={16} /> {t(`patient.${tb.key}`)}
              {locked && <span className="text-amber-300">🔒</span>}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="page-enter" key={tab}>
        {tab === 'overview' && <Overview patient={patient} onTab={setTab} />}
        {tab === 'history' && <HistoryForm patient={patient} />}
        {tab === 'chart' && <DentalChart patient={patient} />}
        {tab === 'perio' && <FeatureLock feature="perio"><PerioChart patient={patient} /></FeatureLock>}
        {tab === 'treatments' && <TreatmentsPanel patient={patient} />}
        {tab === 'consent' && <FeatureLock feature="consent"><ConsentForm patient={patient} /></FeatureLock>}
        {tab === 'payments' && <FeatureLock feature="clinicBalances"><PaymentsPanel patient={patient} /></FeatureLock>}
        {tab === 'gallery' && <Gallery patient={patient} />}
        {tab === 'timeline' && <Timeline patient={patient} />}
      </div>

      <PatientFormModal open={editOpen} onClose={() => setEditOpen(false)} patient={patient} />
    </div>
  )
}
