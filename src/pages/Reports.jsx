import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  CartesianGrid, AreaChart, Area,
} from 'recharts'
import { ChevronLeft, ChevronRight, Users, UserPlus, CalendarDays, TrendingUp, Receipt, Percent, Stethoscope, BarChart3 } from 'lucide-react'
import { startOfMonth, endOfMonth, addMonths, subMonths, format, getDaysInMonth, getDate } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import FeatureLock from '../components/FeatureLock'
import PageHero from '../components/PageHero'
import { recordName, recordColor } from '../lib/treatments'
import { money, PAYMENT_METHODS } from '../lib/utils'
import { parseISO } from '../lib/dates'

export default function Reports() {
  return <FeatureLock feature="reports"><ReportsInner /></FeatureLock>
}

function ReportsInner() {
  const { t, lang, L, isRTL } = useI18n()
  const { patients, appointments, payments, toothRecords, doctors, getDoctor, clinic } = useStore()
  const locale = lang === 'ar' ? ar : enUS
  const currency = clinic?.settings?.currency || 'JOD'
  const [cursor, setCursor] = useState(new Date())
  const Prev = isRTL ? ChevronRight : ChevronLeft
  const Next = isRTL ? ChevronLeft : ChevronRight

  const { start, end } = useMemo(() => ({ start: startOfMonth(cursor), end: endOfMonth(cursor) }), [cursor])
  const inMonth = (iso) => { const d = parseISO(iso); return d >= start && d <= end }

  const monthPayments = useMemo(() => payments.filter((p) => inMonth(p.date)), [payments, start, end])
  const monthRecords = useMemo(() => toothRecords.filter((r) => r.status === 'done' && inMonth(r.date)), [toothRecords, start, end])
  const monthAppts = useMemo(() => appointments.filter((a) => inMonth(a.start)), [appointments, start, end])
  const newPatients = useMemo(() => patients.filter((p) => inMonth(p.createdAt)), [patients, start, end])

  const revenue = monthPayments.reduce((s, p) => s + p.amount, 0)
  const billed = monthRecords.reduce((s, r) => s + (r.price || 0), 0)
  const patientsSeen = new Set(monthAppts.map((a) => a.patientId)).size
  const collectionRate = billed > 0 ? Math.round((revenue / billed) * 100) : 0

  // Daily revenue
  const dailyData = useMemo(() => {
    const days = getDaysInMonth(cursor)
    const arr = Array.from({ length: days }, (_, i) => ({ day: i + 1, value: 0 }))
    monthPayments.forEach((p) => { arr[getDate(parseISO(p.date)) - 1].value += p.amount })
    return arr
  }, [monthPayments, cursor])

  // By treatment
  const byTreatment = useMemo(() => {
    const m = {}
    monthRecords.forEach((r) => {
      const name = recordName(r, lang)
      m[name] = m[name] || { name, count: 0, color: recordColor(r) }
      m[name].count += 1
    })
    return Object.values(m).sort((a, b) => b.count - a.count).slice(0, 7)
  }, [monthRecords, lang])

  // Payment methods
  const byMethod = useMemo(() => {
    const m = {}
    monthPayments.forEach((p) => (p.methods || []).forEach((x) => { m[x.method] = (m[x.method] || 0) + x.amount }))
    if (Object.keys(m).length === 0 && revenue > 0) m.cash = revenue
    return Object.entries(m).map(([k, v]) => ({ name: L(PAYMENT_METHODS[k] || { en: k }), value: v, key: k }))
  }, [monthPayments, revenue, lang])

  // By doctor
  const byDoctor = useMemo(() => {
    const m = {}
    monthPayments.forEach((p) => { m[p.doctorId] = (m[p.doctorId] || 0) + p.amount })
    return doctors.map((d) => ({ name: (lang === 'ar' ? d.nameAr : d.name)?.replace(/Dr\. |د\. /, ''), value: m[d.id] || 0, color: d.color }))
      .filter((x) => x.value > 0)
  }, [monthPayments, doctors, lang])

  const METHOD_COLORS = { cash: '#16a34a', card: '#3b82f6', insurance: '#8b5cf6', cheque: '#f59e0b' }

  return (
    <div className="space-y-6">
      <PageHero
        icon={<BarChart3 size={22} />}
        title={t('nav.reports')}
        subtitle={format(cursor, 'MMMM yyyy', { locale })}
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-white/15 p-1 backdrop-blur">
            <button onClick={() => setCursor(subMonths(cursor, 1))} className="rounded-lg p-1.5 text-white hover:bg-white/15"><Prev size={18} /></button>
            <span className="min-w-[120px] text-center text-sm font-bold text-white">{format(cursor, 'MMMM yyyy', { locale })}</span>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-lg p-1.5 text-white hover:bg-white/15"><Next size={18} /></button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t('reports.patientsSeen'), value: patientsSeen, icon: Users },
            { label: t('reports.newPatients'), value: newPatients.length, icon: UserPlus },
            { label: t('reports.appointments'), value: monthAppts.length, icon: CalendarDays },
            { label: t('reports.revenue'), value: money(revenue, currency), icon: TrendingUp },
            { label: t('reports.billed'), value: money(billed, currency), icon: Receipt },
            { label: t('reports.collectionRate'), value: `${collectionRate}%`, icon: Percent },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl bg-white/10 p-3 backdrop-blur ring-1 ring-white/10">
              <div className="flex items-center gap-1.5 text-white/70"><k.icon size={14} /><span className="text-[11px] font-semibold">{k.label}</span></div>
              <p className="mt-1 text-lg font-extrabold">{k.value}</p>
            </div>
          ))}
        </div>
      </PageHero>

      <div className="card p-5">
        <h3 className="mb-4 font-bold text-ink-800">{t('reports.dailyRevenue')}</h3>
        <div style={{ direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData} margin={{ left: -18, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => money(v, currency)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-ink-800">{t('reports.byTreatment')}</h3>
          {byTreatment.length === 0 ? <Empty t={t} /> : (
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byTreatment} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {byTreatment.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-bold text-ink-800">{t('reports.paymentMethods')}</h3>
          {byMethod.length === 0 ? <Empty t={t} /> : (
            <div style={{ direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {byMethod.map((e, i) => <Cell key={i} fill={METHOD_COLORS[e.key] || '#0d9488'} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v, currency)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3">
                {byMethod.map((e, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: METHOD_COLORS[e.key] || '#0d9488' }} /> {e.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {byDoctor.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 font-bold text-ink-800">{t('reports.byDoctor')}</h3>
          <div className="space-y-3">
            {byDoctor.map((d, i) => {
              const max = Math.max(...byDoctor.map((x) => x.value))
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm font-semibold text-ink-600">{d.name}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-ink-50">
                    <motion.div className="flex h-full items-center justify-end rounded-lg px-2 text-xs font-bold text-white"
                      initial={{ width: 0 }} whileInView={{ width: `${(d.value / max) * 100}%` }} viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.08 }}
                      style={{ background: d.color, minWidth: 40 }}>
                      {money(d.value, currency)}
                    </motion.div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ t }) {
  return <div className="flex h-40 items-center justify-center text-sm text-ink-400">{t('reports.noData')}</div>
}
