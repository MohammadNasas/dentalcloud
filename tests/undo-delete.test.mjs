import test from 'node:test'
import assert from 'node:assert/strict'
import { createUndoDelete, withoutDeletedRecords } from '../src/lib/undoDelete.js'

function harness() {
  let items = [], id = 0
  const timers = new Map()
  const controller = createUndoDelete((value) => { items = value }, {
    now: () => 1000,
    schedule: (fn, delay) => { assert.equal(delay, 10000); timers.set(++id, fn); return id },
    cancel: (key) => timers.delete(key),
  })
  return { controller, timers, items: () => items, fire: async (key) => { const fn = timers.get(key); timers.delete(key); await fn?.() } }
}

test('undo cancels deletion without a server write or restoring a stale snapshot', async () => {
  const h = harness(); let writes = 0
  h.controller.add({ key: 'appointments:1', kind: 'appointment', commit: () => ++writes })
  assert.equal(h.items()[0].deadline, 11000)
  assert.equal(h.controller.undo('appointments:1'), true)
  await h.fire(1)
  assert.equal(writes, 0)
  assert.equal(h.controller.hasPending(), false)
})

test('duplicate delete clicks schedule one write; undo is disabled during commit', async () => {
  const h = harness(); let finish, writes = 0
  const item = { key: 'toothRecords:1', kind: 'treatment', commit: () => { writes++; return new Promise((r) => { finish = r }) } }
  assert.equal(h.controller.add(item), true)
  assert.equal(h.controller.add(item), false)
  const pending = h.fire(1)
  assert.equal(h.items()[0].status, 'committing')
  assert.equal(h.controller.undo(item.key), false)
  finish(true); await pending
  assert.equal(writes, 1)
  assert.deepEqual(h.items(), [])
})

test('multiple deleted records retain independent undo windows', async () => {
  const h = harness(), committed = []
  for (const key of ['appointments:1', 'toothRecords:1']) h.controller.add({ key, commit: () => { committed.push(key); return true } })
  h.controller.undo('appointments:1')
  await h.fire(2)
  assert.deepEqual(committed, ['toothRecords:1'])
  assert.deepEqual(h.items(), [])
})

test('failed or unconfirmed deletions unhide the record and report failure', async () => {
  for (const commit of [() => null, () => { throw new Error('offline') }]) {
    const h = harness(); let failures = 0
    h.controller.add({ key: 'appointments:1', commit, failed: () => failures++ })
    await h.fire(1)
    assert.equal(failures, 1)
    assert.deepEqual(h.items(), [])
  }
})

test('session cleanup cancels outstanding timers; stale callbacks cannot delete', async () => {
  const h = harness(); let writes = 0
  h.controller.add({ key: 'appointments:1', commit: () => ++writes })
  const stale = h.timers.get(1)
  h.controller.reset()
  await stale()
  assert.equal(writes, 0)
  assert.equal(h.timers.size, 0)
})

const patientFixture = () => ({
  patients: [{ id: 'p1', photos: [{ id: 'xray' }], history: { notes: 'original' } }, { id: 'p2' }],
  appointments: [{ id: 'a1', patientId: 'p1' }, { id: 'a2', patientId: 'p2' }],
  toothRecords: [{ id: 't1', patientId: 'p1', price: 50 }],
  payments: [{ id: 'pay1', patientId: 'p1', amount: 20 }],
  labOrders: [{ id: 'lab1', patientId: 'p1' }],
})

test('patient undo restores the entire untouched file and all linked collections without server writes', () => {
  const state = patientFixture(), original = structuredClone(state), h = harness()
  h.controller.add({ key: 'patients:p1', kind: 'patient', commit: () => assert.fail('Undo must not write') })
  const hidden = withoutDeletedRecords(state, h.items())
  assert.deepEqual(hidden.patients, [{ id: 'p2' }])
  assert.deepEqual(hidden.appointments, [{ id: 'a2', patientId: 'p2' }])
  for (const key of ['toothRecords', 'payments', 'labOrders']) assert.deepEqual(hidden[key], [])
  h.controller.undo('patients:p1')
  assert.deepEqual(withoutDeletedRecords(state, h.items()), original)
  assert.strictEqual(state.patients[0].history, withoutDeletedRecords(state, h.items()).patients[0].history)
})

test('patient deletion failure leaves the complete original file recoverable in the view', async () => {
  const state = patientFixture(), h = harness()
  h.controller.add({ key: 'patients:p1', kind: 'patient', commit: () => { throw new Error('offline') } })
  await h.fire(1)
  assert.deepEqual(withoutDeletedRecords(state, h.items()), state)
})

test('confirmed patient removal removes only its linked records from local state', async () => {
  let state = patientFixture(); const h = harness()
  h.controller.add({ key: 'patients:p1', kind: 'patient', commit: () => {
    state = withoutDeletedRecords(state, [{ key: 'patients:p1' }]); return true
  } })
  await h.fire(1)
  assert.deepEqual(state.patients, [{ id: 'p2' }])
  assert.deepEqual(state.appointments, [{ id: 'a2', patientId: 'p2' }])
  assert.deepEqual(state.payments, [])
  assert.deepEqual(state.toothRecords, [])
  assert.deepEqual(state.labOrders, [])
})
