import { DENTAL_ITEMS } from './treatments'
import { getTooth } from './teeth'

// Severity weighting → drives the "top 3 teeth that need treatment" suggestion.
const SEVERITY = {
  abscess: 6, fracture: 5, caries: 4, mobility: 3, impacted: 3,
  sensitivity: 2, attrition: 1, discoloration: 1, missing: 0,
}

// Find the highest-priority teeth needing work: conditions present that have not
// yet been resolved by a later 'done' treatment on the same tooth.
export function computePriorityTeeth(records, limit = 3) {
  const byTooth = {}
  for (const r of records) {
    if (r.toothId === '0') continue
    ;(byTooth[r.toothId] ||= []).push(r)
  }
  const results = []
  for (const [toothId, recs] of Object.entries(byTooth)) {
    const conditions = recs.filter((r) => r.kind === 'condition')
    if (!conditions.length) continue
    // Treatments done after the latest condition resolve it.
    const latestCond = conditions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
    const treatedAfter = recs.some(
      (r) => r.kind === 'treatment' && r.status === 'done' && (r.date || '') >= (latestCond.date || '')
    )
    const plannedTreatment = recs.some((r) => r.kind === 'treatment' && r.status === 'planned')
    if (treatedAfter && !plannedTreatment) continue

    let score = 0
    const reasons = []
    for (const c of conditions) {
      score = Math.max(score, SEVERITY[c.itemKey] ?? 1)
      const name = DENTAL_ITEMS[c.itemKey]
      if (name && !reasons.includes(name.en)) reasons.push(c.itemKey)
    }
    if (plannedTreatment) score += 0.5
    results.push({ toothId, tooth: getTooth(toothId), score, reasons })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

// O'Leary Plaque Control Record: 4 surfaces per tooth, % with plaque.
export const PLAQUE_SURFACES = ['mesial', 'buccal', 'distal', 'lingual']

export function plaquePercent(plaque, presentToothIds) {
  const total = presentToothIds.length * 4
  if (!total) return 0
  let withPlaque = 0
  for (const id of presentToothIds) {
    const p = plaque[id]
    if (p) withPlaque += PLAQUE_SURFACES.filter((s) => p[s]).length
  }
  return Math.round((withPlaque / total) * 100)
}

// Bleeding on probing percentage from perio data.
export function bopPercent(perio, presentToothIds) {
  const total = presentToothIds.length * 6
  if (!total) return 0
  let bleeding = 0
  for (const id of presentToothIds) {
    const p = perio[id]
    if (p?.bop) bleeding += p.bop.filter(Boolean).length
  }
  return Math.round((bleeding / total) * 100)
}

// Any probing depth greater than 3 mm is flagged red (a pocket).
export function pocketColor(mm) {
  const v = Number(mm)
  if (!v) return ''
  if (v <= 3) return '#16a34a' // healthy
  return '#dc2626' // > 3 mm → pocket
}
