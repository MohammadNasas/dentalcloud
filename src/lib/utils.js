import { clsx } from 'clsx'

export const cx = (...args) => clsx(...args)

export function calcAge(dob) {
  if (!dob) return ''
  const b = new Date(dob)
  if (isNaN(b)) return ''
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

// Deterministic soft colour from a string (for patient avatars)
export function colorFromString(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return `hsl(${hue} 55% 92%)`
}
export function colorFromStringDark(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return `hsl(${hue} 45% 42%)`
}

// Comprehensive currency list (MENA + major world). symbol shown in amounts.
export const CURRENCIES = {
  JOD: { symbol: 'د.أ', en: 'Jordanian Dinar', ar: 'دينار أردني' },
  ILS: { symbol: '₪', en: 'Israeli Shekel', ar: 'شيكل إسرائيلي' },
  USD: { symbol: '$', en: 'US Dollar', ar: 'دولار أمريكي' },
  EUR: { symbol: '€', en: 'Euro', ar: 'يورو' },
  GBP: { symbol: '£', en: 'British Pound', ar: 'جنيه إسترليني' },
  SAR: { symbol: 'ر.س', en: 'Saudi Riyal', ar: 'ريال سعودي' },
  AED: { symbol: 'د.إ', en: 'UAE Dirham', ar: 'درهم إماراتي' },
  QAR: { symbol: 'ر.ق', en: 'Qatari Riyal', ar: 'ريال قطري' },
  KWD: { symbol: 'د.ك', en: 'Kuwaiti Dinar', ar: 'دينار كويتي' },
  BHD: { symbol: 'د.ب', en: 'Bahraini Dinar', ar: 'دينار بحريني' },
  OMR: { symbol: 'ر.ع', en: 'Omani Rial', ar: 'ريال عماني' },
  EGP: { symbol: 'ج.م', en: 'Egyptian Pound', ar: 'جنيه مصري' },
  LBP: { symbol: 'ل.ل', en: 'Lebanese Pound', ar: 'ليرة لبنانية' },
  SYP: { symbol: 'ل.س', en: 'Syrian Pound', ar: 'ليرة سورية' },
  IQD: { symbol: 'ع.د', en: 'Iraqi Dinar', ar: 'دينار عراقي' },
  YER: { symbol: 'ر.ي', en: 'Yemeni Rial', ar: 'ريال يمني' },
  TRY: { symbol: '₺', en: 'Turkish Lira', ar: 'ليرة تركية' },
  MAD: { symbol: 'د.م', en: 'Moroccan Dirham', ar: 'درهم مغربي' },
  DZD: { symbol: 'د.ج', en: 'Algerian Dinar', ar: 'دينار جزائري' },
  TND: { symbol: 'د.ت', en: 'Tunisian Dinar', ar: 'دينار تونسي' },
  LYD: { symbol: 'ل.د', en: 'Libyan Dinar', ar: 'دينار ليبي' },
  SDG: { symbol: 'ج.س', en: 'Sudanese Pound', ar: 'جنيه سوداني' },
  IRR: { symbol: '﷼', en: 'Iranian Rial', ar: 'ريال إيراني' },
  CAD: { symbol: 'C$', en: 'Canadian Dollar', ar: 'دولار كندي' },
  AUD: { symbol: 'A$', en: 'Australian Dollar', ar: 'دولار أسترالي' },
  CHF: { symbol: 'Fr', en: 'Swiss Franc', ar: 'فرنك سويسري' },
  JPY: { symbol: '¥', en: 'Japanese Yen', ar: 'ين ياباني' },
  CNY: { symbol: '¥', en: 'Chinese Yuan', ar: 'يوان صيني' },
  INR: { symbol: '₹', en: 'Indian Rupee', ar: 'روبية هندية' },
  PKR: { symbol: '₨', en: 'Pakistani Rupee', ar: 'روبية باكستانية' },
  RUB: { symbol: '₽', en: 'Russian Ruble', ar: 'روبل روسي' },
  ZAR: { symbol: 'R', en: 'South African Rand', ar: 'راند جنوب أفريقي' },
}

export function money(n, currency = 'JOD') {
  const v = Number(n || 0)
  const sym = CURRENCIES[currency]?.symbol || currency
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${sym}`
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

export const PAYMENT_METHODS = {
  cash: { en: 'Cash', ar: 'نقدي', icon: '💵' },
  card: { en: 'Card / Visa', ar: 'بطاقة / فيزا', icon: '💳' },
  insurance: { en: 'Insurance', ar: 'تأمين', icon: '🏥' },
  cheque: { en: 'Cheque', ar: 'شيك', icon: '🧾' },
}

export function download(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
