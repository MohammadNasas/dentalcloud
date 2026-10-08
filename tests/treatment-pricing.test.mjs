import test from 'node:test'
import assert from 'node:assert/strict'
import { pricingOverhead, treatmentEstimate, adoptTreatmentPrice, initialPricingPlan } from '../src/lib/treatmentPricing.js'

const base = { overhead: 6000, hours: '100', doctorHourly: '20', margin: '25', currency: 'JOD', treatment: { minutes: '30', visits: '2', direct: '40', max: '' } }
test('full treatment includes overhead and doctor time for all visits, materials once, and margin on revenue', () => {
  const r = treatmentEstimate(base)
  assert.equal(r.operating, 60)
  assert.equal(r.doctor, 20)
  assert.equal(r.direct, 40)
  assert.equal(r.cost, 120)
  assert.equal(r.suggested, 160)
  assert.equal(r.profit, 40)
})
test('overhead excludes supplies, other currencies and explicitly excluded expenses', () => {
  const rows = [{ id: 'rent', category: 'rent', amount: 100.125, currency: 'JOD' },
    { id: 'salary', category: 'salaries', amount: 500, currency: 'JOD' },
    { id: 'supply', category: 'supplies', amount: 800, currency: 'JOD' },
    { id: 'usd', category: 'rent', amount: 1000, currency: 'USD' }]
  assert.equal(pricingOverhead(rows, 'JOD', ['salary']), 100.125)
})
test('missing and invalid inputs cannot become adoptable quotes; explicit zero costs are allowed', () => {
  for (const hours of ['', 0, -1, Infinity, 'abc', null]) assert.equal(treatmentEstimate({ ...base, hours }), null)
  for (const margin of ['', -1, 100, 96]) assert.equal(treatmentEstimate({ ...base, margin }), null)
  for (const visits of ['', 0, 1.5]) assert.equal(treatmentEstimate({ ...base, treatment: { ...base.treatment, visits } }), null)
  assert.equal(treatmentEstimate({ ...base, doctorHourly: '' }), null)
  assert.equal(treatmentEstimate({ ...base, treatment: { ...base.treatment, direct: '' } }), null)
  assert.equal(treatmentEstimate({ ...base, doctorHourly: 0, margin: 0, treatment: { ...base.treatment, direct: 0 } }).suggested, 60)
})
test('prices round upward in currency minor units and never silently cap below costs', () => {
  const data = { ...base, rounding: '0', overhead: 1, hours: 3, doctorHourly: 0, margin: 0, treatment: { minutes: 60, visits: 1, direct: 0, max: 0.2 } }
  assert.equal(treatmentEstimate(data).suggested, 0.334)
  assert.equal(treatmentEstimate({ ...data, currency: 'USD' }).suggested, 0.34)
  assert.equal(treatmentEstimate({ ...data, currency: 'JPY' }).suggested, 1)
  assert.equal(treatmentEstimate(data).belowCost, true)
  assert.equal(treatmentEstimate(data).aboveRange, true)
  assert.equal(treatmentEstimate({ ...base, treatment: { ...base.treatment, max: 150 } }).belowCost, false)
  assert.equal(treatmentEstimate({ ...base, treatment: { ...base.treatment, max: 150 } }).aboveRange, true)
})
test('adoption updates only selected treatment and preserves custom catalog data', () => {
  const catalog = [{ key: 'filling', price: 40, ar: 'حشوة', extra: 1 }, { key: 'custom', price: 600, en: 'Custom' }]
  const result = adoptTreatmentPrice(catalog, 'filling', 65)
  assert.equal(result[0].price, 65)
  assert.equal(result[0].extra, 1)
  assert.equal(result[1], catalog[1])
  assert.equal(catalog[0].price, 40)
  assert.throws(() => adoptTreatmentPrice(catalog, 'filling', NaN))
})

test('new months inherit the latest earlier currency plan but not expense exclusions or future data', () => {
  const plans = { JOD: { '2026-09': { hours: '100', excludedIds: ['rent'], treatments: { composite: { minutes: '30', direct: '40' } } },
    '2026-12': { hours: '900' } }, USD: { '2026-10': { hours: '500' } } }
  const result = initialPricingPlan(plans, 'JOD', '2026-10')
  assert.equal(result.sourceMonth, '2026-09')
  assert.equal(result.plan.hours, '100')
  assert.equal(result.plan.rounding, '1')
  assert.deepEqual(result.plan.excludedIds, [])
  result.plan.treatments.composite.minutes = '50'
  assert.equal(plans.JOD['2026-09'].treatments.composite.minutes, '30')
  assert.deepEqual(initialPricingPlan(plans, 'JOD', '2026-09').plan.excludedIds, ['rent'])
  assert.equal(initialPricingPlan(plans, 'JOD', '2026-08').plan.hours, '')
  assert.equal(initialPricingPlan(plans, 'EUR', '2026-10').plan.hours, '')
})

test('saved current month takes precedence over inherited settings', () => {
  const result = initialPricingPlan({ JOD: { '2026-09': { hours: '100' }, '2026-10': { hours: '60', rounding: '5' } } }, 'JOD', '2026-10')
  assert.equal(result.sourceMonth, null)
  assert.equal(result.plan.hours, '60')
  assert.equal(result.plan.rounding, '5')
})

test('friendly prices round upward while preserving exact costs and recomputing profit and ceiling warnings', () => {
  const data = { ...base, overhead: 4470.125, treatment: { ...base.treatment, max: '139.8' } }
  const r = treatmentEstimate(data)
  assert.equal(r.precise, 139.602)
  assert.equal(r.suggested, 140)
  assert.equal(r.cost, 104.70125)
  assert.equal(r.profit, 140 - r.cost)
  assert.equal(r.aboveRange, true)
  assert.equal(treatmentEstimate({ ...data, rounding: '0' }).aboveRange, false)
  assert.equal(treatmentEstimate({ ...base, overhead: 4600, rounding: '5' }).suggested, 145)
  assert.equal(treatmentEstimate({ ...base, overhead: 4600, rounding: '10' }).suggested, 150)
  assert.equal(treatmentEstimate({ ...base, rounding: '2' }), null)
})
