import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { setup, asUser, ids, denied } from './helpers/securityFixture.mjs'
import { hasVerifiedPaidAccess } from '../src/lib/entitlement.js'
const migration = await readFile(new URL('../supabase/subscription_enforcement.sql', import.meta.url), 'utf8')
test('subscription enforcement against real PostgreSQL RLS and triggers', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await setup(db)
  await db.exec(migration)
  await db.exec('create unique index test_object_path on storage.objects(bucket_id,name)')
  async function state(data) {
    await asUser(db, '', 'service_role')
    await db.query('update public.clinics set data=$1 where id=$2', [JSON.stringify(data), ids.clinicB])
    await asUser(db, ids.ownerB)
  }
  const insert = (table, data = {}) => db.query('insert into public.' + table + ' (clinic_id,data) values ($1,$2) returning id', [ids.clinicB, JSON.stringify(data)])
  const level = async () => (await db.query('select dentalcloud_private.access_level($1) as level', [ids.clinicB])).rows[0].level

  await t.test('repeatable migration preserves records and server-managed grants', async () => {
    await db.exec(migration)
    assert.equal((await db.query('select count(*)::int n from public.patients')).rows[0].n, 2)
  })
  await t.test('Student can save clinical records but cannot write any paid table or extra profile', async () => {
    await state({ tier: 'student', paid: false })
    await insert('patients', { name: 'Synthetic', orthodontics: {}, photos: [] })
    await insert('tooth_records', { price: 0, notes: 'Clinical note' })
    for (const table of ['appointments','payments','lab_orders']) await denied(insert(table))
    await denied(insert('patients', { orthodontics: { plan: 'paid' } }))
    await denied(insert('patients', { consent: { plan: 'paid' } }))
    await denied(insert('patients', { photos: [{ category: 'before' }] }))
    await denied(insert('tooth_records', { price: 5 }))
    await denied(db.query('insert into public.doctors(id,clinic_id,data) values(gen_random_uuid(),$1,$2)', [ids.clinicB, '{}']))
    await denied(db.query("update public.clinics set data=data || '{\"prices\":[1]}' where id=$1", [ids.clinicB]))
  })
  await t.test('expired Pro can read records and export but cannot insert/update/delete', async () => {
    await state({ tier:'pro', paid:true, paidThrough:'2020-01-01', trialEndsAt:'2020-01-01' })
    assert.equal(await level(), -1)
    assert.equal((await db.query('select id from public.patients where id=$1',[ids.patientB])).rows.length,1)
    for (const table of ['patients','tooth_records','appointments','payments','lab_orders']) await denied(insert(table))
    await denied(db.query("update public.patients set data='{}' where id=$1", [ids.patientB]))
    await denied(db.query('delete from public.patients where id=$1',[ids.patientB]))
    await db.query("update public.clinics set data=data || '{\"name\":\"Renewal settings\"}' where id=$1",[ids.clinicB])
  })
  await t.test('trial, paid proof, manual extension and permanent grants remain usable', async () => {
    const future = new Date(Date.now()+86400000).toISOString()
    const paid = {tier:'pro',paid:true,subscriptionProvider:'paypal',subscriptionPaymentVerified:true,subscriptionVerifiedAmount:50,subscriptionVerifiedCurrency:'USD',subscriptionLastPaidAt:new Date().toISOString(),paidThrough:future}
    for (const data of [{tier:'pro',paid:false,trialEndsAt:future},paid,{tier:'pro',paid:true,paidThrough:future},{tier:'pro',paid:true}]) {
      await state(data)
      assert.equal(await level(),1)
      for (const table of ['appointments','payments','lab_orders']) await insert(table)
    }
    for (const patch of [{subscriptionVerifiedAmount:1},{subscriptionVerifiedCurrency:'EUR'},{subscriptionPaymentVerified:false},{paidThrough:'yesterday-invalid'},{subscriptionLastPaidAt:future},{subscriptionRevokedPayments:[{time:paid.subscriptionLastPaidAt}]}]) {
      await state({...paid,...patch})
      assert.equal(await level(),-1)
      assert.equal(hasVerifiedPaidAccess({...paid,...patch}),false)
      await denied(insert('appointments'))
    }
  })
  await t.test('blocked update/delete preserve existing paid records and old metadata', async () => {
    await state({tier:'student',paid:false})
    await db.query("insert into storage.objects values(gen_random_uuid(),'patient-images',$1) on conflict(bucket_id,name) do update set name=excluded.name",[ids.clinicB+'/'+ids.patientB+'/xray.jpg'])
    await denied(db.query("update public.appointments set data='{}' where clinic_id=$1",[ids.clinicB]))
    await denied(db.query('delete from public.payments where clinic_id=$1',[ids.clinicB]))
    // Access does not depend on client-supplied clinic data.
    await db.query("update public.clinics set data=data || '{\"tier\":\"pro\",\"paid\":true,\"trialEndsAt\":\"2099-01-01\"}' where id=$1",[ids.clinicB])
    assert.equal(await level(),0)
    await denied(insert('appointments'))
  })
  await t.test('Student storage rejects a second image; paid uploads work; expired writes fail', async () => {
    await state({tier:'student',paid:false})
    await denied(db.query("insert into storage.objects values(gen_random_uuid(),'patient-images',$1)",[ids.clinicB+'/'+ids.patientB+'/second.jpg']))
    await state({tier:'pro',paid:true})
    await db.query("insert into storage.objects values(gen_random_uuid(),'patient-images',$1)",[ids.clinicB+'/'+ids.patientB+'/second.jpg'])
    await state({tier:'pro',paid:false})
    await denied(db.query("delete from storage.objects where name=$1",[ids.clinicB+'/'+ids.patientB+'/second.jpg']))
    assert.equal((await db.query("select name from storage.objects where name like $1",[ids.clinicB+'/%'])).rows.length,2)
  })
  await t.test('cross-clinic reads and writes remain isolated', async () => {
    await state({tier:'pro',paid:true})
    assert.equal((await db.query('select id from public.patients where clinic_id=$1',[ids.clinicA])).rows.length,0)
    await denied(db.query("insert into public.appointments(clinic_id,data) values($1,'{}')",[ids.clinicA]))
    assert.equal((await db.query('select dentalcloud_private.access_level($1) n',[ids.clinicA])).rows[0].n,-1)
  })
  await t.test('service role can renew expired clinics and limiter persists across repeated calls', async () => {
    await state({tier:'pro',paid:false})
    await denied(db.query('select public.reserve_coupon_notification($1)',[ids.ownerB]))
    await asUser(db,'','service_role')
    assert.equal((await db.query('select public.reserve_coupon_notification($1) ok',[ids.ownerB])).rows[0].ok,true)
    assert.equal((await db.query('select public.reserve_coupon_notification($1) ok',[ids.ownerB])).rows[0].ok,false)
    assert.equal((await db.query('select public.reserve_coupon_notification($1) ok',[ids.unconfirmed])).rows[0].ok,false)
    await db.query("select public.apply_subscription_patch($1,null,'{\"paid\":true}')",[ids.clinicB])
    await asUser(db,ids.ownerB)
    assert.equal(await level(),1)
    await asUser(db,'','anon')
    await denied(db.query('select public.current_clinic_id()'))
    await denied(db.query("select public.track_daily_active(current_date,'web',null,'{}')"))
  })
})
