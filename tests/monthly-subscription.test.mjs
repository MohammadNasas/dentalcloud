import test from 'node:test'
import assert from 'node:assert/strict'
import { periodEnd, trialEnd, subscriptionPlanFromPayPal } from '../src/lib/subscriptionPlans.js'
import { paidEntitlementPatch, hasVerifiedPaidAccess, paymentFromSubscription, revokePaymentPatch } from '../src/lib/entitlement.js'
const time = '2026-01-31T12:00:00Z'
const now = Date.parse(time) + 1000
const monthly = { id:'SALE-MONTHLY', planId:'pro_monthly', amount:7, currency:'USD', time, source:'verified_webhook' }
test('monthly payments expire after a calendar month, including short months',()=>{
 assert.equal(periodEnd(time,'month'),'2026-02-28T12:00:00.000Z')
 assert.equal(periodEnd('2028-01-31T12:00:00Z','month'),'2028-02-29T12:00:00.000Z')
 const data={tier:'pro',subscriptionProvider:'paypal',...paidEntitlementPatch({},monthly,now)}
 assert.equal(data.paidThrough,'2026-02-28T12:00:00.000Z')
 assert.equal(data.subscriptionVerifiedPlan,'pro_monthly')
 assert.equal(hasVerifiedPaidAccess(data,now),true)
 assert.equal(hasVerifiedPaidAccess(data,Date.parse(data.paidThrough)),false)
 assert.equal(hasVerifiedPaidAccess({...data,paidThrough:'2027-01-31'},Date.parse('2026-03-01')),false)
 assert.equal(paidEntitlementPatch(data,monthly,now).paidThrough,data.paidThrough)
 assert.equal(revokePaymentPatch(data,{id:monthly.id,eventId:'REFUND'},now).paid,false)
})
test('billing plan and amount must agree; the client cannot buy a year for $7',()=>{
 for(const payment of [{...monthly,planId:'pro'},{...monthly,planId:undefined},{...monthly,amount:50},{...monthly,currency:'EUR'}])
  assert.equal(paidEntitlementPatch({},payment,now).paid,false)
 const sub={custom_id:'clinic--pro_monthly--paid--1',billing_info:{last_payment:{amount:{value:'7.00',currency_code:'USD'},time}}}
 assert.equal(subscriptionPlanFromPayPal(sub).period,'month')
 assert.equal(paidEntitlementPatch({},paymentFromSubscription(sub),now).paid,true)
 assert.equal(paidEntitlementPatch({},paymentFromSubscription({...sub,custom_id:''}),now).paid,false)
 assert.equal(paidEntitlementPatch({},{...monthly,planId:'pro',amount:50},now).paidThrough,'2027-01-31T12:00:00.000Z')
})
test('monthly trial lasts exactly three days; annual keeps its one-month trial',()=>{
 assert.equal(trialEnd(time,'pro_monthly'),'2026-02-03T12:00:00.000Z')
 assert.equal(trialEnd(time,'pro'),'2026-02-28T12:00:00.000Z')
})
