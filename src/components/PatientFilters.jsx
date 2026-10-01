import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, Check, ChevronDown, SlidersHorizontal, UserPlus, Users, Wallet } from 'lucide-react'
import { useReduceMotion } from '../lib/motionPref'
import { cx } from '../lib/utils'

export default function PatientFilters({ value, onChange, counts, allowBalances, allowAppointments, lang }) {
  const ar = lang === 'ar'
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const panelId = useId()
  const systemReduce = useReducedMotion()
  const [performanceMode] = useReduceMotion()
  const reduce = systemReduce || performanceMode
  const options = [
    { id: 'all', icon: Users, label: ar ? 'جميع المرضى' : 'All patients', hint: ar ? 'عرض جميع الملفات' : 'Show every record' },
    allowBalances && { id: 'debt', icon: Wallet, label: ar ? 'عليهم مستحقات' : 'Outstanding balances', hint: ar ? 'مرضى لديهم رصيد غير مسدّد' : 'Patients with an unpaid balance' },
    allowAppointments && { id: 'today', icon: CalendarDays, label: ar ? 'مواعيد اليوم' : "Today's appointments", hint: ar ? 'باستثناء المواعيد الملغاة' : 'Excluding cancelled appointments' },
    { id: 'new', icon: UserPlus, label: ar ? 'مرضى جدد' : 'New patients', hint: ar ? 'المضافون خلال آخر 30 يومًا' : 'Added in the last 30 days' },
  ].filter(Boolean)

  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return (
    <div ref={root} className="relative z-20 shrink-0"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
      }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={cx('flex min-h-11 items-center gap-2.5 rounded-xl border px-4 py-2 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200',
          open || value !== 'all' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700')}>
        <SlidersHorizontal size={17} /><span lang="en">Filters</span>
        {value !== 'all' && <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] leading-none text-white" aria-label={ar ? 'فلتر واحد مفعّل' : 'One active filter'}>1</span>}
        <ChevronDown size={15} className={cx('transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <motion.div id={panelId} role="group" aria-label={ar ? 'الفلاتر المتاحة' : 'Available filters'} aria-hidden={!open} inert={open ? undefined : ''}
        initial={false} animate={{ opacity: open ? 1 : 0, y: open || reduce ? 0 : -6, scale: open || reduce ? 1 : 0.98 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{ pointerEvents: open ? 'auto' : 'none', transformOrigin: ar ? 'top right' : 'top left' }}
        className="absolute top-full mt-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-100 bg-white p-2 shadow-[0_14px_40px_-12px_rgba(15,23,42,0.25)] start-0">
        <p className="mb-1 border-b border-ink-100 px-3 pb-2.5 pt-2 text-xs font-bold text-ink-400">{ar ? 'الفلاتر المتاحة' : 'Available filters'}</p>
        {options.map((option) => {
          const active = value === option.id
          return <button key={option.id} type="button" aria-pressed={active}
            onClick={() => { onChange(option.id); setOpen(false); trigger.current?.focus() }}
            className={cx('my-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300', active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50')}>
            <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-brand-100/70' : 'bg-ink-50')}><option.icon size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{option.label}</span><span className="mt-0.5 block text-[11px] font-medium text-ink-400">{option.hint}</span></span>
            <span className={cx('min-w-6 rounded-md px-1.5 py-0.5 text-center text-xs font-bold tabular-nums', active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>{counts[option.id]}</span>
            <span className="w-3.5 shrink-0">{active && <Check size={14} aria-hidden="true" />}</span>
          </button>
        })}
      </motion.div>
    </div>
  )
}
