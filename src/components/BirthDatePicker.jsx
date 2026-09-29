import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { calendarDate, calendarDays, parseCalendarDate } from '../lib/calendarDate.js'

export default function BirthDatePicker({ value, onChange, disabled = false }) {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  const id = useId()
  const trigger = useRef(null)
  const panel = useRef(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [view, setView] = useState(() => new Date())
  const [position, setPosition] = useState({ top: 12, left: 12 })
  const today = calendarDate(new Date())
  const currentYear = new Date().getFullYear()
  const minYear = Math.min(1900, parseCalendarDate(value)?.getFullYear() || 1900)
  const year = view.getFullYear(), month = view.getMonth()
  const locale = ar ? 'ar' : 'en-GB'
  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' }))
  const weekdays = ar ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = calendarDays(year, month)
  const pretty = (date) => date.toLocaleDateString(`${locale}-u-nu-latn`, { day: 'numeric', month: 'long', year: 'numeric' })
  const close = () => { setOpen(false); trigger.current?.focus() }

  function show() {
    const selected = parseCalendarDate(value)
    setDraft(selected ? value : '')
    setView(selected && value <= today ? selected : new Date())
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current.getBoundingClientRect()
      const width = Math.min(384, window.innerWidth - 24)
      const height = panel.current?.getBoundingClientRect().height || 440
      const below = rect.bottom + 8
      setPosition({
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(below + height <= window.innerHeight - 12 ? below : rect.top - height - 8, window.innerHeight - height - 12)),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, year, month])

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector('select')?.focus()
    const escape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    // Close the picker first, preserving the underlying patient form.
    window.addEventListener('keydown', escape, true)
    return () => window.removeEventListener('keydown', escape, true)
  }, [open])

  function keyboard(event) {
    if (event.key === 'Tab') {
      const controls = [...panel.current.querySelectorAll('button:not(:disabled), select:not(:disabled)')]
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const key = event.target.dataset.date
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (!key || !offset) return
    event.preventDefault()
    const date = parseCalendarDate(key)
    date.setDate(date.getDate() + offset)
    panel.current.querySelector(`[data-date="${calendarDate(date)}"]:not(:disabled)`)?.focus()
  }

  const selected = parseCalendarDate(value)
  return <>
    <button ref={trigger} type="button" disabled={disabled} onClick={show} aria-label={ar ? 'اختيار تاريخ الميلاد' : 'Choose date of birth'} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      className={`input flex min-h-[46px] items-center justify-between gap-3 text-start transition-colors hover:border-brand-400 ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''}`}>
      <CalendarDays size={20} className="shrink-0 text-brand-600" />
      <span dir="ltr" className={`flex-1 text-start tabular-nums ${selected ? 'text-ink-800' : 'text-ink-400'}`}>
        {selected ? `${String(selected.getDate()).padStart(2, '0')} / ${String(selected.getMonth() + 1).padStart(2, '0')} / ${selected.getFullYear()}` : 'DD / MM / YYYY'}
      </span>
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[80]" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0" onPointerDown={close} />
      <section ref={panel} id={id} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={keyboard}
        className="fixed w-[384px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[20px] border border-ink-100 bg-white p-4 shadow-[0_16px_60px_-12px_rgba(15,45,60,0.25)] sm:p-5"
        style={{ ...position, maxHeight: 'calc(100dvh - 24px)' }}>
        <header className="mb-4 flex items-start justify-between gap-2">
          <div><h4 id={`${id}-title`} className="text-base font-extrabold text-ink-800">{ar ? 'اختر تاريخ الميلاد' : 'Choose date of birth'}</h4>
            <p className="mt-1 text-xs text-ink-400">{ar ? 'اختر السنة والشهر ثم اليوم' : 'Choose the year, month, then day'}</p></div>
          <button type="button" onClick={close} aria-label={ar ? 'إغلاق التقويم' : 'Close calendar'} className="rounded-lg p-2 text-ink-400 hover:bg-ink-50"><X size={16} /></button>
        </header>
        <div className="mb-4 flex items-center gap-2">
          <select aria-label={ar ? 'الشهر' : 'Month'} value={month} onChange={(e) => setView(new Date(year, Number(e.target.value), 1, 12))} className="input min-w-0 flex-1 !rounded-xl !px-2 font-bold">
            {months.map((name, i) => <option key={i} value={i} disabled={year === currentYear && i > new Date().getMonth()}>{name}</option>)}
          </select>
          <select aria-label={ar ? 'السنة' : 'Year'} value={year} onChange={(e) => { const y = Number(e.target.value); setView(new Date(y, y === currentYear ? Math.min(month, new Date().getMonth()) : month, 1, 12)) }} className="input !w-[88px] !rounded-xl !px-2 font-bold tabular-nums">
            {Array.from({ length: currentYear - minYear + 1 }, (_, i) => currentYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-1" dir="ltr">
            <button type="button" aria-label={ar ? 'الشهر السابق' : 'Previous month'} disabled={year === minYear && month === 0} onClick={() => setView(new Date(year, month - 1, 1, 12))} className="rounded-xl border border-ink-200 p-2 text-ink-600 hover:bg-brand-50 disabled:opacity-30"><ChevronLeft size={18} /></button>
            <button type="button" aria-label={ar ? 'الشهر التالي' : 'Next month'} disabled={year === currentYear && month === new Date().getMonth()} onClick={() => setView(new Date(year, month + 1, 1, 12))} className="rounded-xl border border-ink-200 p-2 text-ink-600 hover:bg-brand-50 disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div dir="ltr" className="grid grid-cols-7 gap-y-1">
          {weekdays.map((day) => <span key={day} className="pb-2 text-center text-[10px] font-semibold text-ink-400">{day}</span>)}
          {days.map((date) => {
            const key = calendarDate(date), active = key === draft
            return <button key={key} type="button" data-date={key} aria-label={pretty(date)} aria-pressed={active} disabled={key > today || date.getFullYear() < minYear}
              onClick={() => setDraft(key)}
              className={`mx-auto flex h-11 w-full max-w-[44px] items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-25 ${active ? 'bg-brand-600 text-white shadow-sm' : date.getMonth() !== month ? 'text-ink-300 hover:bg-brand-50' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700'}`}>
              {date.getDate()}
            </button>
          })}
        </div>
        <footer className="mt-4 border-t border-ink-100 pt-3">
          <p aria-live="polite" className="mb-3 min-h-[20px] text-sm font-semibold text-ink-700">{parseCalendarDate(draft) ? pretty(parseCalendarDate(draft)) : (ar ? 'لم يتم اختيار تاريخ' : 'No date selected')}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!parseCalendarDate(draft) || draft > today} onClick={() => { onChange(draft); close() }} className="btn-primary flex-1 !rounded-xl">{ar ? 'تأكيد التاريخ' : 'Confirm date'}</button>
            <button type="button" onClick={() => { onChange(''); close() }} className="btn-ghost !text-brand-700">{ar ? 'مسح' : 'Clear'}</button>
          </div>
        </footer>
      </section>
    </div>, document.body)}
  </>
}
