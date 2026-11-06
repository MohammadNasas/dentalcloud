import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost as create } from '../functions/api/paypal-create.js'
import { onRequestPost as capture } from '../functions/api/paypal-capture.js'
import { onRequestPost as sync } from '../functions/api/paypal-subscription-status.js'
import { onRequestPost as webhook } from '../functions/api/paypal-webhook.js'
const ENV={PAYPAL_CLIENT_ID:'test',PAYPAL_SECRET:'test',PAYPAL_WEBHOOK_ID:'test',PAYPAL_PRODUCT_ID:'PROD-TEST',PAYPAL_BASE:'https://paypal.test',SUPABASE_URL:'https://supa.test',SUPABASE_SERVICE_ROLE_KEY:'test'}
const stamp='2026-11-05T12:00:00Z'
const request=body=>new Request('https://app.test/api/test',{method:'POST',headers:{authorization:'Bearer synthetic-test-token','content-type':'application/json'},body:JSON.stringify(body)})
function fixture(t, {mode='trial',clinic:seed={},plan='pro_monthly',configuredPlan=null,identityConflict=false,reserveConflict=false}={}) {
 t.mock.timers.enable({apis:['Date'],now:Date.parse(stamp)})
 let clinic={tier:'pro',paid:false,...seed},trial=null,sub=null,planBody=null
 const calls=[]
 t.mock.method(globalThis,'fetch',async (input, init={})=>{
  const url=new URL(String(input)),method=init.method||'GET',body=init.body?.startsWith('{')||init.body?.startsWith('[')?JSON.parse(init.body):null
  calls.push({path:url.pathname,method,body})
  if(url.pathname==='/auth/v1/user')return Response.json({id:'user-1',email:'test@example.invalid'})
  if(url.pathname==='/rest/v1/doctors')return Response.json([{id:'user-1'}])
  if(url.pathname==='/rest/v1/clinics')return Response.json([{id:'clinic-1',data:clinic}])
  if(url.pathname==='/rest/v1/rpc/apply_subscription_patch'){
   clinic={...clinic,...body.p_patch};return Response.json(clinic)
  }
  if(url.pathname==='/rest/v1/subscription_trials'){
   if(method==='POST'){trial={...body,paypal_subscription_id:null};return Response.json(reserveConflict?[]:[trial])}
   if(method==='GET')return Response.json(trial?[trial]:[])
   if(method==='PATCH'){
    if(identityConflict&&body.paypal_payer_id)return Response.json({}, {status:409})
    trial={...trial,...body};return Response.json([trial])
   }
   if(method==='DELETE'){trial=null;return new Response(null,{status:204})}
  }
  if(url.pathname==='/v1/oauth2/token')return Response.json({access_token:'test'})
  if(url.pathname==='/v1/billing/plans'&&method==='POST'){planBody=body;return Response.json({id:'P-TEST'})}
  if(url.pathname==='/v1/billing/plans/P-CONFIG')return Response.json(configuredPlan)
  if(url.pathname.endsWith('/update-pricing-schemes'))return Response.json({})
  if(url.pathname==='/v1/billing/subscriptions'&&method==='POST'){
   sub={id:'I-TEST',custom_id:body.custom_id,status:'APPROVAL_PENDING',start_time:stamp,subscriber:{payer_id:'PAYER-TEST'},billing_info:{next_billing_time:'2026-11-08T12:00:00Z'},links:[{rel:'approve',href:'https://paypal.test/approve'}]}
   return Response.json(sub)
  }
  if(url.pathname==='/v1/billing/subscriptions/I-TEST'&&method==='GET')return Response.json(sub)
  if(url.pathname==='/v1/billing/subscriptions/I-TEST'&&method==='PATCH')return new Response(null,{status:204})
  if(url.pathname==='/v1/billing/subscriptions/I-TEST/cancel'){sub.status='CANCELLED';return new Response(null,{status:204})}
  if(url.pathname==='/v1/notifications/verify-webhook-signature')return Response.json({verification_status:'SUCCESS'})
  throw new Error(`Unexpected fetch ${method} ${url}`)
 })
 return {
  calls,clinic:()=>clinic,sub:()=>sub,plan:()=>planBody,trial:()=>trial,
  create:()=>create({env:ENV,request:request({tier:plan,clinicId:'clinic-1',checkoutMode:mode,amount:1})}),
  capture:()=>capture({env:ENV,request:request({subscriptionId:'I-TEST',clinicId:'clinic-1',tier:'pro'})}),
  sync:()=>sync({env:ENV,request:request({subscriptionId:'I-TEST',clinicId:'clinic-1'})}),
  sale:(amount=7)=>webhook({env:ENV,request:request({id:'EVENT-TEST',event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE-TEST',billing_agreement_id:'I-TEST',state:'completed',create_time:stamp,amount:{total:String(amount),currency:'USD'}}})}),
 }
}
test('monthly checkout creates DAY 3 free trial then USD 7 every MONTH; signed sale renews one month',async t=>{
 const f=fixture(t)
 assert.equal((await f.create()).status,200)
 const cycles=f.plan().billing_cycles
 assert.deepEqual(cycles[0].frequency,{interval_unit:'DAY',interval_count:3})
 assert.equal(cycles[0].total_cycles,1)
 assert.deepEqual(cycles[1].frequency,{interval_unit:'MONTH',interval_count:1})
 assert.equal(cycles[1].pricing_scheme.fixed_price.value,'7.00')
 f.sub().status='ACTIVE'
 const cap=await (await f.capture()).json()
 assert.equal(cap.paid,false)
 assert.equal(cap.tier,'pro')
 assert.equal(cap.trialEndsAt,'2026-11-08T12:00:00.000Z')
 assert.equal(f.clinic().subscriptionPlan,'pro_monthly')
 const patch=f.calls.find(c=>c.method==='PATCH'&&c.path==='/v1/billing/subscriptions/I-TEST')
 assert.equal(patch.body[0].value.value,'7.00')
 assert.equal((await (await f.sale(50)).json()).ignored,'payment_amount_or_currency_mismatch')
 assert.equal((await (await f.sale()).json()).paid,true)
 assert.equal(f.clinic().paidThrough,'2026-12-05T12:00:00.000Z')
 f.sub().billing_info.last_payment={time:stamp,amount:{value:'7',currency_code:'USD'}}
 assert.equal((await f.sync()).status,200)
 assert.equal(f.clinic().paidThrough,'2026-12-05T12:00:00.000Z')
 assert.equal((await (await f.create()).json()).error,'trial_already_used')
})
test('used-trial monthly checkout charges $7 with no trial and ignores client annual hint',async t=>{
 const f=fixture(t,{mode:'paid',clinic:{trialUsedAt:'2026-01-01'}})
 assert.equal((await f.create()).status,200)
 assert.equal(f.plan().billing_cycles.length,1)
 assert.equal(f.plan().billing_cycles[0].frequency.interval_unit,'MONTH')
 assert.equal(f.plan().billing_cycles[0].pricing_scheme.fixed_price.value,'7.00')
 assert.equal(f.trial(),null)
 f.sub().status='ACTIVE'
 f.sub().billing_info.last_payment={time:stamp,amount:{value:'7',currency_code:'USD'}}
 assert.equal((await (await f.capture()).json()).paid,true)
 assert.equal(f.clinic().paidThrough,'2026-12-05T12:00:00.000Z')
 assert.equal(f.clinic().subscriptionVerifiedPlan,'pro_monthly')
})
test('same payment identity cannot claim another monthly trial',async t=>{
 const f=fixture(t,{identityConflict:true})
 await f.create();f.sub().status='ACTIVE'
 assert.equal((await (await f.capture()).json()).error,'trial_already_used')
 assert.equal(f.sub().status,'CANCELLED')
 assert.equal(f.clinic().paid,false)
 assert.equal(f.clinic().trialEndsAt,undefined)
})
test('annual remains MONTH 1 trial followed by USD 50 every YEAR',async t=>{
 const f=fixture(t,{plan:'pro'})
 assert.equal((await f.create()).status,200)
 assert.deepEqual(f.plan().billing_cycles[0].frequency,{interval_unit:'MONTH',interval_count:1})
 assert.deepEqual(f.plan().billing_cycles[1].frequency,{interval_unit:'YEAR',interval_count:1})
 assert.equal(f.plan().billing_cycles[1].pricing_scheme.fixed_price.value,'50.00')
})
test('misconfigured monthly ID pointing to an annual PayPal plan is rejected before price mutation',async t=>{
 const f=fixture(t,{configuredPlan:{billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'YEAR',interval_count:1}}]}})
 const result=await create({env:{...ENV,PAYPAL_PRO_MONTHLY_PAID_PLAN_ID:'P-CONFIG'},request:request({tier:'pro_monthly',clinicId:'clinic-1',checkoutMode:'paid'})})
 assert.equal((await result.json()).message,'plan_billing_cycle_mismatch')
 assert.equal(f.calls.some(c=>c.path.endsWith('/update-pricing-schemes')),false)
 assert.equal(f.calls.some(c=>c.path==='/v1/billing/subscriptions'),false)
})
