import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { setup, asUser, ids, denied, schema } from './helpers/securityFixture.mjs'
import { isStudentEmail } from '../src/lib/studentEmail.js'

const migration = await readFile(new URL('../supabase/student_email_eligibility.sql', import.meta.url), 'utf8')
const cases = [
  ['student@university.edu', true], [' NAME@STUDENT.UNIVERSITY.EDU.PS ', true],
  ['student@university.edu.jo', true], ['student@university.edu.example.com', true],
  ['name@gmail.com', false], ['edu@gmail.com', false], ['name@edu-clinic.com', false],
  ['name@myeducation.com', false], ['name@university.education', false],
  ['name@edu.com', false], ['name@university..edu', false], ['name@@university.edu', false],
  ['name@-university.edu', false], ['name@university.edu-', false],
  ['name@university.edu.', false], ['name @university.edu', false], ['', false],
]

test('Student email matching accepts an edu domain label, not a substring', () => {
  for (const [email, expected] of cases) assert.equal(isStudentEmail(email), expected, email)
  assert.equal(isStudentEmail(null), false)
})

test('Student enrolment uses confirmed auth email and cannot be bypassed by API writes', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await setup(db)
  // A legacy Student clinic with a personal address is intentionally retained.
  await db.query("update clinics set data = data || '{\"tier\":\"student\"}' where id=$1", [ids.clinicB])
  await db.exec(migration)
  await db.exec(migration)
  assert.equal(schema.slice(schema.indexOf('-- DentalCloud: confirmed educational email')).split('-- DentalCloud: independent clinic operating expenses.')[0].trim().replace(/\r\n/g, '\n'), migration.trim().replace(/\r\n/g, '\n'))

  for (const [email, expected] of cases) {
    await db.query('update auth.users set email=$1 where id=$2', [email, ids.outsider])
    assert.equal((await db.query('select dentalcloud_private.student_email_eligible($1) as ok', [ids.outsider])).rows[0].ok, expected, email)
  }
  await db.query("update auth.users set email='student@university.edu.ps', email_confirmed_at=null where id=$1", [ids.outsider])
  await asUser(db, ids.outsider)
  const insert = (tier = 'student') => db.query('insert into clinics(id,owner_id,data) values ($1,$2,$3)', [ids.clinicC, ids.outsider, { tier, email: 'fake@university.edu', paid: true }])
  await denied(insert())
  await asUser(db, '', 'postgres')
  await db.query("update auth.users set email='personal@gmail.com', email_confirmed_at=now() where id=$1", [ids.outsider])
  await asUser(db, ids.outsider)
  await denied(insert())
  await denied(insert('made-up-tier')) // Clinic sanitization defaults to Student.
  await insert('pro') // Personal email remains valid for Pro registration.
  await denied(db.query("update clinics set data=data || '{\"tier\":\"student\"}' where id=$1", [ids.clinicC]))
  await asUser(db, '', 'postgres')
  await db.query("update auth.users set email='student@university.edu.ps' where id=$1", [ids.outsider])
  await asUser(db, ids.outsider)
  await db.query("update clinics set data=data || '{\"tier\":\"student\"}' where id=$1", [ids.clinicC])
  assert.equal((await db.query('select data from clinics where id=$1', [ids.clinicC])).rows[0].data.tier, 'student')
  await asUser(db, ids.ownerB)
  await db.query("update clinics set data=data || '{\"name\":\"Legacy Student\"}' where id=$1", [ids.clinicB])
  assert.equal((await db.query('select data from clinics where id=$1', [ids.clinicB])).rows[0].data.tier, 'student')
})
