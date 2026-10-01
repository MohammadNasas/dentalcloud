import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { setup, asUser, clinic, denied, ids, schema, migration, marker } from './helpers/securityFixture.mjs'

test('clinic access migration protects real PostgreSQL policies and old-client writes', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await setup(db)

  await t.test('fresh schema contains exactly the separately deployable migration', async () => {
    assert.equal(schema.slice(schema.indexOf(marker)).split('-- DentalCloud: enforce subscription writes')[0].trim().replace(/\r\n/g, '\n'), migration.trim().replace(/\r\n/g, '\n'))
  })

  await t.test('migration is repeatable and preserves existing paid and membership data', async () => {
    const before = await clinic(db, ids.clinicA)
    await db.exec(migration)
    assert.deepEqual(await clinic(db, ids.clinicA), before)
    assert.equal((await db.query('select count(*)::int as n from public.doctors')).rows[0].n, 3)
  })

  await t.test('an outsider cannot join another clinic, read patients, or see private images', async () => {
    await asUser(db, ids.outsider)
    await denied(db.query('insert into public.doctors(id, clinic_id, data) values ($1, $2, $3)',
      [ids.outsider, ids.clinicA, { role: 'admin' }]))
    assert.equal((await db.query('select * from public.patients')).rows.length, 0)
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0)
    await denied(db.query('insert into public.clinics(id, owner_id, data) values ($1,$2,$3)',
      [ids.clinicC, ids.ownerA, { tier: 'pro', paid: true }]))
  })

  await t.test('signup sanitizes forged entitlements and allows owner membership bootstrap', async () => {
    await asUser(db, ids.outsider)
    await db.query('insert into public.clinics(id, owner_id, data) values ($1,$2,$3)',
      [ids.clinicC, ids.outsider, {
        name: 'New clinic', tier: 'pro', paid: true, trialEndsAt: '2999-01-01',
        subscriptionProvider: 'manual', subscriptionPaymentVerified: true,
        subscriptionVerifiedAmount: 50, nextBillingTime: '2999-01-01', futureBillingFlag: true,
      }])
    const created = await clinic(db, ids.clinicC)
    assert.equal(created.name, 'New clinic')
    assert.equal(created.tier, 'pro')
    assert.equal(created.paid, false)
    for (const key of ['trialEndsAt', 'subscriptionProvider', 'subscriptionPaymentVerified', 'nextBillingTime', 'futureBillingFlag']) {
      assert.equal(key in created, false, `${key} must not be client-controlled`)
    }
    await db.query('insert into public.doctors(id, clinic_id, data) values ($1,$2,$3)',
      [ids.outsider, ids.clinicC, { name: 'New owner', role: 'admin', isOwner: true }])
    assert.equal((await db.query('select public.current_clinic_id() as id')).rows[0].id, ids.clinicC)
  })

  await t.test('old full-object clinic saves update ordinary settings without corrupting payments', async () => {
    await asUser(db, ids.ownerA)
    const before = await clinic(db, ids.clinicA)
    await db.query('update public.clinics set data=$1 where id=$2', [{
      name: 'Renamed clinic', settings: { currency: 'JOD' }, customSheets: [{ id: 'sheet' }],
      labs: [{ name: 'Lab' }], paid: false, subscriptionProvider: 'manual', trialEndsAt: '2999-01-01',
      futureBillingFlag: 'overwrite',
    }, ids.clinicA])
    const after = await clinic(db, ids.clinicA)
    assert.equal(after.name, 'Renamed clinic')
    assert.deepEqual(after.settings, { currency: 'JOD' })
    assert.equal(after.customSheets[0].id, 'sheet')
    assert.equal(after.labs[0].name, 'Lab')
    for (const key of ['paid', 'tier', 'subscriptionProvider', 'subscriptionPaymentVerified', 'subscriptionVerifiedAmount', 'subscriptionVerifiedCurrency', 'futureBillingFlag']) {
      assert.deepEqual(after[key], before[key], `${key} must retain server value`)
    }
    assert.equal('trialEndsAt' in after, false)
  })

  await t.test('unpaid clients cannot manufacture paid access or a new trial on update', async () => {
    await asUser(db, ids.ownerB)
    await db.query('update public.clinics set data=$1 where id=$2', [{
      paid: true, tier: 'pro', subscriptionProvider: 'manual', trialEndsAt: '2999-01-01',
    }, ids.clinicB])
    const after = await clinic(db, ids.clinicB)
    assert.equal(after.paid, false)
    assert.equal('trialEndsAt' in after, false)
    assert.equal('subscriptionProvider' in after, false)
  })

  await t.test('clinic identity, ownership, and doctor membership cannot be reassigned', async () => {
    await asUser(db, ids.ownerA)
    await denied(db.query('update public.clinics set owner_id=$1 where id=$2', [ids.ownerB, ids.clinicA]))
    await denied(db.query('update public.clinics set id=$1 where id=$2', [ids.clinicD, ids.clinicA]))
    await denied(db.query('update public.doctors set clinic_id=$1 where id=$2', [ids.clinicB, ids.ownerA]))
    await denied(db.query('update public.doctors set id=$1 where id=$2', [ids.profile, ids.ownerA]))
  })

  await t.test('owners manage display profiles but cannot attach another real login or delete login memberships', async () => {
    await asUser(db, ids.ownerA)
    await db.query('insert into public.doctors(id, clinic_id, data) values ($1,$2,$3)',
      [ids.profile, ids.clinicA, { name: 'Display doctor', isOwner: true, role: 'doctor' }])
    const profile = (await db.query('select data from public.doctors where id=$1', [ids.profile])).rows[0].data
    assert.equal(profile.isOwner, false)
    assert.equal(profile.clinicId, ids.clinicA)
    await denied(db.query('insert into public.doctors(id, clinic_id, data) values ($1,$2,$3)',
      [ids.complimentary, ids.clinicA, { role: 'admin' }]))
    assert.equal((await db.query('delete from public.doctors where id=$1 returning id', [ids.member])).rows.length, 0)
    assert.equal((await db.query('delete from public.doctors where id=$1 returning id', [ids.ownerA])).rows.length, 0)
    assert.equal((await db.query("update public.doctors set data=data || '{\"name\":\"Renamed doctor\"}' where id=$1 returning id", [ids.profile])).rows.length, 1)
  })

  await t.test('members edit their profile and clinic settings without escalating role or managing colleagues', async () => {
    await asUser(db, ids.member)
    await db.query('update public.doctors set data=$1 where id=$2', [{ name: 'Member name', role: 'admin', isOwner: true }, ids.member])
    const self = (await db.query('select data from public.doctors where id=$1', [ids.member])).rows[0].data
    assert.equal(self.name, 'Member name')
    assert.equal(self.role, 'doctor')
    assert.equal(self.isOwner, false)
    assert.equal((await db.query("update public.doctors set data='{}' where id=$1 returning id", [ids.profile])).rows.length, 0)
    assert.equal((await db.query('delete from public.doctors where id=$1 returning id', [ids.profile])).rows.length, 0)
    await db.query('update public.clinics set data=$1 where id=$2', [{ prices: [{ key: 'cleaning', price: 10 }] }, ids.clinicA])
    assert.equal((await clinic(db, ids.clinicA)).prices[0].price, 10)
    assert.equal((await db.query('select * from public.patients')).rows.length, 1)
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1)
  })

  await t.test('free-plan selection remains available but a client cannot upgrade it back to Pro', async () => {
    await asUser(db, ids.outsider)
    await db.query('update public.clinics set data=$1 where id=$2', [{ tier: 'student' }, ids.clinicC])
    assert.equal((await clinic(db, ids.clinicC)).tier, 'student')
    await db.query('update public.clinics set data=$1 where id=$2', [{ tier: 'pro', paid: true }, ids.clinicC])
    assert.equal((await clinic(db, ids.clinicC)).tier, 'student')
    assert.equal((await clinic(db, ids.clinicC)).paid, false)
  })

  await t.test('only confirmed allowlisted auth identities receive complimentary grants', async () => {
    await asUser(db, ids.complimentary)
    await db.query('insert into public.clinics(id,owner_id,data) values ($1,$2,$3)',
      [ids.clinicD, ids.complimentary, { name: 'Complimentary', tier: 'student' }])
    assert.equal((await clinic(db, ids.clinicD)).paid, true)
    assert.equal((await clinic(db, ids.clinicD)).tier, 'pro')
    await asUser(db, ids.unconfirmed)
    await db.query('insert into public.clinics(id,owner_id,data) values ($1,$2,$3)',
      [ids.clinicE, ids.unconfirmed, { name: 'Unconfirmed', tier: 'student', paid: true }])
    assert.equal((await clinic(db, ids.clinicE)).paid, false)
    await asUser(db, ids.outsider)
    await db.query('update public.doctors set data=$1 where id=$2', [{ email: 'mohammadissogood556@gmail.com' }, ids.outsider])
    await db.query('update public.clinics set data=$1 where id=$2', [{ paid: true }, ids.clinicC])
    assert.equal((await clinic(db, ids.clinicC)).paid, false)
  })

  await t.test('PayPal service-role updates retain their ability to grant paid access', async () => {
    await asUser(db, null, 'service_role')
    await db.query('update public.clinics set data=data || $1 where id=$2', [{
      paid: true, tier: 'pro', subscriptionProvider: 'paypal', subscriptionPaymentVerified: true,
      subscriptionVerifiedAmount: 50, subscriptionVerifiedCurrency: 'USD', nextBillingTime: '2027-09-28',
    }, ids.clinicB])
    const paid = await clinic(db, ids.clinicB)
    assert.equal(paid.paid, true)
    assert.equal(paid.subscriptionPaymentVerified, true)
    await asUser(db, ids.ownerB)
    await db.query('update public.clinics set data=$1 where id=$2', [{ name: 'After payment', paid: false }, ids.clinicB])
    assert.equal((await clinic(db, ids.clinicB)).paid, true)
    assert.equal((await clinic(db, ids.clinicB)).nextBillingTime, '2027-09-28')
  })

  await t.test('patient deletion is transactional and clinic-scoped, including lab orders', async () => {
    await asUser(db, null, 'service_role')
    for (const table of ['tooth_records', 'appointments', 'payments', 'lab_orders']) {
      await db.query(`insert into public.${table}(clinic_id,data) values ($1,$2),($3,$2)`,
        [ids.clinicA, { patientId: ids.patientA }, ids.clinicB])
    }
    await asUser(db, ids.ownerA)
    assert.equal((await db.query('select public.delete_patient_with_records($1) as id', [ids.patientB])).rows[0].id, null)
    await asUser(db, null, 'postgres')
    await db.exec(`
      create function public.reject_test_payment_delete() returns trigger language plpgsql as $$
      begin raise exception 'synthetic delete failure'; end $$;
      create trigger reject_test_payment_delete before delete on public.payments
      for each row execute function public.reject_test_payment_delete();
    `)
    await asUser(db, ids.ownerA)
    await assert.rejects(db.query('select public.delete_patient_with_records($1)', [ids.patientA]), /synthetic delete failure/)
    for (const table of ['patients', 'tooth_records', 'appointments', 'payments', 'lab_orders']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 1, `${table}: rollback retains A's data`)
    }
    await asUser(db, null, 'postgres')
    await db.exec('drop trigger reject_test_payment_delete on public.payments; drop function public.reject_test_payment_delete()')
    await asUser(db, ids.ownerA)
    assert.equal((await db.query('select public.delete_patient_with_records($1) as id', [ids.patientA])).rows[0].id, ids.patientA)
    for (const table of ['patients', 'tooth_records', 'appointments', 'payments', 'lab_orders']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 0)
    }
    await asUser(db, ids.ownerB)
    for (const table of ['patients', 'tooth_records', 'appointments', 'payments', 'lab_orders']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 1, `${table}: B's data remains`)
    }
    await asUser(db, ids.ownerA)
    assert.equal((await db.query('select public.delete_patient_with_records($1) as id', [ids.patientA])).rows[0].id, null)
  })

  await t.test('anonymous callers cannot invoke privileged helpers or patient deletion', async () => {
    await asUser(db, null, 'anon')
    await denied(db.query('select dentalcloud_private.is_login_user($1)', [ids.ownerA]))
    await denied(db.query('select public.delete_patient_with_records($1)', [ids.patientB]))
  })

  await t.test('billing patch preserves concurrent settings and rejects stale revisions and client calls', async () => {
    await asUser(db, ids.ownerB)
    await denied(db.query('select public.apply_subscription_patch($1,null,$2)', [ids.clinicB, { paid: true }]))
    await db.query('update public.clinics set data = data || $1 where id=$2', [{ name: 'Concurrent settings' }, ids.clinicB])
    await asUser(db, null, 'service_role')
    const result = await db.query('select public.apply_subscription_patch($1,null,$2) as data', [ids.clinicB, { paid: true, paidThrough: '2027-09-28' }])
    assert.equal(result.rows[0].data.name, 'Concurrent settings')
    assert.ok(result.rows[0].data.subscriptionRevision)
    const stale = await db.query('select public.apply_subscription_patch($1,null,$2) as data', [ids.clinicB, { paid: false }])
    assert.equal(stale.rows[0].data, null)
    assert.equal((await clinic(db, ids.clinicB)).paid, true)
  })
})
