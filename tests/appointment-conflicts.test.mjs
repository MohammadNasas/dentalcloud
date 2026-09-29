import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentConflicts } from '../src/lib/appointmentConflicts.js'

const existing = { id: 'a', doctorId: 'd1', patientId: 'p1', start: '2026-09-16T09:00:00+03:00', end: '2026-09-16T09:30:00+03:00', status: 'scheduled' }
const candidate = (patch = {}) => ({ ...existing, id: 'b', patientId: 'p2', ...patch })
const conflicts = (patch, list = [existing]) => appointmentConflicts(candidate(patch), list)

test('warns about partial overlaps, identical times and either containing interval', () => {
  for (const [start, end] of [['09:15', '09:45'], ['08:45', '09:15'], ['09:00', '09:30'], ['09:05', '09:10'], ['08:00', '10:00']]) {
    assert.equal(conflicts({ start: `2026-09-16T${start}:00+03:00`, end: `2026-09-16T${end}:00+03:00` }).length, 1)
  }
})
test('back-to-back appointments and another calendar day do not overlap', () => {
  assert.equal(conflicts({ start: '2026-09-16T09:30:00+03:00', end: '2026-09-16T10:00:00+03:00' }).length, 0)
  assert.equal(conflicts({ start: '2026-09-16T08:30:00+03:00', end: existing.start }).length, 0)
  assert.equal(conflicts({ start: '2026-09-17T09:00:00+03:00', end: '2026-09-17T09:30:00+03:00' }).length, 0)
})
test('checks the same patient across doctors, and allows unrelated doctors and patients', () => {
  assert.equal(conflicts({ doctorId: 'd2', patientId: 'p1' }).length, 1)
  assert.equal(conflicts({ doctorId: 'd2' }).length, 0)
  assert.equal(conflicts({ doctorId: undefined }, [{ ...existing, doctorId: undefined }]).length, 0)
})
test('excludes the appointment being edited, cancellations and no-shows', () => {
  assert.equal(conflicts({ id: 'a' }).length, 0)
  for (const status of ['cancelled', 'noShow']) {
    assert.equal(conflicts({ status }).length, 0)
    assert.equal(conflicts({}, [{ ...existing, status }]).length, 0)
  }
})
test('handles midnight and timezone offsets as actual intervals', () => {
  assert.equal(conflicts({ start: '2026-09-16T06:15:00Z', end: '2026-09-16T06:45:00Z' }).length, 1)
  assert.equal(conflicts({ start: '2026-09-17T00:00:00+03:00', end: '2026-09-17T00:30:00+03:00' }, [{ ...existing, start: '2026-09-16T23:45:00+03:00', end: '2026-09-17T00:15:00+03:00' }]).length, 1)
})
test('invalid and reversed time ranges do not produce warnings', () => {
  assert.equal(conflicts({ start: 'invalid' }).length, 0)
  assert.equal(conflicts({ end: existing.start }).length, 0)
  assert.equal(conflicts({}, [{ ...existing, end: 'invalid' }]).length, 0)
})
