import { AlertTriangle, Sparkles, Activity, Pill, ShieldAlert, ArrowUpRight, Grid3x3 } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { computePriorityTeeth } from '../../lib/clinical'
import { DENTAL_ITEMS } from '../../lib/treatments'
import { SYSTEMS_HISTORY, ALLERGIES, MEDICATIONS } from '../../lib/history'
import FeatureLock from '../FeatureLock'
import { Badge } from '../ui'
import { fmtDate } from '../../lib/dates'

// High-risk systemic flags worth surfacing prominently.
const RISK_KEYS = ['anticoagulant', 'valve', 'diabetes1', 'diabetes2', 'bisphosphonates', 'hemophilia', 'pacemaker', 'radiotherapy']

export default function Overview({ patient, onTab }) {
  const { t, lang, L } = useI18n()
  const { recordsForPatient, can } = useStore()
  const records = recordsForPatient(patient.id)
  const priority = computePriorityTeeth(records, 3)

  // Build medical alerts
  const alerts = []
  const allerg = patient.history?.allergies || []
  allerg.forEach((k) => {
    const o = ALLERGIES.options.find((x) => x.key === k)
    if (o) alerts.push({ type: 'allergy', label: L(o) })
  })
  const systems = patient.history?.systems || {}
  Object.values(systems).flat().forEach((k) => {
    if (RISK_KEYS.includes(k)) {
      for (const g of SYSTEMS_HISTORY.groups) {
        const o = g.options.find((x) => x.key === k)
        if (o) { alerts.push({ type: 'risk', label: L(o) }); break }
      }
    }
  })
  if (patient.history?.medical?.pregnant) alerts.push({ type: 'risk', label: lang === 'ar' ? 'حامل' : 'Pregnant' })

  const meds = (patient.history?.medications || []).map((k) => L(MEDICATIONS.options.find((x) => x.key === k) || { en: k, ar: k }))

  const recent = [...records].filter((r) => r.toothId !== '0' || r.itemKey)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5)

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Priority teeth */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3.5">
            <Sparkles size={18} className="text-amber-500" />
            <h3 className="font-bold text-ink-800">{t('patient.priorityTeeth')}</h3>
          </div>
          <div className="p-4">
            <FeatureLock feature="priorityTeeth" soft>
              {priority.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-400">{t('patient.noPriority')}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {priority.map((p, i) => (
                    <button key={p.toothId} onClick={() => onTab('chart')}
                      className="group rounded-xl border border-ink-100 bg-gradient-to-br from-rose-50/50 to-white p-3 text-start transition-all hover:border-rose-200 hover:shadow-soft">
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-sm font-extrabold text-white">{i + 1}</span>
                        <span className="text-xs font-bold text-ink-400">{t('chart.tooth')} {p.tooth?.label}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.reasons.slice(0, 2).map((r) => (
                          <span key={r} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-600">
                            <span className="h-2 w-2 rounded-full" style={{ background: DENTAL_ITEMS[r]?.color }} />
                            {DENTAL_ITEMS[r]?.[lang]}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </FeatureLock>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
            <h3 className="flex items-center gap-2 font-bold text-ink-800"><Activity size={18} className="text-brand-500" /> {t('patient.timeline')}</h3>
            <button onClick={() => onTab('timeline')} className="text-sm font-bold text-brand-600 hover:underline">{t('common.view')}</button>
          </div>
          <div className="divide-y divide-ink-50">
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">{t('chart.noEntries')}</p>
            ) : recent.map((r) => {
              const it = DENTAL_ITEMS[r.itemKey]; const tooth = r.toothId !== '0' ? r.toothId : null
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: it?.color || '#cbd5e1' }} />
                  <span className="flex-1 text-sm font-semibold text-ink-700">{it?.[lang] || r.itemKey}</span>
                  <Badge color={r.status === 'done' ? 'green' : 'amber'}>{r.status === 'done' ? t('chart.done') : t('chart.planned')}</Badge>
                  <span className="text-xs text-ink-400">{fmtDate(r.date, lang)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Side: alerts */}
      <div className="space-y-5">
        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-ink-800"><ShieldAlert size={18} className="text-rose-500" /> {lang === 'ar' ? 'تنبيهات طبية' : 'Medical alerts'}</h3>
          {alerts.length === 0 ? (
            <p className="py-3 text-center text-sm text-ink-400">{lang === 'ar' ? 'لا تنبيهات' : 'No alerts'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600">
                  <AlertTriangle size={12} /> {a.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-ink-800"><Pill size={18} className="text-brand-500" /> {L(MEDICATIONS.title)}</h3>
          {meds.length === 0 ? (
            <p className="py-3 text-center text-sm text-ink-400">—</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {meds.map((m, i) => <Badge key={i} color="brand">{m}</Badge>)}
            </div>
          )}
          <button onClick={() => onTab('history')} className="btn-ghost mt-3 w-full text-brand-600"><ArrowUpRight size={15} /> {t('patient.history')}</button>
        </div>
      </div>
    </div>
  )
}
