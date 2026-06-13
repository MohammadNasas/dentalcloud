// Central animation toolkit — reusable motion primitives used across the app.
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, animate, useInView } from 'framer-motion'
import { cx } from '../lib/utils'

/* ── Shared variants ─────────────────────────────────────────────────────── */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
}
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

// Drop-in wrapper that staggers its children into view.
export function Stagger({ children, className, amount = 0.2 }) {
  return (
    <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount }} className={className}>
      {children}
    </motion.div>
  )
}
export function Item({ children, className }) {
  return <motion.div variants={staggerItem} className={className}>{children}</motion.div>
}

/* ── #2/#23 Count-up number ──────────────────────────────────────────────── */
export function CountUp({ to, suffix = '', prefix = '', duration = 1.4, decimals = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const [val, setVal] = useState('0')
  useEffect(() => {
    if (!inView) return
    const num = parseFloat(String(to).replace(/[^0-9.-]/g, '')) || 0
    const controls = animate(0, num, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(v.toLocaleString(undefined, { maximumFractionDigits: decimals })),
    })
    return () => controls.stop()
  }, [inView, to, duration, decimals])
  return <span ref={ref}>{prefix}{val}{suffix}</span>
}

/* ── #9 Skeleton shimmer ─────────────────────────────────────────────────── */
export function Skeleton({ className, w, h = 12, rounded = 'rounded-md' }) {
  return <span className={cx('shimmer block', rounded, className)} style={{ width: w, height: h }} />
}
export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton w={38} h={38} rounded="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton w="60%" h={10} />
            <Skeleton w="40%" h={8} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── #18 Confetti burst ──────────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#14b8a6', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']
export function Confetti({ count = 26 }) {
  const pieces = useRef(
    Array.from({ length: count }).map(() => ({
      x: (Math.random() - 0.5) * 260,
      y: (Math.random() - 0.7) * 220,
      r: (Math.random() - 0.5) * 540,
      c: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
      d: Math.random() * 0.15,
      s: 6 + Math.random() * 5,
    }))
  ).current
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.2, rotate: 0 }}
          animate={{ opacity: [1, 1, 0], x: p.x, y: p.y, scale: 1, rotate: p.r }}
          transition={{ duration: 1.3, delay: p.d, ease: 'easeOut' }}
          style={{ position: 'absolute', width: p.s, height: p.s, borderRadius: 2, background: p.c }}
        />
      ))}
    </div>
  )
}

/* ── #16 Progress ring ───────────────────────────────────────────────────── */
export function ProgressRing({ value = 0, size = 56, stroke = 6, color = '#14b8a6', label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c - (Math.min(100, Math.max(0, value)) / 100) * c }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      {label != null && <span className="absolute text-sm font-bold text-ink-700">{label}</span>}
    </div>
  )
}

/* ── #23 Sparkline (draw-in mini line) ───────────────────────────────────── */
export function Sparkline({ data = [], width = 120, height = 36, color = '#14b8a6', fill = true }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const step = width / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => [i * step, height - ((v - min) / span) * (height - 4) - 2])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {fill && (
        <motion.path d={area} fill={color} initial={{ opacity: 0 }} whileInView={{ opacity: 0.12 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.3 }} />
      )}
      <motion.path
        d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  )
}

/* ── #20 Live ping dot ───────────────────────────────────────────────────── */
export function PingDot({ color = '#10b981', size = 9, className }) {
  return (
    <span className={cx('relative inline-flex', className)} style={{ width: size, height: size }}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
      <span className="relative inline-flex rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  )
}

/* ── #26 Star rating (fills in on view) ──────────────────────────────────── */
const STAR = '9,1 11.2,6.6 17.3,6.9 12.5,10.8 14.1,16.7 9,13.3 3.9,16.7 5.5,10.8 0.7,6.9 6.8,6.6'
export function StarRating({ value = 5, size = 18, color = '#f59e0b' }) {
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.svg key={i} width={size} height={size} viewBox="0 0 18 18"
          initial={{ opacity: 0, scale: 0.4 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          transition={{ delay: i * 0.12, type: 'spring', stiffness: 300, damping: 16 }}>
          <polygon points={STAR} fill={i < value ? color : '#e2e8f0'} />
        </motion.svg>
      ))}
    </span>
  )
}

/* ── #22 Accordion ───────────────────────────────────────────────────────── */
export function Accordion({ items = [] }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start">
            <span className="font-bold text-ink-800">{it.q}</span>
            <motion.span animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-brand-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: 'easeInOut' }}>
                <p className="px-4 pb-4 text-sm leading-relaxed text-ink-500">{it.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

/* ── #21 Floating-label field ────────────────────────────────────────────── */
export function FloatingField({ label, type = 'text', value, onChange, icon, dir, autoComplete, required, name, autoFocus }) {
  const [focused, setFocused] = useState(false)
  const float = focused || (value != null && String(value).length > 0)
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400 start-3.5">{icon}</span>}
      <input
        type={type} value={value} name={name} dir={dir} autoComplete={autoComplete} required={required} autoFocus={autoFocus}
        onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={cx('peer w-full rounded-xl border bg-white px-3.5 pb-2 pt-5 text-sm text-ink-800 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-brand-400/10',
          focused ? 'border-brand-400' : 'border-ink-200', icon && 'ps-10')}
      />
      <motion.label
        animate={float ? { y: -10, scale: 0.82 } : { y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={cx('pointer-events-none absolute top-1/2 -translate-y-1/2 origin-[0_50%] font-semibold',
          icon ? 'start-10' : 'start-3.5', float ? 'text-brand-600' : 'text-ink-400')}
        style={{ fontSize: 13 }}
      >
        {label}
      </motion.label>
    </div>
  )
}

/* ── #25 Animated bell ───────────────────────────────────────────────────── */
export function AnimatedBell({ count = 0, children }) {
  return (
    <span className="relative inline-flex">
      <motion.span whileHover={{ rotate: [0, 14, -12, 9, -6, 0] }} transition={{ duration: 0.6 }}>{children}</motion.span>
      {count > 0 && (
        <motion.b initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.1 }}
          className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {count}
        </motion.b>
      )}
    </span>
  )
}

/* ── #10 Toast (lightweight global) ──────────────────────────────────────── */
let toastListeners = []
export function toast(message, type = 'success') {
  toastListeners.forEach((l) => l({ id: Date.now() + Math.random(), message, type }))
}
const TOAST_ICON = { success: '✓', error: '✕', info: 'i' }
const TOAST_RING = { success: 'bg-emerald-500', error: 'bg-rose-500', info: 'bg-brand-500' }
export function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const l = (t) => {
      setItems((s) => [...s, t])
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 3200)
    }
    toastListeners.push(l)
    return () => { toastListeners = toastListeners.filter((x) => x !== l) }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-4 z-[100] flex flex-col gap-2 end-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-card">
            <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white', TOAST_RING[t.type])}>{TOAST_ICON[t.type]}</span>
            <span className="text-sm font-semibold text-ink-700">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ── #5 Success check (draws itself) ─────────────────────────────────────── */
export function SuccessCheck({ size = 56, color = '#10b981' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56">
      <motion.circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      <motion.path d="M17 29 L25 37 L40 20" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.35, ease: 'easeOut' }} />
    </svg>
  )
}
