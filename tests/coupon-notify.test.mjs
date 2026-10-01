import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/coupon-notify.js'
const env={SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake-service',RESEND_API_KEY:'fake-email',COUPON_NOTIFY_TO:'owner@example.invalid'}
const request=(payload={coupon:'DENTAL40',tier:'pro'},token='test')=>new Request('https://app.invalid/api/coupon-notify',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)})
test('coupon notification validates identity, reserves atomically and never trusts caller email/HTML',async(t)=>{
  const calls=[]
  let allow=true, authOK=true, confirmed=true, limiterOK=true
  const real=globalThis.fetch
  t.after(()=>{globalThis.fetch=real})
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options})
    if(url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({id:'user-1',email:'a<b>@example.invalid',email_confirmed_at:confirmed?'2026-01-01':null}),{status:authOK?200:401})
    if(url.endsWith('/rpc/reserve_coupon_notification')) {const result=allow;allow=false;return new Response(JSON.stringify(result),{status:limiterOK?200:500})}
    if(url==='https://api.resend.com/emails') return new Response('{}')
    throw Error('Unexpected request')
  }
  await t.test('unauthenticated and invalid payloads never contact mail provider',async()=>{
    assert.equal((await onRequestPost({request:request(undefined,''),env})).status,401)
    assert.equal(calls.length,0)
    for(const payload of [{coupon:'DENTAL40',tier:'<b>injected</b>'},{coupon:'toString',tier:'pro'},{coupon:'DENTAL40',tier:'pro',padding:'x'.repeat(5000)}])
      assert.equal((await onRequestPost({request:request(payload),env})).status,400)
    assert.equal(calls.length,0)
  })
  await t.test('verified session email is escaped; forged address ignored; repeat returns 429',async()=>{
    assert.equal((await onRequestPost({request:request({coupon:'DENTAL40',tier:'pro',email:'attacker@example.invalid'}),env})).status,200)
    const sent=JSON.parse(calls.find(x=>x.url.includes('resend')).options.body)
    assert.equal(sent.to,'owner@example.invalid')
    assert.ok(sent.html.includes('a&lt;b&gt;@example.invalid'))
    assert.ok(!sent.html.includes('attacker'))
    assert.equal((await onRequestPost({request:request(),env})).status,429)
    assert.equal(calls.filter(x=>x.url.includes('resend')).length,1)
  })
  await t.test('invalid session, unverified email and unavailable limiter fail closed',async()=>{
    authOK=false
    assert.equal((await onRequestPost({request:request(),env})).status,401)
    authOK=true;confirmed=false
    assert.equal((await onRequestPost({request:request(),env})).status,403)
    confirmed=true;limiterOK=false
    assert.equal((await onRequestPost({request:request(),env})).status,503)
    assert.equal(calls.filter(x=>x.url.includes('resend')).length,1)
  })
})
