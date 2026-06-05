// Lightweight, self-contained mockups used as "screenshots from inside the app"
// on the Packages page — no live data, just polished representative visuals.
import { cx } from '../lib/utils'

function MiniTooth({ colors = {}, size = 18 }) {
  const S = size, i = Math.round(S * 0.32)
  const polys = {
    top: `0,0 ${S},0 ${S - i},${i} ${i},${i}`,
    right: `${S},0 ${S},${S} ${S - i},${S - i} ${S - i},${i}`,
    bottom: `0,${S} ${S},${S} ${S - i},${S - i} ${i},${S - i}`,
    left: `0,0 0,${S} ${i},${S - i} ${i},${i}`,
    center: `${i},${i} ${S - i},${i} ${S - i},${S - i} ${i},${S - i}`,
  }
  return (
    <svg width={S} height={S}>
      {Object.entries(polys).map(([k, p]) => (
        <polygon key={k} points={p} fill={colors[k] || '#fff'} stroke="#cbd5e1" strokeWidth={0.6} />
      ))}
    </svg>
  )
}

export function ChartPreview({ small }) {
  const teeth = [
    {}, {}, { center: '#ef4444', right: '#ef4444' }, {}, { center: '#3b82f6' }, {}, {}, {},
  ]
  const lower = [
    {}, {}, {}, { center: '#8b5cf6' }, {}, { center: '#f59e0b' }, {}, {},
  ]
  return (
    <div className={cx('flex flex-col items-center gap-2 rounded-lg bg-white p-3', small && 'p-2')}>
      <div className="flex gap-0.5">{teeth.map((c, i) => <MiniTooth key={i} colors={c} size={small ? 14 : 20} />)}</div>
      <div className="h-px w-full bg-ink-100" />
      <div className="flex gap-0.5">{lower.map((c, i) => <MiniTooth key={i} colors={c} size={small ? 14 : 20} />)}</div>
      {!small && (
        <div className="mt-1 flex flex-wrap justify-center gap-1.5">
          {[['#ef4444', 'Caries'], ['#3b82f6', 'Composite'], ['#8b5cf6', 'RCT'], ['#f59e0b', 'Crown']].map(([c, n]) => (
            <span key={n} className="flex items-center gap-1 text-[9px] font-semibold text-ink-400"><span className="h-2 w-2 rounded" style={{ background: c }} />{n}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function CalendarPreview({ small }) {
  const docColors = ['#0d9488', '#6366f1', '#db2777']
  const cells = Array.from({ length: 35 }, (_, i) => i)
  const events = { 8: [0], 9: [1], 12: [0, 1], 15: [2], 16: [0], 19: [1, 2], 22: [0], 23: [2] }
  return (
    <div className={cx('rounded-lg bg-white p-3', small && 'p-2')}>
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center text-[8px] font-bold text-ink-300">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => (
          <div key={c} className={cx('flex aspect-square flex-col items-center justify-center rounded', c === 16 ? 'bg-brand-50 ring-1 ring-brand-300' : 'bg-ink-50/60')}>
            <span className="text-[8px] font-bold text-ink-400">{c + 1}</span>
            <div className="flex gap-0.5">
              {(events[c] || []).map((d, j) => <span key={j} className="h-1 w-1 rounded-full" style={{ background: docColors[d] }} />)}
            </div>
          </div>
        ))}
      </div>
      {!small && (
        <div className="mt-2 flex justify-center gap-2">
          {['Sara', 'Omar', 'Lina'].map((n, i) => (
            <span key={n} className="flex items-center gap-1 text-[9px] font-semibold text-ink-400"><span className="h-2 w-2 rounded-full" style={{ background: docColors[i] }} />{n}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardPreview({ small }) {
  const stats = [['#0d9488', '124'], ['#ef4444', '370'], ['#16a34a', '1.2k']]
  const rows = [['LA', '#fce7f3'], ['KM', '#dbeafe'], ['SY', '#dcfce7']]
  return (
    <div className={cx('space-y-2 rounded-lg bg-white p-3', small && 'p-2')}>
      <div className="grid grid-cols-3 gap-1.5">
        {stats.map(([c, v], i) => (
          <div key={i} className="rounded-lg bg-ink-50/70 p-1.5 text-center">
            <div className="mx-auto mb-1 h-3 w-3 rounded" style={{ background: c }} />
            <p className="text-[11px] font-extrabold text-ink-700">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {rows.map(([ini, bg], i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-lg bg-ink-50/50 p-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-ink-600" style={{ background: bg }}>{ini}</span>
            <div className="h-1.5 flex-1 rounded-full bg-ink-200" />
            <div className="h-1.5 w-6 rounded-full bg-brand-300" />
          </div>
        ))}
      </div>
    </div>
  )
}
