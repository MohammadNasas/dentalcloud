import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyWebRoute, postLoginPath, passwordResetRedirect } from '../src/lib/routing.js'

test('old deep links keep their destination and query parameters', () => {
  assert.equal(legacyWebRoute({ pathname: '/', search: '?demo=1', hash: '#/patients/123?tab=history' }), '/patients/123?demo=1&tab=history')
  assert.equal(legacyWebRoute({ pathname: '/index.html', hash: '#/appointments' }), '/appointments')
})

test('route migration never consumes authentication tokens or ordinary anchors', () => {
  for (const hash of ['#access_token=test&refresh_token=test&type=recovery', '#error=access_denied', '#landing-features', '']) {
    assert.equal(legacyWebRoute({ pathname: '/', hash }), null)
  }
  assert.equal(legacyWebRoute({ pathname: '/login', hash: '#/patients' }), null)
})

test('legacy route migration preserves PayPal callback parameters', () => {
  const route = legacyWebRoute({ pathname: '/', search: '?paypal=subscription&subscription_id=I-TEST&clinic=example', hash: '#/packages' })
  assert.equal(route, '/packages?paypal=subscription&subscription_id=I-TEST&clinic=example')
})

test('route migration and sign-in returns reject external destinations and auth loops', () => {
  for (const hash of ['#//example.com', '#/\\example.com']) assert.equal(legacyWebRoute({ pathname: '/', hash }), null)
  for (const path of ['https://example.com', '//example.com', '/\\example.com', '/login', '/register/?x=1', undefined]) {
    assert.equal(postLoginPath(path), '/')
  }
  assert.equal(postLoginPath('/patients/123?tab=history'), '/patients/123?tab=history')
})

test('password recovery always uses the existing website root callback', () => {
  assert.equal(passwordResetRedirect(new URL('https://dentalcloud.pages.dev/login')), 'https://dentalcloud.pages.dev/')
  assert.equal(passwordResetRedirect(new URL('https://dentalcloud.pages.dev/register')), 'https://dentalcloud.pages.dev/')
})
