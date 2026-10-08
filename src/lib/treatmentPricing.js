// Only explicit inputs produce a quote. These are clinic cost estimates, not market prices.
function number(value, min, max) {
  if (value === '' || value == null || typeof value === 'boolean') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

export function pricingOverhead(rows, currency, excludedIds = []) {
  return rows.filter(e => e.currency === currency && e.category !== 'supplies' && !excludedIds.includes(e.id))
    .reduce((sum, e) => sum + Math.round(Number(e.amount) * 1000), 0) / 1000
}

export function treatmentEstimate({ overhead, hours, doctorHourly, margin, treatment, currency }) {
  const h = number(hours, 0.01, 10000), rate = number(doctorHourly, 0, 9999999)
  const m = number(margin, 0, 95), fixed = number(overhead, 0, 999999999)
  const minutes = number(treatment?.minutes, 1, 1440), visits = number(treatment?.visits, 1, 100)
  const direct = number(treatment?.direct, 0, 9999999)
  const max = treatment?.max === '' || treatment?.max == null ? null : number(treatment.max, 0.001, 999999999)
  if ([h, rate, m, fixed, minutes, visits, direct].includes(null) || !Number.isInteger(visits)
    || (treatment?.max !== '' && treatment?.max != null && max === null)) return null
  const time = minutes * visits / 60
  const operating = fixed / h * time, doctor = rate * time
  const cost = operating + doctor + direct
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits
  const factor = 10 ** digits
  const suggested = Math.ceil((cost / (1 - m / 100)) * factor - 1e-8) / factor
  return { time, operating, doctor, direct, cost, suggested, profit: suggested - cost,
    aboveRange: max !== null && suggested > max, belowCost: max !== null && max < cost }
}

export function adoptTreatmentPrice(catalog, key, price) {
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid treatment price')
  return catalog.map(row => row.key === key ? { ...row, price } : row)
}
