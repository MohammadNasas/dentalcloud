import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pageMetadata, landingLanguage, HOME_ALTERNATES } from '../src/lib/seo.js'
import { localizedLandingHtml } from '../scripts/localized-landing.mjs'

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
  assert.equal(urls.length,7)
  for(const url of urls) {
    assert.equal(url.origin,'https://dentalcloudapp.com')
    assert.equal(url.search,'')
    const path=url.pathname==='/en/'?'en/index.html':url.pathname==='/'?'index.html':`public${url.pathname}.html`
    assert.ok(fs.existsSync(new URL(path,root)),path)
    const html=url.pathname==='/en/'?localizedLandingHtml(fs.readFileSync(new URL('index.html',root),'utf8'),'en'):fs.readFileSync(new URL(path,root),'utf8')
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
  assert.equal(pageMetadata({path:'/en/',lang:'ar'}).title,'DentalCloud | Dental Clinic Management Software')
})

test('public language URLs override stored preferences without indexing account URLs',()=>{
  for (const path of ['/en','/en/','/en/index.html']) {
    assert.equal(landingLanguage(path),'en')
    const meta=pageMetadata({path,lang:'ar'})
    assert.equal(meta.canonical,HOME_ALTERNATES.en)
    assert.deepEqual(meta.alternates,HOME_ALTERNATES)
    assert.equal(meta.indexable,true)
  }
  assert.match(pageMetadata({path:'/',lang:'en'}).title,/دينتال كلاود/)
  for (const state of [{path:'/en/',signedIn:true},{path:'/en/',search:'?demo=1'},{path:'/en/',hash:'#access_token=example'},{path:'/en/patients'}]) {
    assert.equal(pageMetadata(state).robots,'noindex, follow')
    assert.deepEqual(pageMetadata(state).alternates,{})
  }
})

test('built landing shells have self canonicals, reciprocal languages and localized text',()=>{
  const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')
  for (const lang of ['ar','en']) {
    const html=localizedLandingHtml(source,lang)
    assert.match(html,new RegExp(`<html lang="${lang}" dir="${lang==='ar'?'rtl':'ltr'}">`))
    assert.ok(html.includes(`rel="canonical" href="${HOME_ALTERNATES[lang]}"`))
    for(const [language,href] of Object.entries(HOME_ALTERNATES)) assert.ok(html.includes(`hreflang="${language}" href="${href}"`))
    assert.equal((html.match(/hreflang=/g)||[]).length,3)
    assert.match(html,/<script type="module" src="\/src\/main.jsx">/)
    assert.match(html,lang==='ar'?/<h1>DentalCloud — برنامج إدارة عيادات الأسنان/:/<h1>DentalCloud — Dental Clinic Management Software/)
  }
})
