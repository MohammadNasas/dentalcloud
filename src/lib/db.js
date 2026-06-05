// ──────────────────────────────────────────────────────────────────────────
//  Local data store. The whole structured database lives in localStorage under
//  one key; binary media (photos / x-rays) live in IndexedDB (see media.js).
//
//  The data layer is deliberately isolated behind these helpers so it can later
//  be swapped for a real cloud backend (REST/Supabase) without touching the UI.
// ──────────────────────────────────────────────────────────────────────────

import { DEFAULT_PRICES } from './treatments'

const DB_KEY = 'dentacare.db.v1'

export const TIERS = {
  student: { id: 'student', en: 'Student', ar: 'الطالب', price: 5, period: 'lifetime' },
  economy: { id: 'economy', en: 'Economy', ar: 'العيادات الصغيرة', price: 60, period: 'year' },
  pro: { id: 'pro', en: 'Pro', ar: 'الاحترافية', price: 100, period: 'year' },
}

// Billing period label for a tier ($5 = one-time/lifetime, others = yearly).
export function tierPeriodLabel(tier, t) {
  return tier?.period === 'lifetime' ? t('packages.lifetime') : t('packages.perYear')
}

// Doctor palette — each doctor gets a distinct calendar colour.
export const DOCTOR_COLORS = [
  '#0d9488', '#6366f1', '#db2777', '#ea580c', '#0891b2',
  '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#2563eb',
]

