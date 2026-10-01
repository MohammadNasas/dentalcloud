import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

export const schema = await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
export const migration = await readFile(new URL('../../supabase/access_hardening.sql', import.meta.url), 'utf8')
export const marker = '-- DentalCloud: protect clinic membership and server-managed subscriptions.'
export const ids = {
  ownerA: '10000000-0000-0000-0000-000000000001',
  ownerB: '10000000-0000-0000-0000-000000000002',
  member: '10000000-0000-0000-0000-000000000003',
  outsider: '10000000-0000-0000-0000-000000000004',
  complimentary: '10000000-0000-0000-0000-000000000005',
  unconfirmed: '10000000-0000-0000-0000-000000000006',
  clinicA: '20000000-0000-0000-0000-000000000001',
  clinicB: '20000000-0000-0000-0000-000000000002',
  clinicC: '20000000-0000-0000-0000-000000000003',
  clinicD: '20000000-0000-0000-0000-000000000004',
  clinicE: '20000000-0000-0000-0000-000000000005',
  profile: '30000000-0000-0000-0000-000000000001',
  patientA: '40000000-0000-0000-0000-000000000001',
  patientB: '40000000-0000-0000-0000-000000000002',
}

// Real PostgreSQL RLS/triggers, with just the Supabase auth/storage primitives
// stubbed. No credentials, network requests, or production records are used.
export async function setup(db) {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create table storage.buckets(id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$
      select string_to_array($1, '/')
    $$;
    grant usage on schema public, auth, storage to authenticated, service_role, anon;
  `)
  await db.exec(schema.split(marker)[0])
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated, service_role;
    insert into auth.users values
      ('${ids.ownerA}', 'owner-a@example.invalid', now()),
      ('${ids.ownerB}', 'owner-b@example.invalid', now()),
      ('${ids.member}', 'member@example.invalid', now()),
      ('${ids.outsider}', 'outsider@example.invalid', now()),
      ('${ids.complimentary}', 'mohammadissogood556@gmail.com', now()),
      ('${ids.unconfirmed}', 'mohammadissogood556@gmail.com', null);
    insert into public.clinics(id, owner_id, data) values
      ('${ids.clinicA}', '${ids.ownerA}', '{"name":"Clinic A","tier":"pro","paid":true,"subscriptionProvider":"paypal","subscriptionPaymentVerified":true,"subscriptionVerifiedAmount":50,"subscriptionVerifiedCurrency":"USD","futureBillingFlag":"keep"}'),
      ('${ids.clinicB}', '${ids.ownerB}', '{"name":"Clinic B","tier":"pro","paid":false}');
    insert into public.doctors(id, clinic_id, data) values
      ('${ids.ownerA}', '${ids.clinicA}', '{"role":"admin","isOwner":true}'),
      ('${ids.ownerB}', '${ids.clinicB}', '{"role":"admin","isOwner":true}'),
      ('${ids.member}', '${ids.clinicA}', '{"role":"doctor","isOwner":false}');
    insert into public.patients(id, clinic_id, data) values
      ('${ids.patientA}', '${ids.clinicA}', '{"name":"Synthetic A"}'),
      ('${ids.patientB}', '${ids.clinicB}', '{"name":"Synthetic B"}');
    insert into storage.objects values
      (gen_random_uuid(), 'patient-images', '${ids.clinicA}/${ids.patientA}/xray.jpg'),
      (gen_random_uuid(), 'patient-images', '${ids.clinicB}/${ids.patientB}/xray.jpg');
  `)
  await db.exec(migration)
}

export async function asUser(db, id, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || ''])
  await db.exec(`set role ${role}`)
}

export async function clinic(db, id) {
  return (await db.query('select data from public.clinics where id = $1', [id])).rows[0]?.data
}

export const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501')
