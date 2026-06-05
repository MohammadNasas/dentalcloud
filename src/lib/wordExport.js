// ──────────────────────────────────────────────────────────────────────────
//  Word (.docx) export of patient records — for printing / referral to another
//  dentist. Works for a single patient or all patients at once (every tier).
// ──────────────────────────────────────────────────────────────────────────
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx'
import { saveAs } from 'file-saver'
import {
  DENTAL_HISTORY, MEDICAL_HISTORY, SOCIAL_HISTORY, SYSTEMS_HISTORY,
  ALLERGIES, MEDICATIONS, CLINICAL_EXAM,
} from './history'
import { DENTAL_ITEMS } from './treatments'
import { getTooth } from './teeth'
import { PAYMENT_METHODS } from './utils'

const BRAND = '0D9488'
const INK = '1E293B'
const LIGHT = 'F1F5F9'

const L = (obj, lang) => (obj ? obj[lang] ?? obj.en ?? '' : '')

function rtl(lang) { return lang === 'ar' }

function P(text, opts = {}) {
  const { bold, size = 22, color = INK, lang = 'en', align, spacing, italics } = opts
  return new Paragraph({
    bidirectional: rtl(lang),
    alignment: align || (rtl(lang) ? AlignmentType.RIGHT : AlignmentType.LEFT),
    spacing: spacing || { after: 60 },
    children: [new TextRun({ text: String(text ?? ''), bold, size, color, font: 'Arial', rightToLeft: rtl(lang), italics })],
  })
}

function sectionTitle(text, lang) {
  return new Paragraph({
    bidirectional: rtl(lang),
    alignment: rtl(lang) ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: 220, after: 100 },
    border: { bottom: { color: BRAND, space: 2, style: BorderStyle.SINGLE, size: 10 } },
    children: [new TextRun({ text, bold: true, size: 26, color: BRAND, font: 'Arial', rightToLeft: rtl(lang) })],
  })
}

function kv(label, value, lang) {
  return new Paragraph({
    bidirectional: rtl(lang),
    alignment: rtl(lang) ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: 50 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, color: '475569', font: 'Arial', rightToLeft: rtl(lang) }),
      new TextRun({ text: String(value ?? '—'), size: 22, color: INK, font: 'Arial', rightToLeft: rtl(lang) }),
    ],
  })
}

function cell(text, { bold, fill, width, lang, color = INK, align } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      bidirectional: rtl(lang),
      alignment: align || (rtl(lang) ? AlignmentType.RIGHT : AlignmentType.LEFT),
      children: [new TextRun({ text: String(text ?? ''), bold, size: 20, color, font: 'Arial', rightToLeft: rtl(lang) })],
    })],
  })
}

function table(headers, rows, lang, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, fill: BRAND, color: 'FFFFFF', width: widths?.[i], lang })),
  })
  const bodyRows = rows.map((r, ri) =>
    new TableRow({ children: r.map((c, i) => cell(c, { fill: ri % 2 ? LIGHT : 'FFFFFF', width: widths?.[i], lang })) })
  )
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
    },
    visuallyRightToLeft: rtl(lang),
    rows: [headerRow, ...bodyRows],
  })
}

