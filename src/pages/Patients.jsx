import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UserPlus, Users, FileDown, Phone, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Avatar, EmptyState, SearchInput, Badge } from '../components/ui'
import PatientFormModal from '../components/PatientFormModal'
import PageHero from '../components/PageHero'
import WhatsAppIcon from '../components/WhatsAppIcon'
import PatientFilters from '../components/PatientFilters'
import { money, waLink } from '../lib/utils'
import { filterPatients } from '../lib/patientFilters'
import { dayLabel, parseISO } from '../lib/dates'

export default function Patients() {
  const { t, lang, isRTL } = useI18n()
  const navigate = useNavigate()
  const { patients, appointments, clinic, can, balanceForPatient, getDoctor, recordsForPatient, paymentsForPatient } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const Chevron = isRTL ? ChevronLeft : ChevronRight
  const currency = clinic?.settings?.currency || 'JOD'

  const nextApptFor = useMemo(() => {
    const map = {}
    const now = new Date()
    appointments
      .filter((a) => parseISO(a.start) >= now && a.status === 'scheduled')
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((a) => { if (!map[a.patientId]) map[a.patientId] = a })
    return map
  }, [appointments])

  const allowBalances = can('clinicBalances')
  const allowAppointments = can('appointments')
  const localDay = new Date().toDateString()
  const { list, counts, activeFilter } = useMemo(() => filterPatients({
    patients, appointments, balanceForPatient, query: q, filter, allowBalances, allowAppointments,
  }), [patients, appointments, balanceForPatient, q, filter, allowBalances, allowAppointments, localDay])
  const filtered = Boolean(q.trim()) || activeFilter !== 'all'
  const filterLabel = {
    debt: lang === 'ar' ? 'عليهم مستحقات' : 'Outstanding balances',
    today: lang === 'ar' ? 'مواعيد اليوم' : "Today's appointments",
    new: lang === 'ar' ? 'آخر 30 يومًا' : 'Last 30 days',
  }[activeFilter]
  const clearFilters = () => { setQ(''); setFilter('all') }

  async function doExportAll() {
    setExporting(true)
    try { const { exportPatientsAsFiles } = await import('../lib/wordExport'); await exportPatientsAsFiles({ patients: list, clinic, lang, getDoctor, recordsForPatient, paymentsForPatient, balanceForPatient }) }
    finally { setExporting(false) }
  }

  const countLabel = lang === 'ar' ? `${patients.length} مريض` : `${patients.length} patients`

  return (
    <div className="space-y-5">
      <PageHero
        icon={<Users size={22} />}
        title={t('patient.patients')}
        subtitle={countLabel}
        actions={
          <>
            <button onClick={doExportAll} className="btn bg-white/15 font-bold text-white backdrop-blur hover:bg-white/25" disabled={exporting || list.length === 0}>
              <FileDown size={16} /> {filtered ? (lang === 'ar' ? `حفظ النتائج (${list.length}) · ZIP` : `Export results (${list.length}) · ZIP`) : t('export.exportAll')}
            </button>
            <button onClick={() => setAddOpen(true)} className="btn bg-white font-bold text-brand-700 hover:bg-white/90"><UserPlus size={16} /> {t('patient.addPatient')}</button>
          </>
        }
      >
        <SearchInput value={q} onChange={setQ} placeholder={t('patient.searchPlaceholder')} />
      </PageHero>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PatientFilters value={activeFilter} onChange={setFilter} counts={counts} allowBalances={allowBalances} allowAppointments={allowAppointments} lang={lang} />
        <p className="min-w-0 text-xs text-ink-500" role="status" aria-live="polite">
          {lang === 'ar' ? `عرض ${list.length} من ${patients.length} مريض` : `Showing ${list.length} of ${patients.length} patients`}
          {filterLabel && <span className="font-semibold text-brand-700"> · {filterLabel}</span>}
        </p>
        {filtered && <button type="button" onClick={clearFilters} className="min-h-11 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline ms-auto">{lang === 'ar' ? 'عرض الكل' : 'Show all'}</button>}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={28} />}
            title={filtered ? t('common.noResults') : t('patient.noPatients')}
            hint={filtered ? (lang === 'ar' ? 'جرّب فلترًا آخر أو عدّل البحث.' : 'Try another filter or change your search.') : t('patient.addFirst')}
            action={filtered ? <button type="button" onClick={clearFilters} className="btn-soft">{lang === 'ar' ? 'عرض الكل' : 'Show all'}</button> : <button onClick={() => setAddOpen(true)} className="btn-primary"><UserPlus size={16} /> {t('patient.addPatient')}</button>}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => {
            const bal = can('clinicBalances') ? balanceForPatient(p.id) : null
            const next = nextApptFor[p.id]
            const name = lang === 'ar' ? p.nameAr || p.name : p.name
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="card group overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <button onClick={() => navigate(`/patients/${p.id}`)} className="w-full p-4 text-start">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size={50} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink-800">{name}</p>
                      <p className="truncate text-xs text-ink-400">#{p.fileNo} {p.age ? `· ${p.age} ${lang === 'ar' ? 'سنة' : 'yrs'}` : ''}</p>
                    </div>
                    <Chevron size={18} className="text-ink-300 transition-colors group-hover:text-brand-500" />
                  </div>

                  {p.complaint && <p className="mt-3 line-clamp-1 text-sm text-ink-500">{p.complaint}</p>}

                  {(next || (bal && bal.fees > 0)) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {next && <Badge color="blue"><CalendarClock size={11} /> {dayLabel(next.start, lang, t)}</Badge>}
                      {bal && bal.debt > 0 && <Badge color="rose">{money(bal.debt, currency)}</Badge>}
                      {bal && bal.debt === 0 && bal.fees > 0 && <Badge color="green">{t('pay.settled')}</Badge>}
                    </div>
                  )}
                </button>

                {p.phone && (
                  <div className="flex border-t border-ink-100 text-xs font-bold">
                    <a href={waLink(p.phone, lang === 'ar' ? `مرحباً ${name}،` : `Hi ${name},`)} target="_blank" rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-emerald-600 hover:bg-emerald-50">
                      <WhatsAppIcon size={14} /> {lang === 'ar' ? 'واتساب' : 'WhatsApp'}
                    </a>
                    <a href={`tel:${p.phone.replace(/\s/g, '')}`}
                      className="flex flex-1 items-center justify-center gap-1.5 border-s border-ink-100 py-2.5 text-brand-600 hover:bg-brand-50">
                      <Phone size={14} /> {t('patient.call')}
                    </a>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      <PatientFormModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
