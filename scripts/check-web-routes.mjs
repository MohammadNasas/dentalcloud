// Run against the deployed site: Vite's local fallback cannot detect CDN redirects.
// Cloudflare Pages provides SPA fallback automatically when there is no 404.html.
// https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering
import assert from 'node:assert/strict'

const base = process.argv[2]
if (!base) throw new Error('Usage: node scripts/check-web-routes.mjs https://your-site.example')
let failed = false
for (const path of ['/login', '/register', '/patients/routing-check']) {
  try {
    const response = await fetch(new URL(path, base), { redirect: 'manual', cache: 'no-store' })
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}, Location=${response.headers.get('location')}`)
    assert.match(response.headers.get('content-type') || '', /text\/html/)
    const html = await response.text()
    assert.match(html, /id="root"/, `${path}: missing React root`)
    assert.match(html, /src="\/assets\//, `${path}: assets must load from the site root`)
    console.log(`PASS ${path}: HTML 200, no redirect, absolute asset paths`)
  } catch (error) {
    failed = true
    console.error(`FAIL ${error.message}`)
  }
}
if (failed) process.exitCode = 1
