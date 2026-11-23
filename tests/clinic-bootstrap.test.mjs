import test from 'node:test'
import assert from 'node:assert/strict'
import { loadStaffClinic, loadOwnerClinic } from '../src/lib/clinicBootstrap.js'

test('staff collections start concurrently, preserve pagination and never expose restricted rows', async () => {
  const started = [], release = []
  const rpc = async (_, { p_table, p_after }) => {
    started.push([p_table, p_after])
    if (!p_after) await new Promise(resolve => release.push(resolve))
    return p_table === 'payments' && !p_after
      ? { rows: [{ id: 'hidden', _restricted: true }], next: 'cursor' }
      : { rows: [{ id: `${p_table}-${p_after || 'first'}` }], next: null }
  }
  const pending = loadStaffClinic(rpc, { id: 'clinic' })
  assert.equal(started.length, 6, 'all six requests start before any completes')
  assert.ok(started.every(([, after]) => after === null))
  release.forEach(resolve => resolve())
  const data = await pending
  assert.deepEqual(data.payments, [{ id: 'payments-cursor' }])
  assert.equal(started.length, 7)
  assert.deepEqual(data.expenses, [])
  assert.deepEqual(data.suggestions, [])
})

function ownerClient(read) {
  return { from(table) {
    let scope
    return { select() { return this }, eq(column, value) { scope = [column, value]; return this },
      order(column) { assert.equal(column, 'id'); return this },
      range(start, end) { return read({ table, scope, start, end }) } }
  } }
}

test('owner collections load concurrently, retain clinic scoping and read every page', async () => {
  const calls = [], release = []
  const client = ownerClient(async call => {
    calls.push(call)
    if (!call.start) await new Promise(resolve => release.push(resolve))
    const count = call.table === 'patients' ? (call.start ? 1 : 500) : 0
    return { data: Array.from({ length: count }, (_, i) => ({ id: `${call.start + i}`, clinic_id: 'clinic', data: { name: 'Test' } })) }
  })
  const pending = loadOwnerClinic(client, { id: 'clinic' })
  assert.equal(calls.length, 8)
  for (const call of calls) {
    assert.deepEqual(call.scope, call.table === 'suggestions' ? undefined : ['clinic_id', 'clinic'])
    assert.equal(call.end, 499)
  }
  release.forEach(resolve => resolve())
  const data = await pending
  assert.equal(data.patients.length, 501)
  assert.equal(data.patients[500].id, '500')
  assert.equal(calls.at(-1).start, 500)
})

test('a failed collection rejects the entire profile load rather than returning partial records', async () => {
  await assert.rejects(loadStaffClinic(async (_, { p_table }) => {
    if (p_table === 'patients') throw Error('access revoked')
    return { rows: [{ id: 'record' }], next: null }
  }, { id: 'clinic' }), /access revoked/)
  await assert.rejects(loadOwnerClinic(ownerClient(async ({ table }) => table === 'payments'
    ? { error: Error('network unavailable') } : { data: [] }), { id: 'clinic' }), /network unavailable/)
})

test('overlapping profile loads keep their records isolated even when the first finishes last', async () => {
  let finishOld
  const oldGate = new Promise(resolve => { finishOld = resolve })
  const oldLoad = loadStaffClinic(async () => { await oldGate; return { rows: [{ id: 'old' }], next: null } }, { id: 'old-clinic' })
  const fresh = await loadStaffClinic(async () => ({ rows: [{ id: 'new' }], next: null }), { id: 'new-clinic' })
  finishOld()
  const old = await oldLoad
  assert.equal(fresh.clinic.id, 'new-clinic')
  assert.deepEqual(fresh.patients, [{ id: 'new' }])
  assert.deepEqual(old.patients, [{ id: 'old' }])
})
