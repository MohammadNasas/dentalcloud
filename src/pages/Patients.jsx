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
import { money, waLink } from '../lib/utils'
import { fmtDate, dayLabel, parseISO, isToday, isTomorrow } from '../lib/dates'
import { exportAllPatients } from '../lib/wordExport'

export default function Patients() {
  const { t, lang, isRTL } = useI18n()
  const navigate = useNavigate()
  const { patients, appointments, clinic, can, balanceForPatient, getDoctor, recordsForPatient, paymentsForPatient } = useStore()
  const [q, setQ] = useState('')
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

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return patients
      .filter((p) =>
        !term ||
        p.name?.toLowerCase().includes(term) ||
        p.nameAr?.toLowerCase().includes(term) ||
        p.fileNo?.toLowerCase().includes(term) ||
        p.phone?.includes(term)
      )
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [patients, q])

  async function doExportAll() {
    setExporting(true)
    try { await exportAllPatients({ patients: list, clinic, lang, getDoctor, recordsForPatient, paymentsForPatient, balanceForPatient }) }
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
              <FileDown size={16} /> {t('export.exportAll')}
            </button>
            <button onClick={() => setAddOpen(true)} className="btn bg-white font-bold text-brand-700 hover:bg-white/90"><UserPlus size={16} /> {t('patient.addPatient')}</button>
          </>
        }
      >
        <SearchInput value={q} onChange={setQ} placeholder={t('patient.searchPlaceholder')} />
      </PageHero>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={28} />}
            title={q ? t('common.noResults') : t('patient.noPatients')}
            hint={!q && t('patient.addFirst')}
            action={!q && <button onClick={() => setAddOpen(true)} className="btn-primary"><UserPlus size={16} /> {t('patient.addPatient')}</button>}
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
