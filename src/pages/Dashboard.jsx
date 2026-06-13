import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, Wallet, CalendarDays, TrendingUp, Phone, Clock, ArrowLeft, ArrowRight,
  UserPlus, CalendarPlus, CircleDollarSign, Stethoscope, CheckCircle2,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Stat, Avatar, EmptyState, Badge } from '../components/ui'
import { stagger, staggerItem, Sparkline } from '../components/anim'
import { fmtTime, fmtDate, isToday, isTomorrow, isSameDay, parseISO } from '../lib/dates'
import { money } from '../lib/utils'
import PatientFormModal from '../components/PatientFormModal'

export default function Dashboard() {
  const { t, lang, isRTL } = useI18n()
  const navigate = useNavigate()
  const { currentUser, clinic, can, patients, appointments, payments, getPatient, getDoctor, balanceForPatient } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const currency = clinic?.settings?.currency || 'JOD'
  const Arrow = isRTL ? ArrowLeft : ArrowRight

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return t('dashboard.goodMorning')
    if (h < 18) return t('dashboard.goodAfternoon')
    return t('dashboard.goodEvening')
  }, [t])

  const todayAppts = useMemo(
    () => appointments.filter((a) => isToday(parseISO(a.start)) && a.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start)),
    [appointments]
  )
  const tomorrowAppts = useMemo(
    () => appointments.filter((a) => isTomorrow(parseISO(a.start)) && a.status !== 'cancelled').sort((a, b) => a.start.localeCompare(b.start)),
    [appointments]
  )
  const weekCount = useMemo(() => {
    const now = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 7)
    return appointments.filter((a) => { const d = parseISO(a.start); return d >= start && d < end }).length
  }, [appointments])

  const collectedThisMonth = useMemo(() => {
    const now = new Date()
    return payments
      .filter((p) => { const d = parseISO(p.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }, [payments])

  const balances = useMemo(() => {
    return patients
      .map((p) => ({ patient: p, ...balanceForPatient(p.id) }))
      .filter((b) => b.debt > 0)
      .sort((a, b) => b.debt - a.debt)
  }, [patients, balanceForPatient])

  const totalDue = balances.reduce((s, b) => s + b.debt, 0)

  const revTrend = useMemo(() => {
    const days = 14
    const arr = Array.from({ length: days }, () => 0)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    payments.forEach((p) => {
      const d = parseISO(p.date)
      const diff = Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
      if (diff >= 0 && diff < days) arr[days - 1 - diff] += Number(p.amount) || 0
    })
    return arr
  }, [payments])

  const name = (lang === 'ar' ? currentUser?.nameAr : currentUser?.name) || ''

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-400">{greeting} 👋</p>
          <h2 className="text-2xl font-extrabold text-ink-800">{name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAddOpen(true)} className="btn-primary"><UserPlus size={16} /> {t('dashboard.addPatient')}</button>
          {can('appointments') && (
            <button onClick={() => navigate('/appointments')} className="btn-outline"><CalendarPlus size={16} /> {t('dashboard.newAppointment')}</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div variants={staggerItem}>
          <Stat icon={<Users size={22} />} label={t('dashboard.totalPatients')} value={patients.length} color="brand" />
        </motion.div>
        {can('clinicBalances') && (
          <motion.div variants={staggerItem}>
            <Stat icon={<Wallet size={22} />} label={t('dashboard.totalDue')} value={money(totalDue, currency)} color="rose" />
          </motion.div>
        )}
        {can('reports') && (
          <motion.div variants={staggerItem}>
            <Stat icon={<TrendingUp size={22} />} label={t('dashboard.collectedThisMonth')} value={money(collectedThisMonth, currency)} color="green" />
          </motion.div>
        )}
        {can('appointments') && (
          <motion.div variants={staggerItem}>
            <Stat icon={<CalendarDays size={22} />} label={t('dashboard.appointmentsThisWeek')} value={weekCount} color="blue" />
          </motion.div>
        )}
      </motion.div>

      {/* Revenue trend */}
      {can('reports') && revTrend.some((v) => v > 0) && (
        <div className="card card-hover flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-400">{lang === 'ar' ? 'إيراد آخر ١٤ يوم' : 'Last 14 days'}</p>
            <p className="text-xl font-extrabold text-ink-800">{money(revTrend.reduce((a, b) => a + b, 0), currency)}</p>
          </div>
          <div style={{ direction: 'ltr' }}><Sparkline data={revTrend} width={150} height={42} /></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's appointments */}
        {can('appointments') ? (
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-ink-800"><Clock size={18} className="text-brand-500" /> {t('dashboard.todaysAppointments')}</h3>
              <Badge color="brand">{todayAppts.length}</Badge>
            </div>
            <div className="divide-y divide-ink-50">
              {todayAppts.length === 0 ? (
                <EmptyState icon={<CalendarDays size={26} />} title={t('dashboard.noAppointmentsToday')} />
              ) : (
                todayAppts.map((a) => {
                  const p = getPatient(a.patientId); const d = getDoctor(a.doctorId)
                  return (
                    <button key={a.id} onClick={() => navigate(`/patients/${a.patientId}`)} className="flex w-full items-center gap-3 px-5 py-3 text-start transition-colors hover:bg-ink-50/60">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-sm font-extrabold text-ink-700">{fmtTime(a.start, lang)}</p>
                      </div>
                      <Avatar name={p?.name} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink-800">{lang === 'ar' ? p?.nameAr || p?.name : p?.name}</p>
                        <p className="truncate text-xs text-ink-400">{a.reason}</p>
                      </div>
                      {can('multiDoctor') && d && (
                        <span className="chip" style={{ background: `${d.color}1a`, color: d.color }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {(lang === 'ar' ? d.nameAr : d.name)?.replace('Dr. ', '').replace('د. ', '')}
                        </span>
                      )}
                      <Arrow size={16} className="text-ink-300" />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <RecentPatients />
        )}

        {/* Tomorrow reminders */}
        {can('reminders') ? (
          <div className="card">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-ink-800"><Phone size={17} className="text-amber-500" /> {t('dashboard.tomorrowReminders')}</h3>
              <Badge color="amber">{tomorrowAppts.length}</Badge>
            </div>
            <div className="divide-y divide-ink-50">
              {tomorrowAppts.length === 0 ? (
                <EmptyState icon={<Phone size={24} />} title={t('dashboard.noTomorrow')} />
              ) : (
                tomorrowAppts.map((a) => {
                  const p = getPatient(a.patientId)
                  return (
                    <div key={a.id} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p?.name} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink-800">{lang === 'ar' ? p?.nameAr || p?.name : p?.name}</p>
                          <p className="text-xs text-ink-400">{fmtTime(a.start, lang)} · {a.reason}</p>
                        </div>
                      </div>
                      <a href={`tel:${p?.phone}`} className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                        <Phone size={13} /> {p?.phone} · {t('dashboard.callConfirm')}
                      </a>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <QuickUpgrade />
        )}
      </div>

      {/* Outstanding balances */}
      {can('clinicBalances') && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <h3 className="flex items-center gap-2 font-bold text-ink-800"><CircleDollarSign size={18} className="text-rose-500" /> {t('dashboard.outstanding')}</h3>
            <button onClick={() => navigate('/payments')} className="text-sm font-bold text-brand-600 hover:underline">{t('dashboard.whoOwes')}</button>
          </div>
          {balances.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={26} />} title={t('dashboard.nothingDue')} />
          ) : (
            <div className="grid gap-px bg-ink-50 sm:grid-cols-2 lg:grid-cols-3">
              {balances.slice(0, 6).map((b) => (
                <button key={b.patient.id} onClick={() => navigate(`/patients/${b.patient.id}`)} className="flex items-center gap-3 bg-white px-5 py-3 text-start hover:bg-rose-50/40">
                  <Avatar name={b.patient.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-800">{lang === 'ar' ? b.patient.nameAr || b.patient.name : b.patient.name}</p>
                    <p className="text-xs text-ink-400">{money(b.paid, currency)} {t('pay.paid')}</p>
                  </div>
                  <span className="font-extrabold text-rose-500">{money(b.debt, currency)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <PatientFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )

  function RecentPatients() {
    const recent = [...patients].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6)
    return (
      <div className="card lg:col-span-2">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h3 className="flex items-center gap-2 font-bold text-ink-800"><Users size={18} className="text-brand-500" /> {t('patient.patients')}</h3>
          <button onClick={() => navigate('/patients')} className="text-sm font-bold text-brand-600 hover:underline">{t('common.view')}</button>
        </div>
        <div className="divide-y divide-ink-50">
          {recent.length === 0 ? (
            <EmptyState icon={<Users size={26} />} title={t('patient.noPatients')} />
          ) : recent.map((p) => (
            <button key={p.id} onClick={() => navigate(`/patients/${p.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-ink-50/60">
              <Avatar name={p.name} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-800">{lang === 'ar' ? p.nameAr || p.name : p.name}</p>
                <p className="truncate text-xs text-ink-400">#{p.fileNo} · {p.complaint}</p>
              </div>
              <Arrow size={16} className="text-ink-300" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  function QuickUpgrade() {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><Stethoscope size={24} /></div>
        <p className="font-bold text-ink-700">{t('packages.title')}</p>
        <p className="text-sm text-ink-400">{t('packages.subtitle')}</p>
        <button onClick={() => navigate('/packages')} className="btn-soft">{t('common.upgrade')}</button>
      </div>
    )
  }
}
