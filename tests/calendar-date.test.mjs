import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarDate, calendarDays, parseCalendarDate } from '../src/lib/calendarDate.js'

test('birthdays round-trip as local calendar dates including leap years', () => {
  for (const value of ['1994-09-16', '2000-02-29', '1900-01-01', '2026-12-31']) {
    assert.equal(calendarDate(parseCalendarDate(value)), value)
  }
  for (const value of ['', '2025-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '09/16/1994']) assert.equal(parseCalendarDate(value), null)
})

test('calendar covers complete weeks with correct adjacent months and leap days', () => {
  const september = calendarDays(1994, 8).map(calendarDate)
  assert.equal(september.length, 35)
  assert.equal(september[0], '1994-08-28')
  assert.equal(september.at(-1), '1994-10-01')
  assert.equal(september[19], '1994-09-16')
  assert.ok(calendarDays(2000, 1).map(calendarDate).includes('2000-02-29'))
  assert.equal(calendarDays(2026, 7).length, 42)
})