function yn(v, lang) { return v ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No') }

function renderHistory(patient, lang) {
  const out = []
  const h = patient.history || {}

  // Dental + Medical + Social toggles/text
  for (const sec of [DENTAL_HISTORY, MEDICAL_HISTORY, SOCIAL_HISTORY]) {
    const data = h[sec.id] || {}
    const lines = []
    for (const f of sec.fields) {
      const v = data[f.id]
      if (f.type === 'toggle') { if (v) lines.push(kv(L(f, lang), yn(true, lang), lang)) }
      else if (v) lines.push(kv(L(f, lang), v, lang))
    }
    if (lines.length) { out.push(sectionTitle(L(sec.title, lang), lang)); out.push(...lines) }
  }

  // Systemic review
  const sys = h.systems || {}
  const sysLines = []
  for (const g of SYSTEMS_HISTORY.groups) {
    const sel = sys[g.id] || []
    if (sel.length) {
      const labels = sel.map((k) => L(g.options.find((o) => o.key === k) || { en: k }, lang)).join('، ')
      sysLines.push(kv(L(g, lang), labels, lang))
    }
  }
  if (sysLines.length) { out.push(sectionTitle(L(SYSTEMS_HISTORY.title, lang), lang)); out.push(...sysLines) }

  // Allergies & medications
  const allergies = (h.allergies || []).map((k) => L(ALLERGIES.options.find((o) => o.key === k) || { en: k }, lang))
  const meds = (h.medications || []).map((k) => L(MEDICATIONS.options.find((o) => o.key === k) || { en: k }, lang))
  if (allergies.length) { out.push(kv(L(ALLERGIES.title, lang), allergies.join('، '), lang)) }
  if (meds.length) { out.push(kv(L(MEDICATIONS.title, lang), meds.join('، '), lang)) }

  return out
}

function renderExam(patient, lang) {
  const exam = patient.exam || {}
  const lines = []
  for (const s of CLINICAL_EXAM.sections) {
    const v = exam[s.id]
    if (!v || (Array.isArray(v) && !v.length)) continue
    const val = Array.isArray(v)
      ? v.map((k) => L(s.options?.find((o) => o.key === k) || { en: k }, lang)).join('، ')
      : v
    lines.push(kv(L(s, lang), val, lang))
  }
  if (!lines.length) return []
  return [sectionTitle(L(CLINICAL_EXAM.title, lang), lang), ...lines]
}

function buildPatientSections(patient, ctx, lang, { pageBreakBefore } = {}) {
  const { getDoctor, recordsForPatient, paymentsForPatient, balanceForPatient, clinic } = ctx
  const currency = clinic?.settings?.currency || ''
  const out = []
  const name = lang === 'ar' ? patient.nameAr || patient.name : patient.name

  out.push(new Paragraph({
    pageBreakBefore: !!pageBreakBefore,
    bidirectional: rtl(lang),
    alignment: rtl(lang) ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: 40, before: 80 },
    children: [new TextRun({ text: name, bold: true, size: 30, color: INK, font: 'Arial', rightToLeft: rtl(lang) })],
  }))

  // Personal info
  out.push(sectionTitle(lang === 'ar' ? 'المعلومات الشخصية' : 'Personal Information', lang))
  out.push(kv(lang === 'ar' ? 'رقم الملف' : 'File No.', patient.fileNo, lang))
  out.push(kv(lang === 'ar' ? 'الهاتف' : 'Phone', patient.phone, lang))
  out.push(kv(lang === 'ar' ? 'الجنس' : 'Gender', patient.gender ? (lang === 'ar' ? (patient.gender === 'male' ? 'ذكر' : 'أنثى') : patient.gender) : '', lang))
  out.push(kv(lang === 'ar' ? 'العمر' : 'Age', patient.age, lang))
  out.push(kv(lang === 'ar' ? 'تاريخ الميلاد' : 'Date of birth', patient.dob, lang))
  out.push(kv(lang === 'ar' ? 'الوظيفة' : 'Occupation', patient.occupation, lang))
  out.push(kv(lang === 'ar' ? 'العنوان' : 'Address', patient.address, lang))
  if (patient.complaint) out.push(kv(lang === 'ar' ? 'الشكوى' : 'Chief complaint', patient.complaint, lang))

  // History + exam
  out.push(...renderHistory(patient, lang))
  out.push(...renderExam(patient, lang))

  // Dental findings / treatments
  const records = recordsForPatient(patient.id)
  if (records.length) {
    out.push(sectionTitle(lang === 'ar' ? 'الأسنان والعلاجات' : 'Dental Findings & Treatments', lang))
    const rows = [...records]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map((r) => {
        const item = DENTAL_ITEMS[r.itemKey]
        const tooth = r.toothId === '0' ? '—' : (getTooth(r.toothId)?.label || r.toothId)
        const doc = getDoctor(r.doctorId)
        return [
          (r.date || '').slice(0, 10),
          tooth,
          item ? L(item, lang) : r.itemKey,
          r.kind === 'condition' ? (lang === 'ar' ? 'حالة' : 'Condition') : (lang === 'ar' ? 'علاج' : 'Treatment'),
          r.status === 'done' ? (lang === 'ar' ? 'منجز' : 'Done') : (lang === 'ar' ? 'مخطط' : 'Planned'),
          (lang === 'ar' ? doc?.nameAr : doc?.name) || '',
          r.price ? `${r.price} ${currency}` : '',
        ]
      })
    out.push(table(
      lang === 'ar'
        ? ['التاريخ', 'السن', 'الإجراء', 'النوع', 'الحالة', 'الطبيب', 'الأجر']
        : ['Date', 'Tooth', 'Procedure', 'Type', 'Status', 'Doctor', 'Fee'],
      rows, lang, [12, 8, 24, 12, 12, 20, 12]
    ))
  }

  // Payments + balance
  const pays = paymentsForPatient(patient.id)
  const bal = balanceForPatient(patient.id)
  out.push(sectionTitle(lang === 'ar' ? 'الحساب المالي' : 'Account', lang))
  if (pays.length) {
    const rows = pays.map((p) => [
      (p.date || '').slice(0, 10),
      `${p.amount} ${currency}`,
      (p.methods || []).map((m) => L(PAYMENT_METHODS[m.method] || { en: m.method }, lang)).join(' + ') || '—',
      p.note || '',
    ])
    out.push(table(
      lang === 'ar' ? ['التاريخ', 'المبلغ', 'الطريقة', 'ملاحظة'] : ['Date', 'Amount', 'Method', 'Note'],
      rows, lang, [18, 18, 28, 36]
    ))
  }
  out.push(kv(lang === 'ar' ? 'إجمالي الأجور' : 'Total fees', `${bal.fees} ${currency}`, lang))
  out.push(kv(lang === 'ar' ? 'المدفوع' : 'Paid', `${bal.paid} ${currency}`, lang))
  out.push(kv(lang === 'ar' ? 'المتبقي' : 'Remaining', `${bal.debt} ${currency}`, lang))

  return out
}

