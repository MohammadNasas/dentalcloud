import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowSiteMigration, NEW_SITE_URL } from '../src/lib/siteMigration.js'

const old = path => new URL(path, 'https://dentalcloud.pages.dev')
test('migration notice is restricted to the old website, including existing deep links', () => {
  for (const path of ['/', '/login', '/patients', '/patients/123', '/#/patients']) {
    assert.equal(shouldShowSiteMigration(old(path)), true)
  }
  for (const origin of [NEW_SITE_URL, 'https://www.dentalcloudapp.com', 'https://dentalcloudapp.pages.dev', 'http://localhost:5173', 'file:///app/index.html']) {
    assert.equal(shouldShowSiteMigration(new URL(origin)), false)
  }
  assert.equal(shouldShowSiteMigration(old('/'), true), false)
})
test('old payment, recovery and auth callbacks continue on their original origin', () => {
  for (const path of ['/?paypal=subscription&clinic=test', '/?paypal=cancel', '/?paypal=success',
    '/?code=test-code', '/?token_hash=test&type=recovery', '/#access_token=test&type=recovery',
    '/#error=access_denied', '/?error_code=expired', '/#/?paypal=subscription', '/reset-password', '/auth/callback', '/api/paypal-webhook']) {
    assert.equal(shouldShowSiteMigration(old(path)), false, path)
  }
})
