import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sparkles, Building2, UserPlus, CalendarPlus, Check, ChevronDown, ArrowUpLeft, X } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { useReduceMotion } from '../lib/motionPref'
import { ONBOARDING_EVENT, onboardingKey, readOnboarding, writeOnboarding, initialOnboarding, onboardingSteps } from '../lib/onboarding'

export default function GettingStarted() {
  const { clinic, currentUser, readOnly, patients, appointments, can } = useStore()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const key = onboardingKey(clinic?.id, currentUser?.id)
  if (!clinic || !currentUser || readOnly) return null
  return <GettingStartedCard key={key} scope={key} initial={{ patients, appointments }} ar={lang === 'ar'} allowAppointments={can('appointments')} onNavigate={navigate} />
}

export function GettingStartedCard({ scope, initial, ar, allowAppointments, onNavigate }) {
  const [progress, setProgress] = useState(() => ({ ...initialOnboarding(initial),
    collapsed: window.matchMedia('(max-width: 639px)').matches, ...readOnboarding(scope) }))
  const systemReduce = useReducedMotion()
  const [performanceMode] = useReduceMotion()
  const reduce = systemReduce || performanceMode
  useEffect(() => {
    // Persist the initial eligibility before optimistic patient drafts can appear.
    if (!readOnboarding(scope)) writeOnboarding(scope, progress)
    const sync = () => setProgress(p => ({ ...p, ...readOnboarding(scope) }))
    window.addEventListener(ONBOARDING_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(ONBOARDING_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [scope])
  const steps = onboardingSteps(progress, allowAppointments)
  const done = steps.filter(s => s.done).length
  const complete = done === steps.length
  useEffect(() => {
    if (!complete || progress.dismissed) return
    const timer = setTimeout(() => writeOnboarding(scope, { dismissed: true }), 1400)
    return () => clearTimeout(timer)
  }, [complete, progress.dismissed, scope])
  const labels = ar ? { clinic: 'إعداد العيادة', patient: 'إضافة أول مريض', appointment: 'حجز أول موعد' }
    : { clinic: 'Set up your clinic', patient: 'Add your first patient', appointment: 'Book your first visit' }
  const icons = { clinic: Building2, patient: UserPlus, appointment: CalendarPlus }
  const paths = { clinic: '/settings', patient: '/patients', appointment: '/appointments' }
  const title = ar ? 'بداية عيادتك' : 'Getting started'
  const patch = value => { setProgress(p => ({ ...p, ...value })); writeOnboarding(scope, value) }
  return <div dir={ar ? 'rtl' : 'ltr'} className="pointer-events-none fixed end-3 z-30 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:end-5 lg:bottom-5">
    <AnimatePresence initial={false} mode="wait">
      {!progress.dismissed && (progress.collapsed ?
        <motion.button key="pill" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => patch({ collapsed: false })} aria-expanded="false" aria-label={title}
          className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 text-xs font-bold text-brand-700 shadow-card">
          <Sparkles size={16} />{title}<span className="text-ink-400">{done}/{steps.length}</span>
        </motion.button> :
        <motion.section key="card" aria-label={title} initial={{ opacity: 0, y: reduce ? 0 : 12 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : 8 }} transition={{ duration: reduce ? 0 : .2 }}
          className="pointer-events-auto w-[252px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_8px_32px_-8px_rgba(15,118,110,0.22)]">
          <div className="flex items-center gap-2 px-3 pt-2">
            <Sparkles size={16} className="shrink-0 text-brand-600" /><h2 className="flex-1 text-xs font-extrabold text-ink-800">{title}</h2>
            <button type="button" onClick={() => patch({ collapsed: true })} aria-label={ar ? 'تصغير خطوات البداية' : 'Minimize setup'} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50"><ChevronDown size={16} /></button>
            <button type="button" onClick={() => patch({ dismissed: true })} aria-label={ar ? 'إخفاء خطوات البداية' : 'Dismiss setup'} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50"><X size={14} /></button>
          </div>
          <div className="px-3 pb-2"><p role="status" className="mb-2 text-[11px] text-ink-500">{complete ? (ar ? 'جاهز، بداية موفّقة!' : 'You’re ready to go!') : (ar ? `${done} من ${steps.length} مكتمل` : `${done} of ${steps.length} complete`)}</p>
            <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} className="h-1 overflow-hidden rounded-full bg-brand-50"><div className="h-full rounded-full bg-brand-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${done / steps.length * 100}%` }} /></div>
          </div>
          <div className="space-y-0.5 px-2 pb-2">{steps.map(({ id, done: finished }) => { const Icon = finished ? Check : icons[id]; return <button key={id} type="button" disabled={finished}
            onClick={() => { patch({ collapsed: true }); onNavigate(paths[id], { state: { onboarding: id } }) }}
            className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-start text-xs font-semibold transition-colors ${finished ? 'text-brand-600' : 'text-ink-700 hover:bg-brand-50'}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${finished ? 'bg-brand-50' : 'bg-ink-50'}`}><Icon size={14} /></span><span className="flex-1">{labels[id]}</span>{finished ? <span className="text-[10px]">{ar ? 'تم' : 'Done'}</span> : <ArrowUpLeft size={13} className={ar ? '' : '-rotate-90'} />}
          </button> })}</div>
        </motion.section>)}
    </AnimatePresence>
  </div>
}
