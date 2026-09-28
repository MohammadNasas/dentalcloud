import test from 'node:test'
import assert from 'node:assert/strict'
import { createWriteQueue } from '../src/lib/writeQueue.js'
import { createCloudWrites } from '../src/lib/cloudWrites.js'
import { paymentErrorMessage } from '../src/lib/paymentErrors.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('writes serialize per record and only latest confirmation replaces the draft', async () => {
  const first = deferred(), second = deferred()
  const calls = [], applied = [], statuses = []
  const queue = createWriteQueue((status) => statuses.push(status))
  const one = queue.enqueue('patient:1', () => { calls.push(1); return first.promise }, (x) => applied.push(x))
  const two = queue.enqueue('patient:1', () => { calls.push(2); return second.promise }, (x) => applied.push(x))
  await Promise.resolve()
  assert.deepEqual(calls, [1])
  first.resolve({ name: 'first keystroke' })
  await one
  assert.deepEqual(applied, [])
  assert.deepEqual(calls, [1, 2])
  second.resolve({ name: 'latest draft' })
  assert.deepEqual(await two, { name: 'latest draft' })
  assert.deepEqual(applied, [{ name: 'latest draft' }])
  assert.deepEqual(statuses.at(-1), { pending: 0, failed: 0 })
})

test('failure stays unsaved; retry reuses the same record and awaits confirmation', async () => {
  const saved = [], statuses = [], writes = []
  let online = false
  const draft = { id: 'payment-1', amount: 80 }
  const queue = createWriteQueue((status) => statuses.push(status))
  const write = async () => { writes.push(draft.id); if (!online) throw Error('offline'); return draft }
  assert.equal(await queue.enqueue(draft.id, write, (x) => saved.push(x)), null)
  assert.equal(queue.hasUnsaved(), true)
  assert.deepEqual(statuses.at(-1), { pending: 0, failed: 1 })
  assert.deepEqual(saved, [])
  online = true
  await queue.retry()
  assert.deepEqual(writes, ['payment-1', 'payment-1'])
  assert.deepEqual(saved, [draft])
  assert.equal(queue.hasUnsaved(), false)
})

test('new edit supersedes a failed draft; retry never overwrites the newer save', async () => {
  const queue = createWriteQueue(), saved = []
  await queue.enqueue('a', async () => { throw Error('offline') })
  await queue.enqueue('a', async () => 'new', (v) => saved.push(v))
  await queue.retry()
  assert.deepEqual(saved, ['new'])
})

test('different records save independently and reset isolates a previous session', async () => {
  const wait = deferred(), applied = []
  const queue = createWriteQueue()
  const old = queue.enqueue('a', () => wait.promise, (v) => applied.push(v))
  await Promise.resolve()
  assert.equal(await queue.enqueue('b', async () => 'b'), 'b')
  queue.reset()
  wait.resolve('old account data')
  assert.equal(await old, null)
  assert.deepEqual(applied, [])
})

function clientReturning(result) {
  const calls = []
  const chain = {}
  for (const method of ['upsert', 'update', 'delete', 'eq', 'select']) {
    chain[method] = (...args) => { calls.push([method, ...args]); return chain }
  }
  chain.single = async () => result
  return {
    calls,
    from(table) { calls.push(['from', table]); return chain },
    async rpc(...args) { calls.push(['rpc', ...args]); return result },
  }
}

test('server errors and writes with no authorized row never resolve as saved', async () => {
  for (const result of [{ data: null, error: Error('RLS denied') }, { data: null, error: null }]) {
    const backend = createCloudWrites(clientReturning(result))
    await assert.rejects(backend.save('patients', { id: 'p', clinicId: 'c' }))
    await assert.rejects(backend.saveClinic({ id: 'c' }))
    await assert.rejects(backend.remove('payments', 'p'))
    await assert.rejects(backend.remove('patients', 'p'))
  }
})

test('canonical server data wins over client subscription fields and identity', async () => {
  const backend = createCloudWrites(clientReturning({ data: { id: 'c', data: { paid: false, name: 'Clinic' } } }))
  assert.deepEqual(await backend.saveClinic({ id: 'c', paid: true }), { id: 'c', paid: false, name: 'Clinic' })
})

test('patient deletion uses one atomic RPC, never separate child deletes', async () => {
  const client = clientReturning({ data: 'patient-1' })
  assert.equal(await createCloudWrites(client).remove('patients', 'patient-1'), true)
  assert.deepEqual(client.calls, [['rpc', 'delete_patient_with_records', { p_patient_id: 'patient-1' }]])
})

test('checkout diagnostics are not exposed as SQL or provider internals', () => {
  const message = 'PGRST205 public.subscription_trials secret diagnostic'
  for (const lang of ['ar', 'en']) {
    const displayed = paymentErrorMessage({ error: 'server_error', message }, lang)
    assert.ok(displayed.length > 20)
    assert.ok(!/PGRST|subscription_trials|secret/.test(displayed))
  }
})
