import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { cx } from '../lib/utils'

// ── Tooth SVG ──────────────────────────────────────────────────────────────
const COND = {
  caries:    { fill: '#fee2e2', dot: '#ef4444' },
  composite: { fill: '#dbeafe', dot: '#3b82f6' },
  rct:       { fill: '#ede9fe', dot: '#8b5cf6' },
  crown:     { fill: '#fef9c3', dot: '#f59e0b' },
  missing:   null,
}

function Tooth({ condition, wide, small }) {
  const w  = wide ? (small ? 15 : 22) : (small ? 11 : 16)
  const h  = small ? 20 : 28
  const c  = condition ? COND[condition] : null

  if (condition === 'missing') {
    return (
      <svg width={w} height={h}>
        <line x1={w * 0.25} y1={h * 0.25} x2={w * 0.75} y2={h * 0.75} stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1={w * 0.75} y1={h * 0.25} x2={w * 0.25} y2={h * 0.75} stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* Crown */}
      <rect x="1.2" y="1.2" width={w - 2.4} height={h * 0.54} rx="3"
        fill={c ? c.fill : '#f8fafc'} stroke={c ? c.dot : '#e2e8f0'} strokeWidth="1.2" />
      {/* Root */}
      <rect x={w * 0.28} y={h * 0.52} width={w * 0.44} height={h * 0.44} rx="2"
        fill={c ? c.fill : '#f1f5f9'} stroke={c ? c.dot : '#e2e8f0'} strokeWidth="1" opacity="0.7" />
      {/* Condition dot */}
      {c && (
        <circle cx={w / 2} cy={h * 0.28} r={Math.max(2, w * 0.15)}
          fill={c.dot} opacity="0.7" />
      )}
    </svg>
  )
}

// ── Dental Chart Preview ──────────────────────────────────────────────────
const UPPER = [
  { n: 8, wide: true,  condition: null },
  { n: 7, wide: true,  condition: null },
  { n: 6, wide: true,  condition: 'crown' },
  { n: 5,              condition: null },
  { n: 4,              condition: null },
  { n: 3,              condition: 'caries' },
  { n: 2,              condition: null },
  { n: 1,              condition: 'composite' },
]
const LOWER = [
  { n: 1,              condition: null },
  { n: 2,              condition: 'rct' },
  { n: 3,              condition: null },
  { n: 4,              condition: null },
  { n: 5,              condition: 'caries' },
  { n: 6, wide: true,  condition: null },
  { n: 7, wide: true,  condition: null },
  { n: 8, wide: true,  condition: 'missing' },
]

