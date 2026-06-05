// ──────────────────────────────────────────────────────────────────────────
//  Dental anatomy: tooth numbering (FDI internally) with the display numbering
//  the user asked for — permanent teeth 1..8 (central → wisdom) and primary
//  teeth A..E (central → second primary molar).
// ──────────────────────────────────────────────────────────────────────────

// Position 1..8 → English / Arabic names (permanent)
export const PERMANENT_POSITIONS = {
  1: { en: 'Central Incisor', ar: 'القاطع المركزي', type: 'incisor' },
  2: { en: 'Lateral Incisor', ar: 'القاطع الجانبي', type: 'incisor' },
  3: { en: 'Canine', ar: 'الناب', type: 'canine' },
  4: { en: 'First Premolar', ar: 'الضاحك الأول', type: 'premolar' },
  5: { en: 'Second Premolar', ar: 'الضاحك الثاني', type: 'premolar' },
  6: { en: 'First Molar', ar: 'الرحى الأولى', type: 'molar' },
  7: { en: 'Second Molar', ar: 'الرحى الثانية', type: 'molar' },
  8: { en: 'Third Molar (Wisdom)', ar: 'ضرس العقل', type: 'molar' },
}

// Position A..E → English / Arabic names (primary / deciduous)
export const PRIMARY_POSITIONS = {
  A: { en: 'Primary Central Incisor', ar: 'القاطع المركزي اللبني', type: 'incisor' },
  B: { en: 'Primary Lateral Incisor', ar: 'القاطع الجانبي اللبني', type: 'incisor' },
  C: { en: 'Primary Canine', ar: 'الناب اللبني', type: 'canine' },
  D: { en: 'First Primary Molar', ar: 'الرحى اللبنية الأولى', type: 'molar' },
  E: { en: 'Second Primary Molar', ar: 'الرحى اللبنية الثانية', type: 'molar' },
}

const LETTERS = ['A', 'B', 'C', 'D', 'E']

// FDI quadrants. Permanent: 1=UR 2=UL 3=LL 4=LR. Primary: 5=UR 6=UL 7=LL 8=LR.
// We store every tooth with an `id` (FDI two-digit), arch, side, position label.
function buildPermanent() {
  const teeth = []
  const quads = [
    { q: 1, arch: 'upper', side: 'right' },
    { q: 2, arch: 'upper', side: 'left' },
    { q: 4, arch: 'lower', side: 'right' },
    { q: 3, arch: 'lower', side: 'left' },
  ]
  for (const { q, arch, side } of quads) {
    for (let p = 1; p <= 8; p++) {
      teeth.push({
        id: `${q}${p}`, // FDI, e.g. 11, 26, 38
        fdi: `${q}${p}`,
        quadrant: q,
        position: p,
        label: String(p), // what the user sees: 1..8
        arch,
        side,
        dentition: 'permanent',
        names: PERMANENT_POSITIONS[p],
        type: PERMANENT_POSITIONS[p].type,
      })
    }
  }
  return teeth
}

function buildPrimary() {
  const teeth = []
  const quads = [
    { q: 5, arch: 'upper', side: 'right' },
    { q: 6, arch: 'upper', side: 'left' },
    { q: 8, arch: 'lower', side: 'right' },
    { q: 7, arch: 'lower', side: 'left' },
  ]
  for (const { q, arch, side } of quads) {
    for (let i = 0; i < 5; i++) {
      const p = i + 1
      const letter = LETTERS[i]
      teeth.push({
        id: `${q}${p}`, // FDI primary, e.g. 51, 65, 85
        fdi: `${q}${p}`,
        quadrant: q,
        position: p,
        label: letter, // what the user sees: A..E
        arch,
        side,
        dentition: 'primary',
        names: PRIMARY_POSITIONS[letter],
        type: PRIMARY_POSITIONS[letter].type,
      })
    }
  }
  return teeth
}

export const PERMANENT_TEETH = buildPermanent()
export const PRIMARY_TEETH = buildPrimary()

