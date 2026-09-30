import test from 'node:test'
import assert from 'node:assert/strict'
import { createPatientMatcher } from '../src/lib/patientSearch.js'

const matches = (phone, query) => createPatientMatcher(query)({ phone })

test('finds Palestinian and Israeli phones with/without country code in both directions', () => {
  for (const code of ['970', '972']) {
    const versions = ['0599123456', '599123456', '+' + code + '599123456', '00' + code + '599123456', code + '599123456', '+' + code + ' (0)59 912-3456']
    for (const saved of versions) for (const query of versions) {
      assert.equal(matches(saved, query), true, saved + ' / ' + query)
    }
  }
})

test('also handles country codes and domestic prefixes outside Palestine', () => {
  for (const [local, international] of [
    ['0791234567', '+962791234567'], ['0501234567', '+966501234567'],
    ['0501234567', '+971501234567'], ['02079460958', '+442079460958'],
    ['2025550123', '+12025550123'],
  ]) {
    assert.equal(matches(local, international), true)
    assert.equal(matches(international, local), true)
  }
})

test('ignores separators, direction marks, and Arabic/Persian digit styles', () => {
  assert.equal(matches('+970 59-912-3456', '٠٥٩٩١٢٣٤٥٦'), true)
  assert.equal(matches('۰۵۹۹۱۲۳۴۵۶', '\u200f+٩٧٠ (٥٩) ٩١٢-٣٤٥٦\u200e'), true)
  assert.equal(matches('0599123456', '059 912 3456'), true)
})

test('keeps partial phone search, without confusing explicit country codes', () => {
  assert.equal(matches('+970599123456', '0599'), true)
  assert.equal(matches('0599123456', '123456'), true)
  assert.equal(matches('+970599123456', '+972599123456'), false)
  assert.equal(matches('+970599123456', '972599123456'), false)
  assert.equal(matches('0599123456', '+970599123457'), false)
  assert.equal(matches('0599123456', '+97059'), false)
  assert.equal(matches('123456', '+970599123456'), false)
})

test('preserves names and supports numeric, Arabic, and prefixed file numbers', () => {
  const patient = { name: 'Layla Ahmad', nameAr: 'ليلى أحمد', fileNo: 1234 }
  for (const query of ['layla', 'AHMAD', 'ليلى', '1234', '١٢٣٤', '#1234', '# ١٢٣٤', '  ']) {
    assert.equal(createPatientMatcher(query)(patient), true, query)
  }
  assert.equal(createPatientMatcher('AB-12')({fileNo: 'ab-123'}), true)
  assert.equal(createPatientMatcher('Khaled')(patient), false)
})

test('empty fields and non-phone queries do not produce accidental matches', () => {
  for (const query of ['+', '-', '()', '#', 'abc123456', '999']) {
    assert.equal(createPatientMatcher(query)({}), false)
  }
  assert.equal(matches('0599123456', 'abc123456'), false)
  assert.equal(matches(null, '0599'), false)
})

