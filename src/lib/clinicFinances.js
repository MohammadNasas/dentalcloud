import { calendarDate, parseCalendarDate } from './calendarDate.js'

export const EXPENSE_CATEGORIES = {
  rent: { ar: 'إيجار العيادة', en: 'Clinic rent' },
  secretary: { ar: 'راتب السكرتيرة', en: 'Receptionist salary' },
  salaries: { ar: 'رواتب الموظفين', en: 'Staff salaries' },
  electricity: { ar: 'الكهرباء', en: 'Electricity' },
  water: { ar: 'المياه', en: 'Water' },
  internet: { ar: 'الإنترنت والاتصالات', en: 'Internet & phone' },
  supplies: { ar: 'مواد ومستلزمات', en: 'Supplies' },
  maintenance: { ar: 'صيانة الأجهزة', en: 'Equipment maintenance' },
  other: { ar: 'مصاريف أخرى', en: 'Other expenses' },
}

export function validExpense(expense) {
  return Object.hasOwn(EXPENSE_CATEGORIES, expense.category)
    && Number.isFinite(expense.amount) && expense.amount > 0 && expense.amount <= 9999999
    && Math.abs(expense.amount * 1000 - Math.round(expense.amount * 1000)) < 0.00001
    && Boolean(parseCalendarDate(expense.date))
    && /^[A-Z]{3}$/.test(expense.currency || '')
    && typeof expense.note === 'string' && expense.note.length <= 500
}

function recordMonth(value) {
  if (parseCalendarDate(value)) return value.slice(0, 7)
  if (!value || typeof value !== 'string') return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? calendarDate(date).slice(0, 7) : ''
}

export function clinicFinanceSummary(payments, expenses, month, currency) {
  const rows = expenses.filter((e) => recordMonth(e.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  // Integer thousandths preserve currencies such as JOD and avoid float drift.
  const sum = (items) => items.reduce((total, row) => {
    const amount = Number(row.amount)
    return total + (Number.isFinite(amount) ? Math.round(amount * 1000) : 0)
  }, 0)
  const includedPayments = payments.filter((p) => recordMonth(p.date) === month && (!p.currency || p.currency === currency))
  const income = sum(includedPayments)
  const operating = sum(rows.filter((e) => e.currency === currency))
  return { rows, income: income / 1000, operating: operating / 1000, net: (income - operating) / 1000,
    otherCurrencyCount: rows.filter((e) => e.currency !== currency).length }
}

export function financeMoney(amount, currency, lang = 'ar') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', {
    style: 'currency', currency, maximumFractionDigits: 3,
  }).format(amount)
}