// Layout helpers: return teeth ordered as they appear on a real chart.
// Upper-right runs 8→1, upper-left runs 1→8 (mirror), same for lower.
function rowFor(teeth, arch, dentition) {
  const max = dentition === 'primary' ? 5 : 8
  const right = teeth
    .filter((t) => t.arch === arch && t.side === 'right')
    .sort((a, b) => b.position - a.position) // 8..1
  const left = teeth
    .filter((t) => t.arch === arch && t.side === 'left')
    .sort((a, b) => a.position - b.position) // 1..8
  return { right, left, max }
}

export function chartRows(dentition) {
  const teeth = dentition === 'primary' ? PRIMARY_TEETH : PERMANENT_TEETH
  return {
    upper: rowFor(teeth, 'upper', dentition),
    lower: rowFor(teeth, 'lower', dentition),
  }
}

export function getTooth(id) {
  return [...PERMANENT_TEETH, ...PRIMARY_TEETH].find((t) => t.id === id)
}

// Tooth surfaces — used for fillings / caries class mapping.
export const SURFACES = {
  mesial: { en: 'Mesial', ar: 'إنسي', short: 'M' },
  distal: { en: 'Distal', ar: 'وحشي', short: 'D' },
  occlusal: { en: 'Occlusal / Incisal', ar: 'إطباقي / قاطع', short: 'O' },
  buccal: { en: 'Buccal / Facial', ar: 'دهليزي / شفهي', short: 'B' },
  lingual: { en: 'Lingual / Palatal', ar: 'لساني / حنكي', short: 'L' },
}

export const SURFACE_KEYS = ['mesial', 'occlusal', 'distal', 'buccal', 'lingual']

// Is this tooth anterior (incisor/canine)? Used to label occlusal vs incisal.
export function isAnterior(tooth) {
  return tooth.type === 'incisor' || tooth.type === 'canine'
}

// ── Tooth numbering systems ────────────────────────────────────────────────
export const NUMBERING_SYSTEMS = {
  fdi: { en: 'FDI', ar: 'FDI' },
  universal: { en: 'Universal', ar: 'Universal' },
  palmer: { en: 'Palmer', ar: 'Palmer' },
}

function universalLabel(t) {
  const p = t.position, q = t.quadrant
  if (t.dentition === 'permanent') {
    if (q === 1) return String(9 - p)   // Upper-right 8..1 → 1..8
    if (q === 2) return String(8 + p)   // Upper-left  1..8 → 9..16
    if (q === 3) return String(25 - p)  // Lower-left  → 17..24
    if (q === 4) return String(24 + p)  // Lower-right → 25..32
  } else {
    if (q === 5) return ['A', 'B', 'C', 'D', 'E'][5 - p]  // UR primary
    if (q === 6) return ['F', 'G', 'H', 'I', 'J'][p - 1]  // UL primary
    if (q === 7) return ['K', 'L', 'M', 'N', 'O'][5 - p]  // LL primary
    if (q === 8) return ['P', 'Q', 'R', 'S', 'T'][p - 1]  // LR primary
  }
  return t.label
}

// Palmer quadrant bracket symbols (visual ⌐ ¬ L Γ around the position number).
const PALMER_BRACKET = {
  1: '┐', 2: '┌', 3: '└', 4: '┘', // permanent UR UL LL LR
  5: '┐', 6: '┌', 7: '└', 8: '┘', // primary
}
function palmerLabel(t) {
  const left = t.side === 'left'
  const br = PALMER_BRACKET[t.quadrant]
  return left ? `${t.label}${br}` : `${br}${t.label}`
}

export function toothLabel(tooth, system = 'fdi') {
  if (!tooth) return ''
  if (system === 'fdi') return tooth.fdi
  if (system === 'universal') return universalLabel(tooth)
  if (system === 'palmer') return palmerLabel(tooth)
  return tooth.label
}

// Dental term with the opposite-language word in parentheses when in Arabic,
// e.g. "الرحى الأولى (First Molar)". Pass an object shaped { en, ar }.
export function bilingual(obj, lang) {
  if (!obj) return ''
  if (lang === 'ar') return obj.ar ? `${obj.ar} (${obj.en})` : obj.en
  return obj.en
}
