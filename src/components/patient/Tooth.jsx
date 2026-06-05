import { isAnterior } from '../../lib/teeth'

// Renders one tooth as a 5-surface charting box (Buccal / Lingual / Mesial /
// Distal / Occlusal) with colours driven by the records affecting it.
// `display` = { surfaceColors:{surface:{color,status}}, wholeColor, wholeStatus, symbols:[], missing }
export default function Tooth({ tooth, display, selected, onClick, size = 38, label }) {
  const S = size
  const i = Math.round(S * 0.32)
  const region = {
    top: 'buccal',
    bottom: 'lingual',
    center: 'occlusal',
    left: tooth.side === 'right' ? 'distal' : 'mesial',
    right: tooth.side === 'right' ? 'mesial' : 'distal',
  }
  const polys = {
    top: `0,0 ${S},0 ${S - i},${i} ${i},${i}`,
    right: `${S},0 ${S},${S} ${S - i},${S - i} ${S - i},${i}`,
    bottom: `0,${S} ${S},${S} ${S - i},${S - i} ${i},${S - i}`,
    left: `0,0 0,${S} ${i},${S - i} ${i},${i}`,
    center: `${i},${i} ${S - i},${i} ${S - i},${S - i} ${i},${S - i}`,
  }
  const fillFor = (pos) => {
    const surf = region[pos]
    const sc = display?.surfaceColors?.[surf]
    if (!sc) return { fill: '#ffffff', opacity: 1 }
    return { fill: sc.color, opacity: sc.status === 'done' ? 1 : 0.4 }
  }

  const whole = display?.wholeColor
  const missing = display?.missing

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center"
      style={{ width: S + 6 }}
      title={tooth.names?.en}
    >
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="overflow-visible">
        {/* selection halo */}
        {selected && <rect x={-3} y={-3} width={S + 6} height={S + 6} rx={6} fill="none" stroke="#14b8a6" strokeWidth={2.5} />}

        {missing ? (
          <>
            <rect x={0} y={0} width={S} height={S} rx={3} fill="#f1f5f9" stroke="#cbd5e1" />
            <line x1={4} y1={4} x2={S - 4} y2={S - 4} stroke="#94a3b8" strokeWidth={2} />
            <line x1={S - 4} y1={4} x2={4} y2={S - 4} stroke="#94a3b8" strokeWidth={2} />
          </>
        ) : (
          <>
            {['top', 'right', 'bottom', 'left', 'center'].map((pos) => {
              const f = fillFor(pos)
              return <polygon key={pos} points={polys[pos]} fill={f.fill} fillOpacity={f.opacity} stroke="#cbd5e1" strokeWidth={0.8} />
            })}
            {/* whole-tooth tint overlay (crown, RCT, implant…) */}
            {whole && (
              <rect x={0} y={0} width={S} height={S} rx={3} fill={whole}
                fillOpacity={display.wholeStatus === 'done' ? 0.28 : 0.14}
                stroke={whole} strokeWidth={1.6} />
            )}
          </>
        )}

        {/* overlay symbols */}
        {display?.symbols?.length > 0 && (
          <text x={S / 2} y={S / 2 + 4} textAnchor="middle" fontSize={S * 0.42} fontWeight="800"
            fill={display.symbols[0].color} style={{ paintOrder: 'stroke' }} stroke="#fff" strokeWidth={0.6}>
            {display.symbols[0].symbol}
          </text>
        )}
      </svg>
      <span className={`mt-1 text-[10px] font-bold ${selected ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'}`}>
        {label ?? tooth.label}
      </span>
    </button>
  )
}
