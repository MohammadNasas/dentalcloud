import { motion, AnimatePresence } from 'framer-motion'
import { X, Lock, Search } from 'lucide-react'
import { cx, initials, colorFromString, colorFromStringDark } from '../lib/utils'
import { useEffect } from 'react'
import { CountUp } from './anim'

export function Modal({ open, onClose, title, children, footer, size = 'md', icon }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={cx('card relative z-10 my-6 w-full overflow-hidden', widths[size])}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <h3 className="flex items-center gap-2.5 text-base font-bold text-ink-800">
                  {icon}
                  {title}
                </h3>
                <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="px-5 py-4">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3.5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Field({ label, children, hint, required, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, labelOn, labelOff }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex items-center gap-2 rounded-full px-1 py-1 text-xs font-semibold transition-colors',
        checked ? 'bg-brand-500' : 'bg-ink-200'
      )}
      style={{ width: 52 }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cx('block h-5 w-5 rounded-full bg-white shadow', checked ? 'order-2' : 'order-1')}
      />
      <span className={cx('flex-1 px-1 text-white', checked ? 'order-1 text-start' : 'order-2 text-end opacity-0')}>
        {checked ? '' : ''}
      </span>
    </button>
  )
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  return (
    <div className="inline-flex rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'relative rounded-lg font-semibold transition-colors',
            pad,
            value === o.value ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join('')}`}
              className="absolute inset-0 rounded-lg bg-white shadow-soft"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">{o.icon}{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name = '', size = 40, src }) {
  if (src) {
    return <img src={src} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: colorFromString(name), color: colorFromStringDark(name),
      }}
    >
      {initials(name)}
    </div>
  )
}

export function Badge({ children, color = 'ink', className }) {
  const map = {
    ink: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return <span className={cx('chip', map[color], className)}>{children}</span>
}

export function EmptyState({ icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="animate-bob flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">{icon}</div>
      <div>
        <p className="font-semibold text-ink-700">{title}</p>
        {hint && <p className="mt-1 text-sm text-ink-400">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 start-3.5" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input ps-10"
      />
    </div>
  )
}

export function LockBadge({ children }) {
  return (
    <span className="chip bg-amber-50 text-amber-600">
      <Lock size={11} /> {children}
    </span>
  )
}

export function Spinner({ size = 18 }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  )
}

export function Stat({ icon, label, value, sub, color = 'brand' }) {
  const ring = {
    brand: 'bg-brand-50 text-brand-600',
    rose: 'bg-rose-50 text-rose-500',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="card card-hover flex items-center gap-4 p-4">
      <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', ring[color])}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-2xl font-extrabold text-ink-800">
          {typeof value === 'number' ? <CountUp to={value} /> : value}
        </p>
        <p className="truncate text-xs font-semibold text-ink-400">{label}</p>
        {sub && <p className="truncate text-xs text-ink-400">{sub}</p>}
      </div>
    </div>
  )
}
