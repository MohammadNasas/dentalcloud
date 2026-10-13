import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

export const IMPORT_LIMITS = { bytes: 10 * 1024 * 1024, rows: 500, columns: 60, text: 15000 }
export const IMPORT_FIELDS = ['name', 'phone', 'fileNo', 'dob', 'address', 'history', 'fees', 'paid', 'balance', 'currency', 'asOf']
const aliases = {
  name: ['name', 'patient', 'patient name', 'full name', 'الاسم', 'اسم المريض', 'المريض', 'الاسم الكامل'],
  phone: ['phone', 'mobile', 'telephone', 'whatsapp', 'phone number', 'رقم الهاتف', 'الهاتف', 'هاتف', 'جوال', 'موبايل', 'رقم الجوال', 'واتساب'],
  fileNo: ['file', 'file no', 'file number', 'patient id', 'رقم الملف', 'رقم المريض', 'ملف'],
  dob: ['dob', 'birth date', 'date of birth', 'تاريخ الميلاد', 'الميلاد'],
  address: ['address', 'العنوان', 'عنوان', 'السكن'],
  history: ['notes', 'note', 'treatment', 'treatments', 'history', 'ملاحظات', 'ملاحظه', 'علاج', 'العلاج', 'العلاجات', 'التفاصيل', 'السجل'],
  fees: ['fees', 'total cost', 'cost', 'total fees', 'التكلفه', 'تكلفه العلاج', 'اجمالي التكلفه', 'قيمه العلاج', 'المطلوب'],
  paid: ['paid', 'amount paid', 'total paid', 'payment', 'المدفوع', 'مدفوع', 'دفع', 'الدفعات', 'مجموع الدفعات'],
  balance: ['balance', 'outstanding', 'remaining', 'debt', 'الرصيد', 'المتبقي', 'متبقي', 'الباقي', 'الدين'],
  currency: ['currency', 'العمله', 'عمله'],
  asOf: ['as of', 'balance date', 'تاريخ الرصيد', 'حتى تاريخ'],
}
export function digits(value) { return String(value ?? '').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)) }
export function normalizeImport(value) { return digits(value).toLowerCase().replace(/[\u064b-\u065f\u0670\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[_.:#]/g, ' ').replace(/\s+/g, ' ').trim() }
export function guessField(value) { const v = normalizeImport(value); return IMPORT_FIELDS.find(k => aliases[k].some(a => normalizeImport(a) === v)) || '' }
export function parseLabeledRecord(text) {
  const fields = {}, notes = []
  for (const part of String(text).split(/[\n؛;|]/)) {
    const match = part.match(/^\s*([^:=]{1,40})\s*[:=]\s*(.*)$/)
    const key = match && guessField(match[1])
    if (key) fields[key] = fields[key] ? `${fields[key]} / ${match[2].trim()}` : match[2].trim()
    else if (part.trim()) notes.push(part.trim())
  }
  fields.history = [fields.history, ...notes].filter(Boolean).join('\n')
  return fields
}
export function groupLabeledLines(lines) {
  // A new explicitly labelled name starts a new record. Never infer the boundary
  // of a patient from an amount, blank line or a possible treatment name.
  const rows = []; let current = null
  lines.forEach((line,index) => {
    const first = line.split(/[؛;|]/)[0].match(/^\s*([^:=]{1,40})\s*[:=]/)
    if (first && guessField(first[1]) === 'name') {
      current = { row:index+1,cells:[line] }; rows.push(current)
    } else if (current) current.cells[0] += `\n${line}`
    else if (line.trim()) rows.push({row:index+1,cells:[line]})
  })
  return rows
}
export function suggestMapping(rows) {
  if (rows.length && rows.every(r => r.cells.length === 1) && rows.some(r => parseLabeledRecord(r.cells[0]).name))
    return { header:-1,score:1,mapping:['record'] }
  let best = { header: -1, score: 0, mapping: [] }
  rows.slice(0, 12).forEach((row, index) => {
    const mapping = row.cells.map(guessField), score = new Set(mapping.filter(Boolean)).size
    if (score >= 2 && score > best.score) best = { header: index, score, mapping }
  })
  return best
}
export function parseAmount(value, format = 'auto', signed = false) {
  let v = digits(value).trim().replace(/[\u200e\u200f]/g, '')
  if (!v) return { value: null }
  v = v.replace(/(?:JOD|ILS|USD|EUR|NIS|شيكل|دينار|دولار|₪|\$|€)/gi, '').trim().replace(/\u066c/g, ',').replace(/\u066b/g, '.')
  if (!/^[+-]?[\d.,\s]+$/.test(v)) return { error: 'amount' }
  v = v.replace(/\s/g, '')
  if (format === 'comma') {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,3})?$/.test(v)) return { error: 'amount' }
    v = v.replace(/\./g, '').replace(',', '.')
  } else if (format === 'dot') {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(v)) return { error: 'amount' }
    v = v.replace(/,/g, '')
  } else {
    if (/^[+-]?\d+[,.]\d{3}$/.test(v)) return { error: 'amountAmbiguous' }
    if (v.includes(',') && v.includes('.')) return { error: 'amountAmbiguous' }
    if (!/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(v)) return { error: 'amount' }
    v = v.replace(',', '.')
  }
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= 100000000 && (signed || n >= 0) ? { value: Math.round(n * 1000) / 1000 } : { error: 'amount' }
}
export function parseImportDate(value, order = 'auto') {
  const v = digits(value).trim()
  if (!v) return { value: '' }
  let y, m, d
  let match = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (match) [, y, m, d] = match.map(Number)
  else {
    match = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
    if (!match) return { error: 'date' }
    let a = Number(match[1]), b = Number(match[2]); y = Number(match[3])
    if (order === 'auto' && a <= 12 && b <= 12 && a !== b) return { error: 'dateAmbiguous' }
    ;[d, m] = order === 'mdy' || (order === 'auto' && b > 12) ? [b, a] : [a, b]
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (y < 1900 || y > 2100 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return { error: 'date' }
  return { value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}
export function importToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function phoneKey(value) {
  const v = digits(value).trim().replace(/^00/, '+').replace(/[\s().-]/g, '')
  const p = v.startsWith('+') ? parsePhoneNumberFromString(v) : null
  return p?.isPossible() ? `${p.countryCallingCode}:${p.nationalNumber}` : v
}
function sourceCurrency(fields, fallback) {
  const direct = normalizeImport(fields.currency)
  const aliases = { ils:'ILS', nis:'ILS', شيكل:'ILS', jod:'JOD', 'دينار اردني':'JOD', usd:'USD', 'دولار امريكي':'USD', eur:'EUR', يورو:'EUR' }
  if (direct) return aliases[direct] || fields.currency.toUpperCase()
  const text = [fields.fees,fields.paid,fields.balance,fields.history].join(' ')
  const found = []
  for (const [code, pattern] of [['JOD',/JOD|دينار\s*أردني/i],['ILS',/ILS|NIS|شيكل|₪/i],['USD',/USD|دولار\s*أمريكي/i],['EUR',/EUR|يورو|€/i]]) if (pattern.test(text)) found.push(code)
  if (found.length > 1) return 'MIXED'
  if (found.length === 1) return found[0]
  if (/\$|دولار|دينار/.test(text)) return '?'
  return fallback || ''
}
export function duplicateCandidates(row, existing) {
  return existing.filter(p => {
    if (row.fileNo && normalizeImport(row.fileNo) === normalizeImport(p.fileNo)) return true
    if (row.name && normalizeImport(row.name) === normalizeImport(p.nameAr || p.name)) return true
    if (!row.phone || !p.phone) return false
    const a = phoneKey(row.phone), b = phoneKey(p.phone)
    if (a === b && a.replace(/\D/g, '').length >= 7) return true
    // International/local matches are only suggestions; never merge family phones.
    const national = (v) => v.includes(':') ? v.split(':')[1] : v.replace(/^0/, '')
    return a.includes(':') !== b.includes(':') && national(a).length >= 7 && national(a) === national(b)
  })
}
export function duplicateLookup(records) {
  const index = new Map()
  function keys(record, lookup = false) {
    const keys = [], name = normalizeImport(record.nameAr || record.name), file = normalizeImport(record.fileNo)
    if (name) keys.push(`name:${name}`)
    if (file) keys.push(`file:${file}`)
    if (record.phone) {
      const phone = phoneKey(record.phone)
      if (phone.replace(/\D/g,'').length >= 7) {
        keys.push(`phone:${phone}`)
        const intl = phone.includes(':'), national = intl ? phone.split(':')[1] : phone.replace(/^0/,'')
        // Local numbers may be an international number without its dial code;
        // two different explicit country codes must not match each other.
        keys.push(`${lookup ? (intl ? 'local' : 'international') : (intl ? 'international' : 'local')}:${national}`)
      }
    }
    return keys
  }
  for (const record of records) for (const key of keys(record)) {
    if (!index.has(key)) index.set(key, [])
    index.get(key).push(record)
  }
  return record => [...new Set(keys(record,true).flatMap(key => index.get(key) || []))].filter(p => p !== record)
}
function extractLabel(text, field) {
  const normalized = digits(text).toLowerCase().replace(/[\u064b-\u065f\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
  const found = []
  for (const label of aliases[field]) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = [...normalized.matchAll(new RegExp(`(?:^|[\\s،;,|])${escaped}\\s*[:=]?\\s*([+-]?[0-9]+(?:[.,][0-9]+)?)`, 'gi'))]
    for (const m of matches) {
      if (/(?:لم|لا|غير|not|unpaid)\s*$/.test(normalized.slice(Math.max(0,m.index-12),m.index))) return ''
      found.push(m[1])
    }
  }
  return found.length === 1 ? found[0] : ''
}
export function analyzeRows(sheet, mapping, header, options = {}) {
  const used = mapping.filter(Boolean)
  if (new Set(used).size !== used.length) throw new Error('duplicateMapping')
  if (!mapping.includes('name') && !mapping.includes('record')) throw new Error('nameMapping')
  const rows = sheet.rows.slice(header + 1).filter(r => r.cells.some(c => String(c).trim()))
  if (rows.length > IMPORT_LIMITS.rows) throw new Error('rowLimit')
  return rows.map(source => {
    const fields = Object.fromEntries(IMPORT_FIELDS.map(k => [k, '']))
    mapping.forEach((field, index) => { if (field === 'record') Object.assign(fields, parseLabeledRecord(source.cells[index] || '')) })
    mapping.forEach((field, index) => { if (field && field !== 'record') fields[field] = String(source.cells[index] ?? '').trim() })
    const original = source.cells.map((v, i) => `${header >= 0 ? sheet.rows[header]?.cells[i] || i + 1 : i + 1}: ${v}`).join('\n')
    for (const field of ['fees', 'paid', 'balance']) if (!fields[field]) fields[field] = extractLabel(fields.history, field)
    const fees = parseAmount(fields.fees, options.numberFormat), paid = parseAmount(fields.paid, options.numberFormat)
    const explicit = parseAmount(fields.balance, options.numberFormat, true)
    const derived = fees.value !== null && paid.value !== null && !fees.error && !paid.error ? Math.round((fees.value - paid.value) * 1000) / 1000 : null
    const financial = Boolean(fields.fees || fields.paid || fields.balance)
    const summary = /^(?:total|subtotal|sum|المجموع|مجموع|الاجمالي|اجمالي)(?:\s|$)/i.test(normalizeImport(fields.name))
    return { ...fields, currency: sourceCurrency(fields, options.currency), key: `${sheet.name}:${source.row}`, sourceRow: source.row,
      original, formulas: source.formulas || [], sheet: sheet.name, included: !summary, summary,
      opening: explicit.value != null ? String(explicit.value) : derived != null ? String(derived) : '',
      financeMode: financial ? 'review' : 'unknown', reviewed: false, duplicateAccepted: false,
    }
  })
}
export function rowIssues(row, options = {}, existing = [], knownDuplicates) {
  const errors = [], warnings = []
  if (!row.name.trim() || row.name.length > 200) errors.push('name')
  if (/^[\d\s+.,-]+$/.test(digits(row.name))) errors.push('name')
  if (row.phone && !/^\+?[\d\s().-]{7,25}$/.test(digits(row.phone))) errors.push('phone')
  if (row.fileNo.length > 100 || row.address.length > 1000 || row.history.length > IMPORT_LIMITS.text) errors.push('length')
  const dob = parseImportDate(row.dob, options.dateOrder)
  if (dob.error) errors.push(dob.error)
  if (dob.value && dob.value > importToday()) errors.push('futureDob')
  if (row.financeMode === 'review') errors.push('financeReview')
  if (row.financeMode === 'opening') {
    const balance = parseAmount(row.opening, 'dot', true)
    if (balance.error || balance.value === null) errors.push('opening')
    if (row.currency.toUpperCase() !== options.currency) errors.push('currency')
    const date = parseImportDate(row.asOf, options.dateOrder)
    if (date.error) errors.push(date.error)
    if (date.value && date.value > importToday()) errors.push('futureBalance')
    if (options.allowBalances === false) errors.push('financialPlan')
  }
  const fees = parseAmount(row.fees, options.numberFormat), paid = parseAmount(row.paid, options.numberFormat), balance = parseAmount(row.balance, options.numberFormat, true)
  for (const part of [fees, paid, balance]) if (part.error) warnings.push(part.error)
  if ([fees.value, paid.value, balance.value].every(x => x != null) && Math.abs(fees.value - paid.value - balance.value) > .001) warnings.push('conflict')
  if (row.formulas.length) warnings.push('formula')
  if (!row.phone) warnings.push('noPhone')
  const duplicates = knownDuplicates ?? duplicateCandidates(row, existing)
  if (duplicates.length && !row.duplicateAccepted) errors.push('duplicate')
  if (!row.reviewed) errors.push('review')
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], duplicates }
}
export async function importPatientId(clinicId, fingerprint, sheet, row) {
  const bytes = new TextEncoder().encode(JSON.stringify(['patient-import-v1', clinicId, fingerprint, sheet, row]))
  const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
}
export async function prepareImport(rows, context) {
  const selected = rows.filter(r => r.included)
  if (!selected.length || selected.length > IMPORT_LIMITS.rows || !context.clinicId || !context.userId || !context.fingerprint) throw new Error('invalidBatch')
  const result = []
  const duplicates = duplicateLookup([...(context.existing || []),...selected])
  for (const row of selected) {
    if (rowIssues(row, context, [], duplicates(row)).errors.length) throw new Error('reviewRequired')
    const id = await importPatientId(context.clinicId, context.fingerprint, row.sheet, row.sourceRow)
    if (result.some(p => p.id === id)) throw new Error('invalidBatch')
    result.push({ id, clinicId: context.clinicId, name: row.name.trim(), nameAr: row.name.trim(), phone: digits(row.phone).trim(),
      fileNo: row.fileNo.trim() || `IMP-${id.slice(0, 8)}`, dob: parseImportDate(row.dob, context.dateOrder).value, age: '', gender: '', address: row.address,
      complaint: '', occupation: '', history: { dental: {}, medical: {}, systems: {}, allergies: [], medications: [], social: {} },
      exam: {}, orthodontics: {}, perio: {}, plaque: {}, photos: [], createdBy: context.userId, createdAt: new Date().toISOString(),
      importedHistory: row.history, openingBalance: row.financeMode === 'opening' ? {
        amount: parseAmount(row.opening, 'dot', true).value, currency: context.currency,
        asOf: parseImportDate(row.asOf, context.dateOrder).value || null, confirmed: true,
      } : null,
      importSource: { version: 1, fingerprint: context.fingerprint, file: context.fileName, sheet: row.sheet, row: row.sourceRow,
        original: row.original, financialStatus: row.financeMode === 'opening' ? 'confirmed' : 'unknown', reviewedBy: context.userId },
    })
  }
  return result
}
export function patientBalance(patient, records, payments, currency) {
  const fees = records.reduce((s, r) => s + (Number(r.price) || 0), 0)
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const b = patient?.openingBalance
  const opening = b?.confirmed === true && b.currency === currency && Number.isFinite(b.amount) ? b.amount : 0
  const raw = Math.round((fees - paid + opening) * 1000) / 1000
  return { fees, paid, opening, debt: Math.max(0, raw), raw,
    unknown: Boolean(patient?.importSource && !b), currencyMismatch: Boolean(b && b.currency !== currency) }
}