function clinicHeader(ctx, lang, subtitle) {
  const { clinic } = ctx
  const cname = lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: cname || 'Dental Clinic', bold: true, size: 36, color: BRAND, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [new TextRun({ text: subtitle, size: 20, color: '64748B', font: 'Arial', rightToLeft: rtl(lang) })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      border: { bottom: { color: BRAND, space: 1, style: BorderStyle.SINGLE, size: 12 } },
      children: [new TextRun({ text: `${new Date().toLocaleDateString()} `, size: 16, color: '94A3B8', font: 'Arial' })],
    }),
  ]
}

function makeDoc(children) {
  return new Document({
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [{ properties: {}, children }],
  })
}

export async function exportPatient(patient, ctx) {
  const lang = ctx.lang || 'en'
  const children = [
    ...clinicHeader(ctx, lang, lang === 'ar' ? 'سجل المريض — للإحالة إلى طبيب آخر' : 'Patient Record — for referral / transfer'),
    ...buildPatientSections(patient, ctx, lang),
  ]
  const blob = await Packer.toBlob(makeDoc(children))
  const safe = (patient.name || 'patient').replace(/[^\w؀-ۿ -]/g, '').trim()
  saveAs(blob, `${safe} - record.docx`)
}

export async function exportAllPatients(ctx) {
  const lang = ctx.lang || 'en'
  const patients = ctx.patients || []
  const children = [...clinicHeader(ctx, lang, lang === 'ar' ? `سجل جميع المرضى (${patients.length})` : `All patient records (${patients.length})`)]
  patients.forEach((p, i) => {
    children.push(...buildPatientSections(p, ctx, lang, { pageBreakBefore: i > 0 }))
  })
  const blob = await Packer.toBlob(makeDoc(children))
  saveAs(blob, `${(ctx.clinic?.name || 'clinic')} - all patients.docx`)
}
