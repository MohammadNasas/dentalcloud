import test from 'node:test'
import assert from 'node:assert/strict'
import { onboardingKey, initialOnboarding, readOnboarding, writeOnboarding, confirmOnboardingSave, onboardingSteps } from '../src/lib/onboarding.js'
import { createWriteQueue } from '../src/lib/writeQueue.js'

test('new clinics get setup; existing clinics are not interrupted; Student has no appointment step', () => {
  assert.equal(initialOnboarding().dismissed, false)
  assert.equal(initialOnboarding({ patients: [{ id: 'p' }] }).dismissed, true)
  assert.equal(initialOnboarding({ appointments: [{ id: 'a' }] }).dismissed, true)
  assert.deepEqual(onboardingSteps({}, false).map(s => s.id), ['clinic', 'patient'])
  assert.equal(onboardingSteps({}, true).length, 3)
})

test('failed and pending saves never complete steps; confirmed retry does', async () => {
  const key = onboardingKey('retry-clinic', 'u')
  writeOnboarding(key, initialOnboarding())
  const queue = createWriteQueue()
  let fail = true
  const save = queue.enqueue('patients:p', async () => {
    if (fail) throw new Error('offline')
    return { id: 'p' }
  }, saved => confirmOnboardingSave('retry-clinic', 'u', 'patient', saved))
  assert.equal(readOnboarding(key).patient, false)
  await save
  assert.equal(readOnboarding(key).patient, false)
  fail = false
  await queue.retry()
  assert.equal(readOnboarding(key).patient, true)
  confirmOnboardingSave('retry-clinic', 'u', 'clinic', null)
  assert.equal(readOnboarding(key).clinic, false)
})

test('progress, minimize and dismiss are isolated by clinic and user', () => {
  const a = onboardingKey('clinic-a', 'u1'), b = onboardingKey('clinic-b', 'u1'), c = onboardingKey('clinic-a', 'u2')
  for (const key of [a, b, c]) writeOnboarding(key, initialOnboarding())
  writeOnboarding(a, { collapsed: true, dismissed: true })
  confirmOnboardingSave('clinic-a', 'u1', 'appointment', { id: 'a' })
  assert.equal(readOnboarding(a).collapsed, true)
  assert.equal(readOnboarding(a).appointment, true)
  assert.equal(readOnboarding(b).dismissed, false)
  assert.equal(readOnboarding(c).appointment, false)
})
