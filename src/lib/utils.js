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

export function money(n, currency = 'JOD') {
  const v = Number(n || 0)
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`
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
