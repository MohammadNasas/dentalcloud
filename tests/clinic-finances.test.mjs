import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { setup, asUser, ids, denied } from './helpers/securityFixture.mjs'
import { clinicFinanceSummary, validExpense } from '../src/lib/clinicFinances.js'
import { withoutDeletedRecords } from '../src/lib/undoDelete.js'
const expense = { category: 'rent', amount: 1800, date: '2026-10-05', currency: 'ILS', note: '' }
const sql = await readFile(new URL('../supabase/clinic_expenses.sql', import.meta.url), 'utf8')

test('monthly cash summary uses received payments, precise amounts and matching currency only', () => {
  const payments = [{ amount: '0.1', date: '2026-10-01' }, { amount: .2, date: '2026-10-31' },
    { amount: 90, date: '2026-09-30' }, { amount: 80, date: '2026-11-01' }]
  const summary = clinicFinanceSummary(payments, [
    { ...expense, amount: .001 }, { ...expense, amount: .002 },
    { ...expense, amount: 100, currency: 'JOD' },
  ], '2026-10', 'ILS')
  assert.equal(summary.income, .3)
  assert.equal(summary.operating, .003)
  assert.equal(summary.net, .297)
  assert.equal(summary.otherCurrencyCount, 1)
  assert.equal(clinicFinanceSummary([], [expense], '2026-10', 'ILS').net, -1800)
})
test('expense validation rejects invalid dates, amounts, categories and precision', () => {
  assert.equal(validExpense(expense), true)
  for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: Infinity }, { amount: .0001 },
    { amount: '5' }, { date: '2026-02-30' }, { category: 'unknown' }, { currency: '' }, { note: 'x'.repeat(501) }]) {
    assert.equal(validExpense({ ...expense, ...patch }), false)
  }
})
test('expense undo leaves patients and their payments intact', () => {
  const state = { patients: [{ id: 'p' }], payments: [{ id: 'pay', patientId: 'p' }], expenses: [{ id: 'e', ...expense }] }
  const hidden = withoutDeletedRecords(state, [{ key: 'expenses:e' }])
  assert.equal(hidden.expenses.length, 0)
  assert.deepEqual(hidden.payments, state.payments)
  assert.deepEqual(withoutDeletedRecords(state, []).expenses, state.expenses)
})
test('expense database isolates clinics, validates writes, and enforces subscriptions', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await setup(db)
  await db.exec(await readFile(new URL('../supabase/subscription_enforcement.sql', import.meta.url), 'utf8'))
  await db.exec(sql)
  await db.exec(sql)
  await db.query('update public.clinics set data=$1 where id=$2', [{ tier: 'pro', paid: true, subscriptionProvider: 'manual' }, ids.clinicA])
  const insert = (cid, data = expense) => db.query('insert into public.clinic_expenses(clinic_id,data) values($1,$2) returning id,data', [cid, data])
  await asUser(db, ids.ownerA)
  const row = (await insert(ids.clinicA)).rows[0]
  assert.equal(row.data.clinicId, ids.clinicA)
  assert.equal(row.data.id, row.id)
  await denied(insert(ids.clinicB))
  await assert.rejects(insert(ids.clinicA, { ...expense, amount: -1 }))
  await assert.rejects(insert(ids.clinicA, { ...expense, date: '2026-02-30' }))
  await db.query('update public.clinic_expenses set data=$1 where id=$2', [{ ...expense, amount: 1700 }, row.id])
  await asUser(db, ids.ownerB)
  assert.equal((await db.query('select * from public.clinic_expenses')).rows.length, 0)
  assert.equal((await db.query('delete from public.clinic_expenses where id=$1 returning id', [row.id])).rows.length, 0)
  await denied(insert(ids.clinicB))
  await asUser(db, '', 'service_role')
  await db.query('update public.clinics set data=$1 where id=$2', [{ tier: 'student' }, ids.clinicB])
  await asUser(db, ids.ownerB)
  await denied(insert(ids.clinicB))
  await asUser(db, '', 'service_role')
  await db.query('update public.clinics set data=$1 where id=$2', [{ tier: 'pro', paid: true, paidThrough: '2020-01-01' }, ids.clinicA])
  await asUser(db, ids.ownerA)
  assert.equal((await db.query('select * from public.clinic_expenses')).rows.length, 1)
  await denied(db.query('delete from public.clinic_expenses where id=$1', [row.id]))
  await denied(db.query('update public.clinic_expenses set data=$1 where id=$2', [expense, row.id]))
})
