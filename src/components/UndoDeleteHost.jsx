import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, Trash2, Undo2 } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { useReduceMotion } from '../lib/motionPref'

export default function UndoDeleteHost() {
  const { pendingDeletes, undoDelete, saveStatus } = useStore()
  const { lang } = useI18n()
  const ar = lang === 'ar'
  const systemReduce = useReducedMotion()
  const [performanceMode] = useReduceMotion()
  const reduce = systemReduce || performanceMode
  return (
    <div dir={ar ? 'rtl' : 'ltr'} aria-label={ar ? 'التراجع عن الحذف' : 'Undo deletion'}
      className={`pointer-events-none fixed inset-x-3 z-[110] mx-auto flex max-h-[45vh] max-w-md flex-col gap-2 overflow-y-auto pb-2 sm:inset-x-6 ${saveStatus.pending || saveStatus.failed ? 'bottom-24' : 'bottom-5'}`}>
      <AnimatePresence initial={false}>
        {pendingDeletes.map((item) => {
          const busy = item.status === 'committing'
          return (
            <motion.div key={item.key} layout
              initial={{ opacity: 0, y: reduce ? 0 : 20, scale: reduce ? 1 : 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.98, transition: { duration: 0.2 } }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto relative shrink-0 overflow-hidden rounded-2xl border border-brand-200/80 bg-white/95 p-4 shadow-[0_12px_36px_-12px_rgba(15,118,110,0.35)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {busy ? <Loader2 size={19} className="animate-spin" /> : <Trash2 size={19} />}
                </span>
                <div className="min-w-0 flex-1" role="status" aria-live="polite" aria-atomic="true">
                  <p className="text-sm font-bold text-ink-800">{busy ? (ar ? 'جارٍ تأكيد الحذف…' : 'Confirming deletion…')
                    : item.kind === 'patient' ? (ar ? 'تم حذف ملف المريض' : 'Patient file deleted')
                    : item.kind === 'expense' ? (ar ? 'تم حذف المصروف' : 'Expense deleted')
                    : item.kind === 'appointment' ? (ar ? 'تم حذف الموعد' : 'Appointment removed') : (ar ? 'تم حذف العلاج' : 'Treatment removed')}</p>
                  <p className="mt-1 text-xs text-ink-500">{busy ? (ar ? 'بانتظار تأكيد الحفظ' : 'Waiting for confirmation') : (ar ? 'يمكنك التراجع خلال 10 ثوانٍ' : 'You can undo within 10 seconds')}</p>
                </div>
                <motion.button type="button" disabled={busy} onClick={() => undoDelete(item.key)}
                  whileHover={reduce || busy ? {} : { y: -1 }} whileTap={reduce || busy ? {} : { scale: 0.96 }}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-40">
                  <Undo2 size={17} /><span>{ar ? 'تراجع' : 'Undo'}</span>
                </motion.button>
              </div>
              {!busy && <motion.div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-brand-400 to-brand-600"
                initial={{ scaleX: Math.max(0, (item.deadline - Date.now()) / 10000) }} animate={{ scaleX: 0 }}
                transition={{ duration: Math.max(0, (item.deadline - Date.now()) / 1000), ease: 'linear' }} />}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
