import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createECDH,randomBytes } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { buildPushPayload } from '@block65/webcrypto-web-push'
import { setup,asUser,ids } from './helpers/securityFixture.mjs'
import { validatePushEndpoint,validatePushSubscription,pushMessage } from '../functions/_lib/loyaltyPush.js'

test('web push rejects arbitrary destinations and encrypts real standards-compliant payloads',async()=>{
 for(const ep of ['http://fcm.googleapis.com/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://evil.test@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x']) assert.equal(validatePushEndpoint(ep),false)
 for(const ep of ['https://fcm.googleapis.com/fcm/send/test','https://web.push.apple.com/test','https://updates.push.services.mozilla.com/wpush/v2/test']) assert.equal(validatePushEndpoint(ep),true)
 const client=createECDH('prime256v1');client.generateKeys();const server=createECDH('prime256v1');server.generateKeys()
 const sub=validatePushSubscription({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:client.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}})
 const message=pushMessage({id:'test',kind:'review',lang:'ar',url:'https://dentalcloudapp.com/loyalty#'+'a'.repeat(64)})
 const request=await buildPushPayload({data:JSON.stringify(message),options:{ttl:3600}},sub,{subject:'https://dentalcloudapp.com',publicKey:server.getPublicKey().toString('base64url'),privateKey:server.getPrivateKey().toString('base64url')})
 assert.equal(request.method.toUpperCase(),'POST');assert.equal(new Headers(request.headers).get('content-encoding'),'aes128gcm')
 assert.ok(!Buffer.from(request.body).toString().includes('loyalty#'))
 assert.throws(()=>validatePushSubscription({...sub,keys:{auth:'bad',p256dh:'bad'}}))
})

test('push opt-in, tenant isolation, due dates, deduplication, cancellation and revocation',async t=>{
 const db=new PGlite();t.after(()=>db.close());await setup(db)
 for(const f of ['subscription_enforcement','loyalty','loyalty_push']) await db.exec(await readFile(new URL(`../supabase/${f}.sql`,import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/loyalty_push.sql',import.meta.url),'utf8'))
 await db.query(`update public.clinics set data=data||'{"paid":true,"tier":"pro","subscriptionProvider":"manual"}' where id=$1`,[ids.clinicA])
 await db.exec("insert into dentalcloud_private.push_config values(true,'public','private','secret',true)")
 await asUser(db,ids.ownerA);await db.query("select public.save_loyalty_program(true,5,'Reward','[\"general\"]')")
 const token=(await db.query('select public.get_loyalty_card($1) c',[ids.patientA])).rows[0].c.token
 await assert.rejects(db.query('select * from public.loyalty_push_subscriptions'),e=>e.code==='42501')
 await assert.rejects(db.query("select public.loyalty_push_claim('secret')"),e=>e.code==='42501')
 await asUser(db,ids.member);await assert.rejects(db.query('select public.set_loyalty_push_settings(false,false)'),e=>e.code==='42501')
 await asUser(db,'','service_role')
 const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'x',auth:'y'}}
 const manage=async(action,tok=token)=>(await db.query('select public.loyalty_push_manage($1,$2,$3,$4) r',[tok,action,JSON.stringify(sub),'ar'])).rows[0].r
 const claim=async()=>(await db.query("select public.loyalty_push_claim('secret') r")).rows[0].r.jobs
 assert.equal((await manage('status')).subscribed,false)
 assert.equal((await claim()).length,0,'no consent means no notifications')
 assert.equal((await manage('subscribe')).subscribed,true)
 const firstDue=(await db.query('select next_review from public.loyalty_push_subscriptions')).rows[0].next_review
 await manage('subscribe');assert.deepEqual((await db.query('select next_review from public.loyalty_push_subscriptions')).rows[0].next_review,firstDue)
 assert.equal((await claim()).length,0,'no review notification immediately after opt-in')
 async function appointment(hours,status='scheduled') {
  return (await db.query(`insert into public.appointments(clinic_id,data) values($1,jsonb_build_object('patientId',$2::text,'status',$3::text,'start',(now()+$4::int*interval '1 hour')::text)) returning id`,[ids.clinicA,ids.patientA,status,hours])).rows[0].id
 }
 const ap=await appointment(24);await appointment(25);await appointment(12,'cancelled')
 let jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'appointment');assert.ok(jobs[0].url.endsWith(token))
 assert.equal((await claim()).length,0,'claimed appointment is not sent twice')
 await db.query('select public.loyalty_push_finish($1,$2,$3,503)',['secret',jobs[0].id,jobs[0].claim])
 await db.exec("update public.loyalty_push_jobs set available_at=now()-interval '1 minute'")
 await db.query("update public.appointments set data=data||'{\"status\":\"cancelled\"}' where id=$1",[ap])
 assert.equal((await claim()).length,0,'cancelled appointment retry is discarded')
 const moved=await appointment(20);jobs=await claim();assert.equal(jobs.length,1)
 await db.query('select public.loyalty_push_finish($1,$2,$3,503)',['secret',jobs[0].id,jobs[0].claim])
 await db.exec("update public.loyalty_push_jobs set available_at=now()-interval '1 minute' where status='pending'")
 await db.query("update public.appointments set data=data||jsonb_build_object('start',(now()+interval '3 days')::text) where id=$1",[moved])
 assert.equal((await claim()).length,0,'rescheduled appointment retry is discarded')
 await db.exec("update public.loyalty_push_subscriptions set next_review=now()-interval '1 day'")
 jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'review')
 await db.query('select public.loyalty_push_finish($1,$2,$3,201)',['secret',jobs[0].id,jobs[0].claim])
 assert.equal((await claim()).length,0,'review cadence does not repeat in same month')
 await asUser(db,ids.ownerA);await db.query('select public.set_loyalty_push_settings(false,false)')
 await asUser(db,'','service_role');assert.equal((await manage('status')).available,false)
 await db.exec("update public.loyalty_push_subscriptions set next_review=now()-interval '1 day'");assert.equal((await claim()).length,0)
 await manage('remove');assert.equal((await manage('status')).subscribed,false)
 await asUser(db,ids.ownerA);await db.query('select public.set_loyalty_push_settings(true,true)')
 await asUser(db,'','service_role');await manage('subscribe')
 await db.query("update public.clinics set data=data||jsonb_build_object('paidThrough',(now()-interval '1 day')::text) where id=$1",[ids.clinicA])
 await db.exec("update public.loyalty_push_subscriptions set next_review=now()-interval '1 day'")
 assert.equal((await manage('status')).available,false);assert.equal((await claim()).length,0,'expired Pro never sends')
 await db.query("update public.clinics set data=data-'paidThrough' where id=$1",[ids.clinicA])
 jobs=await claim();assert.equal(jobs.length,1)
 await db.query('select public.loyalty_push_finish($1,$2,$3,410)',['secret',jobs[0].id,jobs[0].claim])
 assert.equal((await manage('status')).subscribed,false,'expired push endpoints removed')
 await manage('subscribe')
 await asUser(db,ids.ownerA);await db.query('select public.rotate_loyalty_token($1)',[ids.patientA])
 await asUser(db,'','service_role');assert.equal((await db.query('select count(*)::int n from public.loyalty_push_subscriptions')).rows[0].n,0)
 await assert.rejects(manage('subscribe'),/card_not_found/)
 await asUser(db,'','anon');await assert.rejects(db.query('select public.loyalty_push_config()'),e=>e.code==='42501')
})
