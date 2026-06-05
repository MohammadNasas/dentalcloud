import { useMemo, useState } from 'react'
import { Droplet, Activity, RotateCcw } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { chartRows, toothLabel } from '../../lib/teeth'
import { plaquePercent, bopPercent, pocketColor, PLAQUE_SURFACES } from '../../lib/clinical'
import { Segmented } from '../ui'
import { cx } from '../../lib/utils'

export default function PerioChart({ patient }) {
  const { t, lang } = useI18n()
  const { updatePatient, recordsForPatient, clinic } = useStore()
  const [mode, setMode] = useState('plaque')
  const numbering = clinic?.settings?.numbering || 'fdi'

  const plaque = patient.plaque || {}
  const perio = patient.perio || {}
  const rows = chartRows('permanent')

  const missing = useMemo(() => {
    const set = new Set()
    recordsForPatient(patient.id).forEach((r) => { if (r.itemKey === 'missing') set.add(r.toothId) })
    return set
  }, [patient.id, recordsForPatient])

  const presentIds = useMemo(() => {
    const all = [...rows.upper.right, ...rows.upper.left, ...rows.lower.right, ...rows.lower.left]
    return all.filter((tt) => !missing.has(tt.id)).map((tt) => tt.id)
  }, [rows, missing])

  const plaqueScore = plaquePercent(plaque, presentIds)
  const bop = bopPercent(perio, presentIds)

  function toggleSurface(toothId, surf) {
    const cur = plaque[toothId] || {}
    updatePatient(patient.id, { plaque: { ...plaque, [toothId]: { ...cur, [surf]: !cur[surf] } } })
  }
  function setDepth(toothId, idx, val) {
    const cur = perio[toothId] || { pd: [], bop: [] }
    const pd = [...(cur.pd || [])]; pd[idx] = val
    updatePatient(patient.id, { perio: { ...perio, [toothId]: { ...cur, pd } } })
  }
  function toggleBop(toothId, idx) {
    const cur = perio[toothId] || { pd: [], bop: [] }
    const b = [...(cur.bop || [])]; b[idx] = !b[idx]
    updatePatient(patient.id, { perio: { ...perio, [toothId]: { ...cur, bop: b } } })
  }
  function reset() {
    if (confirm(t('perio.reset') + '?')) updatePatient(patient.id, { plaque: {}, perio: {} })
  }

  const ArchRow = ({ arch, render }) => {
    const r = arch === 'upper' ? rows.upper : rows.lower
    return (
      <div className="flex items-start justify-center gap-2">
        <div className="flex gap-1">{r.right.map(render)}</div>
        <div className="mx-1 h-16 w-px bg-ink-200" />
        <div className="flex gap-1">{r.left.map(render)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-ink-400"><Droplet size={16} className="text-rose-400" /><span className="text-xs font-semibold">{t('perio.plaqueScore')}</span></div>
          <p className={cx('mt-1 text-2xl font-extrabold', plaqueScore > 30 ? 'text-rose-500' : plaqueScore > 15 ? 'text-amber-500' : 'text-emerald-600')}>{plaqueScore}%</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-ink-400"><Activity size={16} className="text-rose-400" /><span className="text-xs font-semibold">{t('perio.bop')}</span></div>
          <p className={cx('mt-1 text-2xl font-extrabold', bop > 25 ? 'text-rose-500' : bop > 10 ? 'text-amber-500' : 'text-emerald-600')}>{bop}%</p>
        </div>
        <div className="card flex items-center justify-center p-4">
          <button onClick={reset} className="btn-ghost text-ink-500"><RotateCcw size={15} /> {t('perio.reset')}</button>
        </div>
      </div>

      <div className="flex justify-center">
        <Segmented value={mode} onChange={setMode}
          options={[
            { value: 'plaque', label: t('perio.plaqueIndex'), icon: <Droplet size={14} /> },
            { value: 'perio', label: t('perio.title'), icon: <Activity size={14} /> },
          ]} />
      </div>

      <div className="card p-4">
        <p className="mb-3 text-center text-xs text-ink-400">{mode === 'plaque' ? t('perio.plaqueHint') : t('perio.tapToggle')}</p>
        <div dir="ltr" className="space-y-4 overflow-x-auto">
          <div className="min-w-max space-y-4">
            <ArchRow arch="upper" render={(tt) => (
              mode === 'plaque'
                ? <PlaqueTooth key={tt.id} tooth={tt} label={toothLabel(tt, numbering)} data={plaque[tt.id]} missing={missing.has(tt.id)} onToggle={(s) => toggleSurface(tt.id, s)} />
                : <PerioTooth key={tt.id} tooth={tt} label={toothLabel(tt, numbering)} data={perio[tt.id]} missing={missing.has(tt.id)} onDepth={(i, v) => setDepth(tt.id, i, v)} onBop={(i) => toggleBop(tt.id, i)} />
            )} />
            <div className="h-px bg-ink-100" />
            <ArchRow arch="lower" render={(tt) => (
              mode === 'plaque'
                ? <PlaqueTooth key={tt.id} tooth={tt} label={toothLabel(tt, numbering)} data={plaque[tt.id]} missing={missing.has(tt.id)} onToggle={(s) => toggleSurface(tt.id, s)} />
                : <PerioTooth key={tt.id} tooth={tt} label={toothLabel(tt, numbering)} data={perio[tt.id]} missing={missing.has(tt.id)} onDepth={(i, v) => setDepth(tt.id, i, v)} onBop={(i) => toggleBop(tt.id, i)} />
            )} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PlaqueTooth({ tooth, data = {}, missing, onToggle, label }) {
  const S = 34
  const region = {
    top: 'buccal', bottom: 'lingual',
    left: tooth.side === 'right' ? 'distal' : 'mesial',
    right: tooth.side === 'right' ? 'mesial' : 'distal',
  }
  const tris = {
    top: `0,0 ${S},0 ${S / 2},${S / 2}`,
    right: `${S},0 ${S},${S} ${S / 2},${S / 2}`,
    bottom: `0,${S} ${S},${S} ${S / 2},${S / 2}`,
    left: `0,0 0,${S} ${S / 2},${S / 2}`,
  }
  return (
    <div className="flex flex-col items-center" style={{ width: S + 4 }}>
      <svg width={S} height={S} className={missing ? 'opacity-30' : ''}>
        {['top', 'right', 'bottom', 'left'].map((pos) => (
          <polygon key={pos} points={tris[pos]}
            fill={data[region[pos]] ? '#ef4444' : '#ffffff'} stroke="#cbd5e1" strokeWidth={0.8}
            className={missing ? '' : 'cursor-pointer'}
            onClick={() => !missing && onToggle(region[pos])} />
        ))}
      </svg>
      <span className="mt-0.5 text-[10px] font-bold text-ink-400">{label ?? tooth.label}</span>
    </div>
  )
}

function PerioTooth({ tooth, data = {}, missing, onDepth, onBop, label }) {
  const pd = data.pd || []
  const bop = data.bop || []
  // sites 0-2 buccal, 3-5 lingual
  const Cell = ({ i }) => (
    <input
      value={pd[i] || ''}
      onChange={(e) => onDepth(i, e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      className="h-6 w-6 rounded border border-ink-200 text-center text-[11px] font-bold focus:border-brand-400 focus:outline-none"
      style={{ color: pocketColor(pd[i]) || '#334155' }}
      disabled={missing}
    />
  )
  const Dot = ({ i }) => (
    <button onClick={() => !missing && onBop(i)} disabled={missing}
      className={cx('h-2.5 w-2.5 rounded-full border', bop[i] ? 'border-rose-500 bg-rose-500' : 'border-ink-300 bg-white')} />
  )
  return (
    <div className={cx('flex flex-col items-center gap-0.5', missing && 'opacity-30')}>
      <div className="flex gap-0.5">{[0, 1, 2].map((i) => <Cell key={i} i={i} />)}</div>
      <div className="flex gap-1.5">{[0, 1, 2].map((i) => <Dot key={i} i={i} />)}</div>
      <span className="text-[10px] font-bold text-ink-400">{label ?? tooth.label}</span>
      <div className="flex gap-1.5">{[3, 4, 5].map((i) => <Dot key={i} i={i} />)}</div>
      <div className="flex gap-0.5">{[3, 4, 5].map((i) => <Cell key={i} i={i} />)}</div>
    </div>
  )
}
