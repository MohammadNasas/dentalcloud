import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pageMetadata } from '../src/lib/seo.js'

test('only anonymous marketing home is indexable; campaign params canonicalize',()=>{
  assert.equal(pageMetadata().indexable,true)
  assert.equal(pageMetadata({search:'?utm_source=instagram'}).canonical,'https://dentalcloudapp.com/')
  for(const state of [{signedIn:true},{search:'?demo=1'},{path:'/login'},{path:'/patients/private-id'},{hash:'#access_token=example'},{path:'/anything-unknown'}]) {
    const meta=pageMetadata(state)
    assert.equal(meta.indexable,false)
    assert.equal(meta.canonical,null)
    assert.equal(meta.robots,'noindex, follow')
  }
})
test('public crawl files contain only public destinations and correct MIME file contents',()=>{
  const root=new URL('../',import.meta.url)
  const sitemap=fs.readFileSync(new URL('public/sitemap.xml',root),'utf8')
  const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]))
  assert.equal(urls.length,6)
  for(const url of urls) {
    assert.equal(url.origin,'https://dentalcloudapp.com')
    assert.equal(url.search,'')
    const path=url.pathname==='/'?'index.html':`public${url.pathname}.html`
    assert.ok(fs.existsSync(new URL(path,root)),path)
    const html=fs.readFileSync(new URL(path,root),'utf8')
    assert.ok(html.includes(`rel="canonical" href="${url.href}"`),path)
    assert.match(html,/<meta name="description"/)
  }
  const robots=fs.readFileSync(new URL('public/robots.txt',root),'utf8')
  assert.match(robots,/Sitemap: https:\/\/dentalcloudapp.com\/sitemap.xml/)
  assert.doesNotMatch(robots,/Disallow: \/(?:patients|assets)/)
})
test('private route responses carry noindex without blocking public home',()=>{
  const headers=fs.readFileSync(new URL('../public/_headers',import.meta.url),'utf8').replace(/\r\n/g,'\n')
  for(const path of ['/login','/patients','/patients/*','/payments','/settings']) assert.ok(headers.includes(`${path}\n  X-Robots-Tag: noindex, follow`))
  assert.doesNotMatch(headers,/^\/\*?\s*$/m)
})
test('structured identity names no invented ratings or medical business claims',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
  assert.deepEqual(data['@graph'].map(x=>x['@type']),['WebSite','Organization'])
  assert.equal(pageMetadata({lang:'en'}).title,'DentalCloud | Dental Clinic Management Software')
})
