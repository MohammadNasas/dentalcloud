import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPatients } from '../src/lib/patientFilters.js'

const now = new Date(2026, 9, 2, 12)
const iso = (day, hour = 12) => new Date(2026, 9, day, hour).toISOString()
const patients = [
  { id: 'a', name: 'Laila', nameAr: 'ليلى', phone: '+970599123456', fileNo: 1001, createdAt: iso(1) },
  { id: 'b', name: 'Khaled', phone: '0599234567', createdAt: iso(-27, 0) },
  { id: 'c', name: 'Noor', createdAt: iso(-28, 23) },
  { id: 'd', name: 'Future', createdAt: iso(3) },
  { id: 'e', name: 'Legacy', createdAt: 'invalid' },
]
const base = { patients, appointments: [], balanceForPatient: (id) => ({ debt: id === 'a' ? 25 : id === 'b' ? -5 : 0 }), now, allowBalances: true, allowAppointments: true }

test('today uses local midnight boundaries, ignores cancellations and counts each patient once', () => {
  const appointments = [
    { patientId: 'a', start: iso(2, 0), status: 'scheduled' },
    { patientId: 'a', start: iso(2, 9), status: 'completed' },
    { patientId: 'b', start: iso(2, 10), status: 'cancelled' },
    { patientId: 'c', start: iso(3, 0), status: 'scheduled' },
    { patientId: 'd', start: iso(1, 23), status: 'scheduled' },
    { patientId: 'e', start: 'invalid', status: 'scheduled' },
    { patientId: 'missing', start: iso(2), status: 'scheduled' },
  ]
  const result = filterPatients({ ...base, appointments, filter: 'today' })
  assert.deepEqual(result.list.map(p => p.id), ['a'])
  assert.equal(result.counts.today, 1)
})

test('new patients include the first of thirty local calendar days, excluding older, future and invalid dates', () => {
  const result = filterPatients({ ...base, filter: 'new' })
  assert.deepEqual(result.list.map(p => p.id), ['a', 'b'])
  assert.equal(result.counts.new, 2)
})

test('search combines with a filter and updates counts using local or international phone numbers', () => {
  for (const query of ['0599123456', '+970599123456', 'ليلى', '#1001']) {
    const result = filterPatients({ ...base, query, filter: 'debt' })
    assert.deepEqual(result.list.map(p => p.id), ['a'])
    assert.deepEqual(result.counts, { all: 1, debt: 1, today: 0, new: 1 })
  }
  assert.equal(filterPatients({ ...base, filter: 'debt' }).counts.debt, 1)
  const empty = filterPatients({ ...base, query: 'unknown', filter: 'debt' })
  assert.deepEqual(empty.list, [])
  assert.equal(empty.counts.all, 0)
})

test('unavailable and unknown filters fall back to all without accessing gated balances or mutating patients', () => {
  const original = structuredClone(patients)
  for (const filter of ['debt', 'today', 'unknown']) {
    const result = filterPatients({ ...base, filter, allowBalances: false, allowAppointments: false,
      balanceForPatient: () => { throw new Error('Unavailable balance queried') } })
    assert.equal(result.activeFilter, 'all')
    assert.equal(result.list.length, patients.length)
    assert.equal(result.counts.debt, 0)
    assert.equal(result.counts.today, 0)
  }
  assert.deepEqual(patients, original)
})