export function ChartPreview({ small }) {
  return (
    <div className={cx('flex flex-col items-center rounded-xl bg-white', small ? 'gap-1 p-2' : 'gap-2.5 p-4')}>
      {/* Upper teeth */}
      <div className="flex items-end gap-px">
        {UPPER.map((t) => (
          <div key={t.n} className="flex flex-col items-center gap-0.5">
            {!small && <span className="text-[7px] font-bold text-ink-300">{t.n}</span>}
            <Tooth condition={t.condition} wide={t.wide} small={small} />
          </div>
        ))}
      </div>

      {/* Midline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-ink-200 to-transparent" />

      {/* Lower teeth */}
      <div className="flex items-start gap-px">
        {LOWER.map((t) => (
          <div key={t.n} className="flex flex-col items-center gap-0.5">
            <Tooth condition={t.condition} wide={t.wide} small={small} />
            {!small && <span className="text-[7px] font-bold text-ink-300">{t.n}</span>}
          </div>
        ))}
      </div>

      {/* Legend */}
      {!small && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {[['#ef4444','Caries'],['#3b82f6','Composite'],['#8b5cf6','RCT'],['#f59e0b','Crown']].map(([c, n]) => (
            <span key={n} className="flex items-center gap-1 text-[8px] font-semibold text-ink-400">
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />{n}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Calendar Preview ──────────────────────────────────────────────────────
const APPTS = [
  { day: 0, hour: 9,  name: 'Sara K.',   color: '#0d9488' },
  { day: 1, hour: 10, name: 'Omar N.',   color: '#6366f1' },
  { day: 1, hour: 14, name: 'Lina M.',   color: '#db2777' },
  { day: 2, hour: 11, name: 'Ahmad S.',  color: '#0d9488' },
  { day: 3, hour: 9,  name: 'Reem A.',   color: '#db2777' },
  { day: 4, hour: 15, name: 'Khalid F.', color: '#6366f1' },
]
const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOURS = [9, 10, 11, 12, 13, 14, 15]

export function CalendarPreview({ small }) {
  const hrs = small ? HOURS.slice(0, 3) : HOURS
  return (
    <div className={cx('rounded-xl bg-white', small ? 'p-2' : 'p-3')}>
      {/* Day headers */}
      <div className={cx('grid gap-px mb-1.5', `grid-cols-6`)}>
        <div />
        {DAYS.map((d) => (
          <div key={d} className={cx('text-center font-bold text-ink-400', small ? 'text-[7px]' : 'text-[9px]')}>{d}</div>
        ))}
      </div>
      {/* Slots */}
      {hrs.map((h) => (
        <div key={h} className={cx('grid gap-px', 'grid-cols-6', small ? 'mb-0.5' : 'mb-1')}>
          <div className={cx('text-ink-300 font-medium', small ? 'text-[6px] pt-0.5' : 'text-[8px] pt-1')}>{h}:00</div>
          {DAYS.map((_, di) => {
            const a = APPTS.find((x) => x.day === di && x.hour === h)
            return (
              <div key={di}
                className={cx('rounded', small ? 'h-3.5' : 'h-6', !a && 'bg-ink-50/70')}
                style={a ? { background: `${a.color}18`, borderLeft: `2.5px solid ${a.color}` } : {}}>
                {a && !small && (
                  <span className="block truncate px-1 text-[7px] font-semibold leading-tight pt-0.5" style={{ color: a.color }}>
                    {a.name}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {/* Doctors legend */}
      {!small && (
        <div className="mt-2 flex justify-center gap-3">
          {[['Sara', '#0d9488'], ['Omar', '#6366f1'], ['Lina', '#db2777']].map(([n, c]) => (
            <span key={n} className="flex items-center gap-1 text-[8px] font-semibold text-ink-400">
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />{n}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard Preview ─────────────────────────────────────────────────────
const BAR_DATA = [55, 70, 48, 85, 62, 95, 72]
const BAR_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']

export function DashboardPreview({ small }) {
  const stats = [
    { label: 'Patients', value: '1.2k', color: '#0d9488', trend: '+12%' },
    { label: 'Revenue',  value: '$8.4k', color: '#6366f1', trend: '+8%'  },
    { label: 'Appts',    value: '124',   color: '#f59e0b', trend: '+5%'  },
  ]
  return (
    <div className={cx('space-y-2 rounded-xl bg-white', small ? 'p-2' : 'p-3')}>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-ink-50/80 p-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {!small && <span className="text-[7px] font-bold text-emerald-600">{s.trend}</span>}
            </div>
            <p className={cx('font-extrabold text-ink-700', small ? 'text-[9px]' : 'text-[12px]')}>{s.value}</p>
            {!small && <p className="text-[7px] text-ink-400 mt-0.5">{s.label}</p>}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {!small && (
        <div className="rounded-xl bg-ink-50/60 p-2.5">
          <p className="mb-2 text-[8px] font-bold text-ink-400">Monthly Revenue</p>
          <div className="flex items-end gap-0.5 h-12">
            {BAR_DATA.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                <motion.div
                  className="w-full rounded-t"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                  style={{ background: i === 5 ? '#0d9488' : '#e2e8f0' }}
                />
                <span className="text-[5.5px] text-ink-300">{BAR_MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent patients */}
      {!small && (
        <div className="space-y-1">
          {[['Sara K.', '#fce7f3', '9:00 AM'], ['Omar N.', '#dbeafe', '10:30 AM'], ['Lina M.', '#dcfce7', '2:00 PM']].map(([name, bg, time]) => (
            <div key={name} className="flex items-center gap-2 rounded-lg bg-ink-50/60 px-2 py-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[7px] font-extrabold text-ink-600" style={{ background: bg }}>
                {name[0]}
              </span>
              <span className="flex-1 text-[9px] font-semibold text-ink-600">{name}</span>
              <span className="text-[7px] text-ink-300">{time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── App Showcase (tabbed window for Landing page) ─────────────────────────
export function AppShowcase() {
  const { lang } = useI18n()
  const [tab, setTab] = useState(0)

  const tabs = [
    { ar: 'مخطط الأسنان', en: 'Dental Chart', Comp: ChartPreview },
    { ar: 'التقويم',      en: 'Calendar',     Comp: CalendarPreview },
    { ar: 'الإحصائيات',  en: 'Dashboard',    Comp: DashboardPreview },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.4)] ring-1 ring-white/10">
      {/* macOS title bar */}
      <div className="flex items-center gap-2.5 bg-[#0d1424] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <div className="h-3 w-3 rounded-full bg-[#28c940]" />
        </div>
        <div className="flex-1 text-center text-[11px] font-semibold tracking-wide text-white/25">
          DentalCloud
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/8 bg-[#151d2e] px-4 py-2">
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={cx(
              'relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
              tab === i ? 'text-white' : 'text-white/35 hover:text-white/55',
            )}>
            {tab === i && (
              <motion.span layoutId="showcase-tab"
                className="absolute inset-0 rounded-lg bg-brand-600"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <span className="relative">{lang === 'ar' ? t.ar : t.en}</span>
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div className="bg-[#f4f7fa] p-5 min-h-[240px]">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, x: lang === 'ar' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: lang === 'ar' ? 10 : -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}>
            {(() => { const { Comp } = tabs[tab]; return <Comp /> })()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
