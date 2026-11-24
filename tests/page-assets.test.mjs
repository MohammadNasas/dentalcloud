import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { isPageAssetError } from '../src/lib/pageLoadError.js'

test('asset failures are distinguished from render/data errors', () => {
  for (const message of ['Failed to fetch dynamically imported module: /assets/Appointments-old.js', 'Importing a module script failed.', 'Unable to preload CSS for /assets/old.css']) assert.equal(isPageAssetError(new TypeError(message)), true)
  assert.equal(isPageAssetError(new RangeError('Invalid time value')), false)
  assert.equal(isPageAssetError(new Error('Cannot read properties of undefined')), false)
})

test('service worker evicts HTML cached as JavaScript and never caches a deployment fallback', async () => {
  const handlers = {}, entries = new Map(), writes = []
  const request = new Request('https://dentalcloudapp.com/assets/Appointments-old.js')
  entries.set(request.url, new Response('<html>Old SPA fallback</html>', { headers: { 'content-type': 'text/html' } }))
  let fresh = new Response('<html>SPA fallback</html>', { headers: { 'content-type': 'text/html' } })
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: { location: { origin: 'https://dentalcloudapp.com' }, addEventListener: (name, fn) => { handlers[name] = fn } },
    caches: { open: async () => ({ match: async req => entries.get(req.url), delete: async req => entries.delete(req.url),
      put: async (req, value) => { writes.push(req.url); entries.set(req.url, value) } }) },
    fetch: async () => fresh.clone(), URL, Response,
  })
  const run = () => new Promise(resolve => handlers.fetch({ request, respondWith: value => resolve(value) }))
  assert.match(await (await run()).text(), /SPA fallback/)
  assert.equal(entries.has(request.url), false)
  assert.equal(writes.length, 0)
  fresh = new Response('export default {}', { headers: { 'content-type': 'application/javascript' } })
  assert.match(await (await run()).text(), /export default/)
  assert.equal(writes.length, 1)
  fresh = new Response('<html>Removed again</html>', { headers: { 'content-type': 'text/html' } })
  assert.match(await (await run()).text(), /export default/)
  assert.equal(writes.length, 1, 'valid cached module must not be overwritten with HTML')
})
