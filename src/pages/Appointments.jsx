import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Plus, CalendarPlus, Phone, Clock, User, Dot, CalendarDays,
} from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isSameDay, isToday, format,
} from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import FeatureLock from '../components/FeatureLock'
import AppointmentModal from '../components/AppointmentModal'
import PageHero from '../components/PageHero'
import { Avatar, EmptyState } from '../components/ui'
import { fmtTime, fmtDateLong, parseISO } from '../lib/dates'
import { cx } from '../lib/utils'

export default function Appointments() {
  return (
    <FeatureLock feature="appointments">
      <Calendar />
    </FeatureLock>
  )
}

function Calendar() {
  const { t, lang, isRTL } = useI18n()
  const navigate = useNavigate()
  const { appointments, doctors, getPatient, getDoctor, can } = useStore()
  const locale = lang === 'ar' ? ar : enUS
  const [cursor, setCursor] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [docFilter, setDocFilter] = useState('all')
  const [modal, setModal] = useState(null) // { appt } | { date }

  const Prev = isRTL ? ChevronRight : ChevronLeft
  const Next = isRTL ? ChevronLeft : ChevronRight

  const filtered = useMemo(
    () => appointments.filter((a) => docFilter === 'all' || a.doctorId === docFilter),
    [appointments, docFilter]
  )

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { locale })
    const end = endOfWeek(endOfMonth(cursor), { locale })
    return eachDayOfInterval({ start, end })
  }, [cursor, locale])

  const apptsByDay = useMemo(() => {
    const map = {}
    filtered.forEach((a) => {
      const key = format(parseISO(a.start), 'yyyy-MM-dd')
      ;(map[key] ||= []).push(a)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.start.localeCompare(b.start)))
    return map
  }, [filtered])

  const weekdays = useMemo(() => {
    const start = startOfWeek(new Date(), { locale })
    return Array.from({ length: 7 }, (_, i) => format(eachDayOfInterval({ start, end: endOfWeek(new Date(), { locale }) })[i], 'EEEEEE', { locale }))
  }, [locale])

  const dayAppts = (apptsByDay[format(selectedDay, 'yyyy-MM-dd')] || [])
  const monthCount = filtered.filter((a) => isSameMonth(parseISO(a.start), cursor)).length

  return (
    <div className="space-y-4">
      <PageHero
        icon={<CalendarDays size={22} />}
        title={t('nav.appointments')}
        subtitle={lang === 'ar' ? `${monthCount} موعد هذا الشهر` : `${monthCount} appointments this month`}
        actions={<button onClick={() => setModal({ date: selectedDay })} className="btn bg-white font-bold text-brand-700 hover:bg-white/90"><Plus size={16} /> {t('appt.new')}</button>}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Prev size={18} /></button>
          <h2 className="min-w-[150px] text-center text-lg font-extrabold text-ink-800">{format(cursor, 'MMMM yyyy', { locale })}</h2>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Next size={18} /></button>
        </div>
        <button onClick={() => { setCursor(new Date()); setSelectedDay(new Date()) }} className="btn-outline !py-2">{t('appt.today')}</button>
      </div>

      {/* Doctor legend / filter */}
      {can('multiDoctor') && doctors.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink-400">{t('appt.legendDoctors')}:</span>
          <button onClick={() => setDocFilter('all')} className={cx('chip', docFilter === 'all' ? 'bg-ink-800 text-white' : 'bg-ink-100 text-ink-500')}>{t('appt.allDoctors')}</button>
          {doctors.map((d) => (
            <button key={d.id} onClick={() => setDocFilter(d.id)}
              className={cx('chip', docFilter === d.id ? 'text-white' : 'bg-white')}
              style={docFilter === d.id ? { background: d.color } : { color: d.color, border: `1px solid ${d.color}40` }}>
              <span className="h-2 w-2 rounded-full" style={{ background: docFilter === d.id ? '#fff' : d.color }} />
              {(lang === 'ar' ? d.nameAr : d.name)?.replace(/Dr\. |د\. /, '')}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Month grid */}
        <div className="card overflow-hidden p-3 lg:col-span-2">
          <div className="grid grid-cols-7">
            {weekdays.map((w, i) => (
              <div key={i} className="pb-2 text-center text-xs font-bold uppercase text-ink-400">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const list = apptsByDay[key] || []
              const inMonth = isSameMonth(day, cursor)
              const selected = isSameDay(day, selectedDay)
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  onDoubleClick={() => setModal({ date: day })}
                  className={cx(
                    'flex min-h-[76px] flex-col rounded-xl border p-1.5 text-start transition-all',
                    selected ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-400/20' : 'border-transparent hover:bg-ink-50',
                    !inMonth && 'opacity-40'
                  )}
                >
                  <span className={cx('mb-1 flex h-6 w-6 items-center justify-center self-end rounded-full text-xs font-bold',
                    isToday(day) ? 'bg-brand-600 text-white' : 'text-ink-500')}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    {list.slice(0, 3).map((a) => {
                      const d = getDoctor(a.doctorId); const p = getPatient(a.patientId)
                      return (
                        <span key={a.id} onClick={(e) => { e.stopPropagation(); setModal({ appt: a }) }}
                          className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                          style={{ background: a.status === 'cancelled' ? '#cbd5e1' : (d?.color || '#0d9488') }}>
                          <span className="shrink-0">{fmtTime(a.start, lang).replace(/\s?[AP]M/i, '')}</span>
                          <span className="truncate">{(lang === 'ar' ? p?.nameAr || p?.name : p?.name) || ''}</span>
                        </span>
                      )
                    })}
                    {list.length > 3 && <span className="px-1 text-[10px] font-bold text-ink-400">+{list.length - 3}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Day agenda */}
        <div className="card overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-xs font-semibold text-ink-400">{t('appt.title')}</p>
            <h3 className="font-bold text-ink-800">{fmtDateLong(selectedDay, lang)}</h3>
          </div>
          <div className="max-h-[460px] divide-y divide-ink-50 overflow-y-auto">
            {dayAppts.length === 0 ? (
              <EmptyState icon={<CalendarPlus size={24} />} title={t('appt.noAppointments')}
                action={<button onClick={() => setModal({ date: selectedDay })} className="btn-soft"><Plus size={15} /> {t('appt.new')}</button>} />
            ) : dayAppts.map((a) => {
              const p = getPatient(a.patientId); const d = getDoctor(a.doctorId)
              return (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 self-stretch rounded-full" style={{ background: d?.color }} />
                    <Avatar name={p?.name} size={34} />
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setModal({ appt: a })}>
                      <p className="truncate text-sm font-bold text-ink-800">{lang === 'ar' ? p?.nameAr || p?.name : p?.name}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-400"><Clock size={11} /> {fmtTime(a.start, lang)} · {a.reason}</p>
                    </div>
                  </div>
                  {(a.step || can('multiDoctor')) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 ps-7 text-xs">
                      {can('multiDoctor') && d && <span className="font-semibold" style={{ color: d.color }}>{lang === 'ar' ? d.nameAr : d.name}</span>}
                      {a.step && <span className="rounded bg-ink-100 px-1.5 py-0.5 text-ink-500">{t('appt.step')}: {a.step}</span>}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2 ps-7">
                    <a href={`tel:${p?.phone}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline"><Phone size={12} /> {p?.phone}</a>
                    <button onClick={() => navigate(`/patients/${p?.id}`)} className="text-xs font-bold text-ink-400 hover:text-brand-600">{t('dashboard.viewPatient')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <AppointmentModal
        open={!!modal}
        onClose={() => setModal(null)}
        appointment={modal?.appt}
        defaultDate={modal?.date}
      />
    </div>
  )
}
