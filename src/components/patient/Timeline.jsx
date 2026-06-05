import { useMemo } from 'react'
import { Stethoscope, CalendarDays, Wallet, Flag } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { recordName, recordColor } from '../../lib/treatments'
import { getTooth } from '../../lib/teeth'
import { EmptyState, Badge } from '../ui'
import { fmtDate, fmtTime } from '../../lib/dates'
import { money } from '../../lib/utils'

export default function Timeline({ patient }) {
  const { t, lang } = useI18n()
  const { recordsForPatient, apptsForPatient, paymentsForPatient, getDoctor, clinic } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'

  const events = useMemo(() => {
    const ev = []
    recordsForPatient(patient.id).forEach((r) => {
      const tooth = r.toothId && r.toothId !== '0' ? getTooth(r.toothId) : null
      ev.push({
        id: r.id, type: 'record', date: r.date, color: recordColor(r),
        title: recordName(r, lang),
        sub: [tooth ? `${t('chart.tooth')} ${tooth.label}` : null, r.kind === 'condition' ? t('chart.condition') : null].filter(Boolean).join(' · '),
        status: r.status, doctorId: r.doctorId, price: r.price, notes: r.notes,
      })
    })
    apptsForPatient(patient.id).forEach((a) => {
      ev.push({
        id: a.id, type: 'appt', date: a.start, color: '#6366f1',
        title: a.reason || t('appt.title'), sub: a.step ? `${t('appt.step')}: ${a.step}` : '',
        status: a.status, doctorId: a.doctorId, notes: a.notes, time: true,
      })
    })
    paymentsForPatient(patient.id).forEach((p) => {
      ev.push({ id: p.id, type: 'pay', date: p.date, color: '#16a34a', title: money(p.amount, currency), sub: p.note, doctorId: p.doctorId })
    })
    return ev.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [patient.id, recordsForPatient, apptsForPatient, paymentsForPatient, lang, t, currency])

  const icons = { record: Stethoscope, appt: CalendarDays, pay: Wallet }

  if (events.length === 0) return <div className="card"><EmptyState icon={<Flag size={26} />} title={t('chart.noEntries')} /></div>

  return (
    <div className="card p-5">
      <div className="relative ps-6">
        <div className="absolute bottom-2 top-2 w-px bg-ink-100 start-[7px]" />
        <div className="space-y-5">
          {events.map((e) => {
            const Icon = icons[e.type]; const doc = getDoctor(e.doctorId)
            return (
              <div key={e.id} className="relative">
                <span className="absolute top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white start-[-22px]" style={{ background: e.color }} />
                <div className="flex flex-wrap items-center gap-2">
                  <Icon size={15} style={{ color: e.color }} />
                  <span className="font-bold text-ink-800">{e.title}</span>
                  {e.status && <Badge color={e.status === 'done' || e.status === 'completed' ? 'green' : 'amber'}>{e.status === 'done' || e.status === 'completed' ? t('chart.done') : t('chart.planned')}</Badge>}
                  {e.price > 0 && <Badge color="brand">{money(e.price, currency)}</Badge>}
                  <span className="ms-auto text-xs text-ink-400">{e.time ? `${fmtDate(e.date, lang)} · ${fmtTime(e.date, lang)}` : fmtDate(e.date, lang)}</span>
                </div>
                {e.sub && <p className="mt-0.5 text-sm text-ink-500">{e.sub}</p>}
                {e.notes && <p className="mt-0.5 text-sm text-ink-400">{e.notes}</p>}
                {doc && <p className="mt-0.5 text-xs font-semibold" style={{ color: doc.color }}>{t('chart.performedBy')} {lang === 'ar' ? doc.nameAr : doc.name}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
