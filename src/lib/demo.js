// Read-only showcase account: a believable Pro clinic full of varied example
// data, loaded entirely in-memory (no Supabase). Reached via ?demo=1 — the
// visitor lands straight in with everything to browse but nothing they can edit.
const CID = 'demo-clinic'
const D1 = 'demo-doc-1'
const D2 = 'demo-doc-2'

function at(dayOffset, h = 10, m = 0) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const ago = (n) => at(-n, 11, 0)

export function buildDemoState() {
  const doctors = [
    { id: D1, clinicId: CID, name: 'Dr. Sara Khalil', nameAr: 'د. سارة خليل', role: 'admin', color: '#0d9488', specialty: 'General & Cosmetic', isOwner: true },
    { id: D2, clinicId: CID, name: 'Dr. Omar Nasser', nameAr: 'د. عمر ناصر', role: 'doctor', color: '#6366f1', specialty: 'Endodontics & Surgery', isOwner: false },
  ]

  const clinic = {
    id: CID, name: 'Bright Smile Dental', nameAr: 'عيادة الابتسامة',
    tier: 'pro', paid: true, createdAt: ago(420),
    prices: [], settings: { currency: 'JOD', appointmentReminders: true, logo: null }, customInstructions: {}, customSheets: [],
  }

  const P = (n, name, nameAr, phone, gender, age, complaint, extra = {}) => ({
    id: `demo-p${n}`, clinicId: CID, fileNo: String(1000 + n),
    name, nameAr, phone, gender, age, dob: '',
    occupation: extra.occupation || '', address: extra.address || '',
    complaint,
    history: { dental: {}, medical: {}, systems: {}, allergies: extra.allergies || [], medications: extra.medications || [], social: {} },
    exam: {}, perio: {}, plaque: {}, photos: [],
    createdBy: D1, createdAt: ago(extra.ago ?? 30),
  })

  const patients = [
    P(1, 'Ahmad Mahmoud', 'أحمد محمود', '+970599100001', 'male', 34, 'ألم في الضرس السفلي الأيمن منذ أسبوع', { ago: 70, occupation: 'مهندس', allergies: ['Penicillin'], medications: ['Metformin'] }),
    P(2, 'Salma Khaled', 'سلمى خالد', '+970599100002', 'female', 27, 'تنظيف وتبييض الأسنان', { ago: 55, occupation: 'معلّمة' }),
    P(3, 'Yousef Odeh', 'يوسف عودة', '+970599100003', 'male', 41, 'ضرس عقل منطمر يسبب ألماً', { ago: 40, occupation: 'محاسب' }),
    P(4, 'Lina Haddad', 'لينا حداد', '+970599100004', 'female', 19, 'تقويم — ازدحام أسنان أمامية', { ago: 25, occupation: 'طالبة' }),
    P(5, 'Mohammad Saleh', 'محمد صالح', '+970599100005', 'male', 52, 'تركيب تاج على سن معالَج لبياً', { ago: 90, occupation: 'تاجر', medications: ['Amlodipine'] }),
    P(6, 'Rana Aziz', 'رنا عزيز', '+970599100006', 'female', 31, 'حساسية شديدة من البارد', { ago: 12, occupation: 'صيدلانية' }),
    P(7, 'Kareem Nimer', 'كريم نمر', '+970599100007', 'male', 8, 'فحص دوري + ختم وقائي', { ago: 8 }),
    P(8, 'Huda Bishara', 'هدى بشارة', '+970599100008', 'female', 46, 'كسر في حشوة قديمة', { ago: 3, occupation: 'موظفة' }),
  ]

  const TR = (id, pid, toothId, kind, itemKey, status, price, surfaces = [], doctorId = D1, days = 20) => ({
    id, clinicId: CID, patientId: pid, doctorId, toothId, kind, itemKey, status, price, surfaces, notes: '', date: ago(days),
  })
  const toothRecords = [
    TR('tr1', 'demo-p1', '46', 'condition', 'caries', 'planned', 0, ['O', 'D'], D1, 70),
    TR('tr2', 'demo-p1', '46', 'treatment', 'composite', 'done', 45, ['O', 'D'], D1, 60),
    TR('tr3', 'demo-p1', '16', 'treatment', 'rct', 'done', 180, [], D2, 30),
    TR('tr4', 'demo-p1', '16', 'treatment', 'crown', 'planned', 250, [], D1, 10),
    TR('tr5', 'demo-p2', '11', 'condition', 'discoloration', 'planned', 0, [], D1, 50),
    TR('tr6', 'demo-p2', '21', 'condition', 'discoloration', 'planned', 0, [], D1, 50),
    TR('tr7', 'demo-p3', '48', 'condition', 'impacted', 'planned', 0, [], D2, 40),
    TR('tr8', 'demo-p4', '13', 'condition', 'attrition', 'planned', 0, [], D1, 25),
    TR('tr9', 'demo-p5', '26', 'treatment', 'rct', 'done', 180, [], D2, 80),
    TR('tr10', 'demo-p5', '26', 'treatment', 'crown', 'done', 250, [], D1, 14),
    TR('tr11', 'demo-p5', '36', 'condition', 'missing', 'planned', 0, [], D1, 80),
    TR('tr12', 'demo-p6', '34', 'condition', 'sensitivity', 'planned', 0, [], D1, 12),
    TR('tr13', 'demo-p7', '55', 'treatment', 'glassionomer', 'done', 30, ['O'], D1, 8),
    TR('tr14', 'demo-p8', '37', 'condition', 'fracture', 'planned', 0, [], D1, 3),
    TR('tr15', 'demo-p8', '37', 'treatment', 'composite', 'done', 50, ['O', 'M'], D1, 2),
  ]

  const A = (id, pid, doctorId, start, reason, status = 'scheduled') => ({
    id, clinicId: CID, patientId: pid, doctorId, start, reason, status, notes: '', step: '',
  })
  const appointments = [
    A('ap1', 'demo-p1', D1, at(0, 9, 30), 'تركيب تاج للسن 16'),
    A('ap2', 'demo-p6', D1, at(0, 11, 0), 'مراجعة حساسية'),
    A('ap3', 'demo-p8', D2, at(0, 13, 0), 'حشوة جديدة'),
    A('ap4', 'demo-p2', D1, at(1, 10, 0), 'تنظيف وتبييض'),
    A('ap5', 'demo-p3', D2, at(1, 12, 30), 'قلع ضرس العقل'),
    A('ap6', 'demo-p4', D1, at(3, 9, 0), 'استشارة تقويم'),
    A('ap7', 'demo-p5', D2, at(5, 14, 0), 'متابعة'),
    A('ap8', 'demo-p7', D1, at(-2, 10, 0), 'فحص دوري', 'done'),
    A('ap9', 'demo-p1', D2, at(-7, 11, 0), 'معالجة لبية', 'done'),
    A('ap10', 'demo-p2', D1, at(-1, 15, 0), 'موعد ملغى', 'cancelled'),
  ]

  const PM = (id, pid, amount, method, days, doctorId = D1) => ({
    id, clinicId: CID, patientId: pid, doctorId, date: ago(days), amount, note: '', methods: [{ method, amount }],
  })
  const payments = [
    PM('pm1', 'demo-p1', 45, 'cash', 60),
    PM('pm2', 'demo-p1', 100, 'card', 30, D2),
    PM('pm3', 'demo-p5', 250, 'card', 80, D2),
    PM('pm4', 'demo-p5', 150, 'insurance', 14),
    PM('pm5', 'demo-p7', 30, 'cash', 8),
    PM('pm6', 'demo-p8', 50, 'cash', 2),
    PM('pm7', 'demo-p2', 40, 'card', 20),
  ]

  const labOrders = [
    { id: 'lab1', clinicId: CID, createdBy: D1, createdAt: ago(12), patientId: 'demo-p1', labName: 'مختبر الدقة', workType: 'crown', customWorkType: '', shade: 'A2', pieces: 1, toothIds: ['16'], specs: 'تاج خزفي على معدن', price: 90, paid: 50, dueDate: at(4), linkedAppointmentId: '', status: 'sent' },
    { id: 'lab2', clinicId: CID, createdBy: D2, createdAt: ago(40), patientId: 'demo-p5', labName: 'مختبر الإتقان', workType: 'crown', customWorkType: '', shade: 'A3', pieces: 1, toothIds: ['26'], specs: 'تاج زيركون', price: 110, paid: 110, dueDate: ago(20), linkedAppointmentId: '', status: 'completed' },
  ]

  return {
    clinic,
    currentUser: doctors[0],
    doctors,
    patients,
    toothRecords,
    appointments,
    payments,
    labOrders,
    suggestions: [],
  }
}
