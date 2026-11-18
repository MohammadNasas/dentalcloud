import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { setup, asUser, ids } from './helpers/securityFixture.mjs'
import { loyaltyProgress, loyaltyLink, upcomingReminders } from '../src/lib/loyalty.js'
const migration = await readFile(new URL('../supabase/loyalty.sql', import.meta.url), 'utf8')
const enforcement = await readFile(new URL('../supabase/subscription_enforcement.sql', import.meta.url), 'utf8')

test('loyalty display, private links and reminder window', () => {
  assert.deepEqual(loyaltyProgress({ target: 5, visits: 3 }), { target: 5, visits: 3, filled: 3, remaining: 2, ready: false })
  assert.equal(loyaltyProgress({ target: 5, visits: 7 }).ready, true)
  assert.equal(loyaltyLink('not-a-token'), '')
  const link = new URL(loyaltyLink('a'.repeat(64)))
  assert.equal(link.pathname, '/loyalty'); assert.equal(link.search, ''); assert.equal(link.hash, '#' + 'a'.repeat(64))
  const now = Date.parse('2026-11-18T10:00:00Z')
  const a = (start,status='scheduled') => ({start,status})
  assert.equal(upcomingReminders([a('2026-11-18T09:00:00Z'),a('2026-11-18T11:00:00Z'),a('2026-11-18T12:00:00Z','completed'),a('2026-11-20T11:00:00Z')],now).length,1)
})

test('loyalty database protects tenants, visits and atomic reward redemption', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await setup(db); await db.exec(enforcement); await db.exec(migration)
  await db.exec(migration) // Safe to apply again without deleting cards.
  await db.query("update public.clinics set data=data || '{\"tier\":\"pro\",\"paid\":true,\"subscriptionProvider\":\"manual\"}' where id=$1",[ids.clinicA])
  await asUser(db,ids.ownerA)
  await db.query('select public.save_loyalty_program(true,5,$1,$2)', ['تنظيف مجاني','["general","treatment"]'])
  const get = async () => (await db.query('select public.get_loyalty_card($1) c',[ids.patientA])).rows[0].c
  const initial = await get(); assert.match(initial.token,/^[a-f0-9]{64}$/); assert.equal(initial.visits,0)
  await asUser(db,'','service_role')
  await db.query("update public.loyalty_cards set enrolled_at=now()-interval '10 days' where patient_id=$1",[ids.patientA])
  await asUser(db,ids.ownerA)
  async function appt(days,status='completed',extra={}) {
    return (await db.query(`insert into public.appointments(clinic_id,data) values($1,jsonb_build_object('patientId',$2::text,'status',$3::text,'start',(now()-$4::int*interval '1 day')::text)||$5::jsonb) returning id`,[ids.clinicA,ids.patientA,status,days,JSON.stringify(extra)])).rows[0].id
  }
  const old = await appt(12); assert.equal((await get()).visits,0,'historical visits are not backfilled')
  const scheduled = await appt(8,'scheduled'); assert.equal((await get()).visits,0)
  const excluded = await appt(7,'completed',{loyaltyExcluded:true}); assert.equal((await get()).visits,0)
  const wrongType = await appt(6,'completed',{loyaltyCategory:'checkup'}); assert.equal((await get()).visits,0)
  const visits=[]
  for (let i=6;i>=2;i--) visits.push(await appt(i))
  assert.equal((await get()).visits,5)
  await db.query("update public.appointments set data=data||'{\"notes\":\"edited\"}' where id=$1",[visits[0]])
  assert.equal((await get()).visits,5,'editing a completed visit adds no extra stamp')
  await db.query('select public.save_loyalty_program(false,5,$1,$2)',['تنظيف مجاني','["general","treatment"]'])
  await db.query("update public.appointments set data=data||'{\"notes\":\"edited while paused\"}' where id=$1",[visits[0]])
  assert.equal((await get()).visits,5,'pausing a program does not erase earned stamps on edits')
  await db.query('select public.save_loyalty_program(true,5,$1,$2)',['تنظيف مجاني','["general","treatment"]'])
  await assert.rejects(db.query('select public.redeem_loyalty_reward($1,$2)',[ids.patientA,visits[4]]),/Complete the required/)
  const rewardVisit=await appt(1)
  await db.query('select public.redeem_loyalty_reward($1,$2)',[ids.patientA,rewardVisit])
  assert.equal((await get()).visits,0,'the reward visit is not another stamp')
  await db.query('select public.redeem_loyalty_reward($1,$2)',[ids.patientA,rewardVisit])
  assert.equal((await get()).redeemed,1,'double-click redemption is idempotent')
  await assert.rejects(db.query("update public.appointments set data=data||'{\"status\":\"cancelled\"}' where id=$1",[rewardVisit]),/redeemed reward/)
  await db.query('delete from public.appointments where id=$1',[visits[0]])
  assert.equal((await get()).adjustment,-1,'deleting a used visit cannot create a second reward')
  await db.query('select public.save_loyalty_program(true,3,$1,$2)', ['خصم','["general"]'])
  assert.equal((await get()).target,5,'existing card promise is preserved until redeemed')
  await db.query('select public.rotate_loyalty_token($1)',[ids.patientA])
  const rotated=await get(); assert.notEqual(rotated.token,initial.token)
  await assert.rejects(db.query('delete from public.loyalty_stamps'),/permission denied/)
  await assert.rejects(db.query('select public.read_public_loyalty_card($1)',[rotated.token]),/permission denied/)
  await asUser(db,ids.ownerB)
  assert.equal((await db.query('select * from public.loyalty_cards')).rows.length,0)
  await assert.rejects(db.query('select public.get_loyalty_card($1)',[ids.patientA]),/Clinic access/)
  await asUser(db,ids.member)
  await assert.rejects(db.query('select public.save_loyalty_program(true,5,$1,$2)',['x','["general"]']),/access required/)
  await asUser(db,'','service_role')
  const pub=(await db.query('select public.read_public_loyalty_card($1) c',[rotated.token])).rows[0].c
  assert.deepEqual(Object.keys(pub).sort(),['clinicName','clinicNameAr','enabled','reward','target','visits'].sort())
  assert.equal((await db.query('select public.read_public_loyalty_card($1) c',[initial.token])).rows[0].c,null)
  await db.query('delete from public.patients where id=$1',[ids.patientA])
  assert.equal((await db.query('select public.read_public_loyalty_card($1) c',[rotated.token])).rows[0].c,null)
})