export function genId(prefix = 'id') {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${rnd}`
}

// NOTE: lightweight obfuscation only — this is a local, offline app. Real
// deployments must hash on a server. Clearly not cryptographically secure.
export function hashPassword(pw) {
  let h = 5381
  for (let i = 0; i < pw.length; i++) h = (h * 33) ^ pw.charCodeAt(i)
  return 'h' + (h >>> 0).toString(16)
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to read DB', e)
    return null
  }
}

export function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
    return true
  } catch (e) {
    console.error('Failed to save DB', e)
    return false
  }
}

export function resetDB() {
  localStorage.removeItem(DB_KEY)
}

// ── Seed: a believable demo clinic so the app feels alive on first launch ──
function daysFromNow(n, h = 9, m = 0) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export function seedDB() {
  const clinicId = genId('clinic')
  const drSara = genId('user')
  const drOmar = genId('user')

  const clinic = {
    id: clinicId,
    name: 'Bright Smile Dental',
    nameAr: 'عيادة الابتسامة المشرقة',
    tier: 'pro',
    createdAt: new Date().toISOString(),
    prices: DEFAULT_PRICES.map((p) => ({ ...p })),
    settings: {
      currency: 'JOD',
      appointmentReminders: true,
      logo: null,
    },
    customInstructions: {}, // edited instruction sheets, keyed by treatment
  }

  const users = [
    {
      id: drSara, clinicId, username: 'sara', passwordHash: hashPassword('1234'),
      name: 'Dr. Sara Khalil', nameAr: 'د. سارة خليل', role: 'admin',
      color: DOCTOR_COLORS[0], specialty: 'General & Cosmetic', isOwner: true,
    },
    {
      id: drOmar, clinicId, username: 'omar', passwordHash: hashPassword('1234'),
      name: 'Dr. Omar Nasser', nameAr: 'د. عمر ناصر', role: 'doctor',
      color: DOCTOR_COLORS[1], specialty: 'Endodontics & Surgery', isOwner: false,
    },
  ]

  const p1 = genId('pt'), p2 = genId('pt'), p3 = genId('pt'), p4 = genId('pt')
  const patients = [
    {
      id: p1, clinicId, fileNo: '1001', name: 'Layla Ahmad', nameAr: 'ليلى أحمد',
      phone: '+962 79 555 1234', gender: 'female', dob: '1992-04-18', age: 34,
      occupation: 'Teacher', address: 'Amman, Jordan', complaint: 'Pain in lower right molar',
      history: { dental: { prevTreatment: true, grinding: true }, medical: {}, systems: { endocrine: ['diabetes2'] }, allergies: ['penicillin'], medications: ['insulin'], social: { smoking: false } },
      exam: {}, perio: {}, plaque: {}, photos: [],
      createdBy: drSara, createdAt: daysFromNow(-40),
    },
    {
      id: p2, clinicId, fileNo: '1002', name: 'Khaled Mansour', nameAr: 'خالد منصور',
      phone: '+962 78 444 9876', gender: 'male', dob: '1985-11-02', age: 40,
      occupation: 'Engineer', address: 'Zarqa, Jordan', complaint: 'Routine check-up & cleaning',
      history: { dental: { prevTreatment: true }, medical: {}, systems: { cardio: ['hypertension'] }, allergies: [], medications: ['antihypertensives'], social: { smoking: true, smokingType: 'Cigarettes, 10/day' } },
      exam: {}, perio: {}, plaque: {}, photos: [],
      createdBy: drSara, createdAt: daysFromNow(-30),
    },
    {
      id: p3, clinicId, fileNo: '1003', name: 'Sami Yousef', nameAr: 'سامي يوسف',
      phone: '+962 77 333 2211', gender: 'male', dob: '2017-06-09', age: 8,
      occupation: 'Student', address: 'Amman, Jordan', complaint: 'Cavity in baby tooth',
      history: { dental: {}, medical: {}, systems: {}, allergies: [], medications: [], social: {} },
      exam: {}, perio: {}, plaque: {}, photos: [],
      createdBy: drOmar, createdAt: daysFromNow(-20),
    },
    {
      id: p4, clinicId, fileNo: '1004', name: 'Nour Hassan', nameAr: 'نور حسن',
      phone: '+962 79 888 7766', gender: 'female', dob: '1998-01-25', age: 28,
      occupation: 'Pharmacist', address: 'Irbid, Jordan', complaint: 'Wants whitening & veneers',
      history: { dental: { prevTreatment: true }, medical: {}, systems: {}, allergies: [], medications: [], social: {} },
      exam: {}, perio: {}, plaque: {}, photos: [],
      createdBy: drSara, createdAt: daysFromNow(-10),
    },
  ]

  const toothRecords = [
    // Layla — caries → composite story on tooth 46 (lower right first molar)
    { id: genId('tr'), clinicId, patientId: p1, toothId: '46', dentition: 'permanent', itemKey: 'caries', kind: 'condition', surfaces: ['occlusal', 'distal'], cariesClass: 'II', status: 'done', date: daysFromNow(-40), doctorId: drSara, price: 0, notes: 'Deep occluso-distal caries' },
    { id: genId('tr'), clinicId, patientId: p1, toothId: '46', dentition: 'permanent', itemKey: 'composite', kind: 'treatment', surfaces: ['occlusal', 'distal'], cariesClass: 'II', status: 'done', date: daysFromNow(-7), doctorId: drSara, price: 40, notes: 'MO composite, shade A2' },
    { id: genId('tr'), clinicId, patientId: p1, toothId: '36', dentition: 'permanent', itemKey: 'caries', kind: 'condition', surfaces: ['occlusal'], cariesClass: 'I', status: 'planned', date: daysFromNow(-7), doctorId: drSara, price: 0, notes: '' },
    { id: genId('tr'), clinicId, patientId: p1, toothId: '16', dentition: 'permanent', itemKey: 'rct', kind: 'treatment', surfaces: [], status: 'planned', date: daysFromNow(-7), doctorId: drOmar, price: 150, notes: 'Irreversible pulpitis' },
    // Khaled — scaling + a crown
    { id: genId('tr'), clinicId, patientId: p2, toothId: '0', dentition: 'permanent', itemKey: 'scaling', kind: 'treatment', surfaces: [], status: 'done', date: daysFromNow(-3), doctorId: drSara, price: 40, notes: 'Full-mouth scaling' },
    { id: genId('tr'), clinicId, patientId: p2, toothId: '26', dentition: 'permanent', itemKey: 'crown', kind: 'treatment', surfaces: [], status: 'planned', date: daysFromNow(-3), doctorId: drSara, price: 200, notes: 'Zirconia crown' },
    // Sami — primary tooth caries
    { id: genId('tr'), clinicId, patientId: p3, toothId: '85', dentition: 'primary', itemKey: 'caries', kind: 'condition', surfaces: ['occlusal'], cariesClass: 'I', status: 'done', date: daysFromNow(-20), doctorId: drOmar, price: 0, notes: '' },
    { id: genId('tr'), clinicId, patientId: p3, toothId: '85', dentition: 'primary', itemKey: 'glassionomer', kind: 'treatment', surfaces: ['occlusal'], status: 'done', date: daysFromNow(-2), doctorId: drOmar, price: 30, notes: 'GI restoration' },
  ]

  const appointments = [
    { id: genId('ap'), clinicId, patientId: p1, doctorId: drOmar, start: daysFromNow(1, 10, 0), end: daysFromNow(1, 10, 45), reason: 'RCT — tooth 16', status: 'scheduled', notes: '', step: 'Access & cleaning' },
    { id: genId('ap'), clinicId, patientId: p2, doctorId: drSara, start: daysFromNow(1, 11, 30), end: daysFromNow(1, 12, 0), reason: 'Crown prep — 26', status: 'scheduled', notes: '', step: 'Preparation & impression' },
    { id: genId('ap'), clinicId, patientId: p4, doctorId: drSara, start: daysFromNow(2, 13, 0), end: daysFromNow(2, 14, 0), reason: 'Whitening session', status: 'scheduled', notes: '', step: '' },
    { id: genId('ap'), clinicId, patientId: p3, doctorId: drOmar, start: daysFromNow(3, 9, 30), end: daysFromNow(3, 10, 0), reason: 'Review baby tooth filling', status: 'scheduled', notes: '', step: '' },
    { id: genId('ap'), clinicId, patientId: p1, doctorId: drSara, start: daysFromNow(-7, 10, 0), end: daysFromNow(-7, 10, 40), reason: 'Composite — 46', status: 'completed', notes: 'Done, patient comfortable', step: 'Completed' },
  ]

  const payments = [
    { id: genId('pay'), clinicId, patientId: p1, amount: 40, methods: [{ method: 'cash', amount: 40 }], date: daysFromNow(-7), doctorId: drSara, note: 'Composite 46' },
    { id: genId('pay'), clinicId, patientId: p2, amount: 20, methods: [{ method: 'card', amount: 20 }], date: daysFromNow(-3), doctorId: drSara, note: 'Part of scaling' },
    { id: genId('pay'), clinicId, patientId: p3, amount: 30, methods: [{ method: 'cash', amount: 30 }], date: daysFromNow(-2), doctorId: drOmar, note: 'GI filling 85' },
  ]

  const db = {
    version: 1,
    clinics: [clinic],
    users,
    patients,
    toothRecords,
    appointments,
    payments,
    suggestions: [],
    session: { currentUserId: null },
  }
  saveDB(db)
  return db
}

export function getOrInitDB() {
  let db = loadDB()
  if (!db) db = seedDB()
  return db
}

// Demo credentials surfaced on the login screen.
export const DEMO_LOGIN = { username: 'sara', password: '1234' }
