-- ════════════════════════════════════════════════════════════════════════
--  DentaCare — Supabase schema
--  Paste this whole file into:  Supabase Dashboard → SQL Editor → New query → Run
--
--  Design: each row stores the app object in a `data` jsonb column, plus the
--  columns needed for security (clinic_id) so it maps 1:1 to the app's data.
--  Row-Level Security makes every clinic see ONLY its own data.
-- ════════════════════════════════════════════════════════════════════════

-- ── Tables ───────────────────────────────────────────────────────────────
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,                 -- auth.users id of the clinic owner
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- A permanent, server-only record of each email address that has claimed a
-- PayPal free trial.  This is deliberately separate from `clinics.data`: a
-- user cannot reset it by abandoning a clinic or by starting another checkout.
create table if not exists public.subscription_trials (
  email text primary key check (email = lower(btrim(email))),
  user_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'active', 'paid', 'expired', 'cancelled')),
  paypal_subscription_id text unique,
  paypal_payer_id text,
  paypal_email text check (paypal_email is null or paypal_email = lower(btrim(paypal_email))),
  paypal_payment_token_id text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key,                    -- = auth.uid() for login users
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table if not exists public.tooth_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table if not exists public.daily_active_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.doctors(id) on delete cascade,
  day date not null,
  platform text not null check (platform in ('web', 'desktop', 'pwa')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ping_count integer not null default 1,
  user_agent text,
  data jsonb not null default '{}',
  unique (user_id, day, platform)
);

create index if not exists idx_doctors_clinic on public.doctors(clinic_id);
create index if not exists idx_subscription_trials_clinic on public.subscription_trials(clinic_id);
alter table public.subscription_trials
  add column if not exists paypal_payer_id text,
  add column if not exists paypal_email text,
  add column if not exists paypal_payment_token_id text;
-- Preserve the earliest owner if this schema is rerun over legacy duplicate
-- PayPal identities; status sync revokes the later trial when it next opens.
with ranked as (
  select email,
         row_number() over (
           partition by paypal_payer_id
           order by coalesce(trial_started_at, created_at), created_at, email
         ) as rn
  from public.subscription_trials
  where paypal_payer_id is not null
)
update public.subscription_trials t
set paypal_payer_id = null, updated_at = now()
from ranked r
where t.email = r.email and r.rn > 1;

with ranked as (
  select email,
         row_number() over (
           partition by paypal_email
           order by coalesce(trial_started_at, created_at), created_at, email
         ) as rn
  from public.subscription_trials
  where paypal_email is not null
)
update public.subscription_trials t
set paypal_email = null, updated_at = now()
from ranked r
where t.email = r.email and r.rn > 1;

with ranked as (
  select email,
         row_number() over (
           partition by paypal_payment_token_id
           order by coalesce(trial_started_at, created_at), created_at, email
         ) as rn
  from public.subscription_trials
  where paypal_payment_token_id is not null
)
update public.subscription_trials t
set paypal_payment_token_id = null, updated_at = now()
from ranked r
where t.email = r.email and r.rn > 1;

create unique index if not exists idx_subscription_trials_paypal_payer
  on public.subscription_trials(paypal_payer_id) where paypal_payer_id is not null;
create unique index if not exists idx_subscription_trials_paypal_email
  on public.subscription_trials(paypal_email) where paypal_email is not null;
create unique index if not exists idx_subscription_trials_paypal_payment_token
  on public.subscription_trials(paypal_payment_token_id) where paypal_payment_token_id is not null;
create index if not exists idx_patients_clinic on public.patients(clinic_id);
create index if not exists idx_tooth_clinic on public.tooth_records(clinic_id);
create index if not exists idx_appt_clinic on public.appointments(clinic_id);
create index if not exists idx_pay_clinic on public.payments(clinic_id);
create index if not exists idx_sugg_clinic on public.suggestions(clinic_id);
create index if not exists idx_lab_clinic on public.lab_orders(clinic_id);
create index if not exists idx_daily_active_day on public.daily_active_users(day desc);
create index if not exists idx_daily_active_clinic_day on public.daily_active_users(clinic_id, day desc);
create index if not exists idx_daily_active_platform_day on public.daily_active_users(platform, day desc);

-- ── Helper: the clinic the current logged-in user belongs to ─────────────
create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.doctors where id = auth.uid() limit 1
$$;

create or replace function public.track_daily_active(
  p_day date,
  p_platform text default 'web',
  p_user_agent text default null,
  p_data jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_clinic uuid;
  v_day date := coalesce(p_day, current_date);
  v_platform text := case
    when p_platform in ('web', 'desktop', 'pwa') then p_platform
    else 'web'
  end;
begin
  if v_user is null then
    return;
  end if;

  select clinic_id into v_clinic
  from public.doctors
  where id = v_user
  limit 1;

  if v_clinic is null then
    return;
  end if;

  insert into public.daily_active_users (
    clinic_id, user_id, day, platform, first_seen_at, last_seen_at,
    ping_count, user_agent, data
  )
  values (
    v_clinic, v_user, v_day, v_platform, now(), now(),
    1, left(coalesce(p_user_agent, ''), 500), coalesce(p_data, '{}')
  )
  on conflict (user_id, day, platform)
  do update set
    last_seen_at = now(),
    ping_count = public.daily_active_users.ping_count + 1,
    user_agent = excluded.user_agent,
    data = public.daily_active_users.data || excluded.data;
end;
$$;

grant execute on function public.track_daily_active(date, text, text, jsonb) to authenticated;

-- ── Enable Row-Level Security ────────────────────────────────────────────
alter table public.clinics       enable row level security;
alter table public.subscription_trials enable row level security;
alter table public.doctors       enable row level security;
alter table public.patients      enable row level security;
alter table public.tooth_records enable row level security;
alter table public.appointments  enable row level security;
alter table public.payments      enable row level security;
alter table public.suggestions   enable row level security;
alter table public.lab_orders    enable row level security;
alter table public.daily_active_users enable row level security;

-- ── Policies ─────────────────────────────────────────────────────────────
-- clinics
drop policy if exists clinics_read on public.clinics;
create policy clinics_read on public.clinics for select
  using (id = public.current_clinic_id() or owner_id = auth.uid());
drop policy if exists clinics_insert on public.clinics;
create policy clinics_insert on public.clinics for insert
  with check (owner_id = auth.uid());
drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics for update
  using (id = public.current_clinic_id() or owner_id = auth.uid());

-- doctors
drop policy if exists doctors_read on public.doctors;
create policy doctors_read on public.doctors for select
  using (clinic_id = public.current_clinic_id() or id = auth.uid());
drop policy if exists doctors_insert on public.doctors;
create policy doctors_insert on public.doctors for insert
  with check (id = auth.uid() or clinic_id = public.current_clinic_id());
drop policy if exists doctors_update on public.doctors;
create policy doctors_update on public.doctors for update
  using (clinic_id = public.current_clinic_id());
drop policy if exists doctors_delete on public.doctors;
create policy doctors_delete on public.doctors for delete
  using (clinic_id = public.current_clinic_id() and id <> auth.uid());

-- usage analytics
drop policy if exists daily_active_users_read on public.daily_active_users;
create policy daily_active_users_read on public.daily_active_users for select
  using (clinic_id = public.current_clinic_id());
drop policy if exists daily_active_users_insert on public.daily_active_users;
create policy daily_active_users_insert on public.daily_active_users for insert
  with check (clinic_id = public.current_clinic_id() and user_id = auth.uid());
drop policy if exists daily_active_users_update on public.daily_active_users;
create policy daily_active_users_update on public.daily_active_users for update
  using (clinic_id = public.current_clinic_id() and user_id = auth.uid())
  with check (clinic_id = public.current_clinic_id() and user_id = auth.uid());

-- generic clinic-scoped tables
do $$
declare t text;
begin
  foreach t in array array['patients','tooth_records','appointments','payments','suggestions','lab_orders']
  loop
    execute format('drop policy if exists %1$s_all on public.%1$s;', t);
    execute format(
      'create policy %1$s_all on public.%1$s for all
         using (clinic_id = public.current_clinic_id())
         with check (clinic_id = public.current_clinic_id());', t);
  end loop;
end $$;

-- ── Owner inbox ──────────────────────────────────────────────────────────
-- The app owner can read EVERY clinic's suggestions (for the in-app inbox).
-- RLS select policies are OR-combined, so this only widens read access for the
-- owner; every other clinic still sees its own rows only.
drop policy if exists suggestions_owner_read on public.suggestions;
create policy suggestions_owner_read on public.suggestions for select
  using ( lower(auth.jwt() ->> 'email') = 'mohammadissogood556@gmail.com' );

-- ── Private patient photos / X-rays ─────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-images', 'patient-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Paths are <clinic-id>/<patient-id>/<image-id>.jpg. The first folder is
-- checked against the signed-in doctor's clinic for every storage operation.
drop policy if exists patient_images_select on storage.objects;
create policy patient_images_select on storage.objects for select to authenticated
  using (bucket_id = 'patient-images' and (storage.foldername(name))[1] = public.current_clinic_id()::text);
drop policy if exists patient_images_insert on storage.objects;
create policy patient_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-images' and (storage.foldername(name))[1] = public.current_clinic_id()::text);
drop policy if exists patient_images_update on storage.objects;
create policy patient_images_update on storage.objects for update to authenticated
  using (bucket_id = 'patient-images' and (storage.foldername(name))[1] = public.current_clinic_id()::text)
  with check (bucket_id = 'patient-images' and (storage.foldername(name))[1] = public.current_clinic_id()::text);
drop policy if exists patient_images_delete on storage.objects;
create policy patient_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'patient-images' and (storage.foldername(name))[1] = public.current_clinic_id()::text);

-- Done. ✅  Next: copy your Project URL + anon key into the app's .env (see SUPABASE_SETUP.md)

-- DentalCloud: protect clinic membership and server-managed subscriptions.
-- Apply in Supabase SQL Editor before deploying clients that read back writes.
-- Safe to re-run. Existing clinic grants/data are retained; no memberships are
-- reassigned. Review existing ownership/membership separately before rollout.
-- This same block is included at the end of schema.sql for fresh installations.

begin;

create schema if not exists dentalcloud_private;
revoke all on schema dentalcloud_private from public;
grant usage on schema dentalcloud_private to authenticated, service_role;

-- Keep auth.users inaccessible to clients; helpers disclose only decisions.
create or replace function dentalcloud_private.owns_clinic(p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinics c
    where c.id = p_clinic_id and c.owner_id = auth.uid()
  )
$$;

create or replace function dentalcloud_private.is_login_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = p_user_id)
$$;

-- Existing complimentary accounts remain complimentary. New grants use the
-- verified auth identity, never an editable doctors.data email or client flag.
-- Hashes are the existing allowlist from src/lib/db.js, not new beneficiaries.
create or replace function dentalcloud_private.complimentary_owner(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null
      and encode(sha256(convert_to(lower(btrim(u.email)), 'UTF8')), 'hex') in (
        '50fb0c52d73b7b0963f9e2da16b619e1e14bf257ff868c856f581409d07471ed',
        '9822c4c55a9c90f13a3d6b132f13f8f235c2df649bb6547c014f8e77afeaff64',
        'f74ec02046e1787f8bcb6fbd3263a32be7d68cc1933f3d6ef2facaf48af2606f',
        '0a63e0c92d3dc6a4f0a0daf8635d7355b6d16cca0eb51c0e5e679e5bd9788194'
      )
  )
$$;

revoke all on function dentalcloud_private.owns_clinic(uuid) from public;
revoke all on function dentalcloud_private.is_login_user(uuid) from public;
revoke all on function dentalcloud_private.complimentary_owner(uuid) from public;
grant execute on function dentalcloud_private.owns_clinic(uuid) to authenticated, service_role;
grant execute on function dentalcloud_private.is_login_user(uuid) to authenticated, service_role;
grant execute on function dentalcloud_private.complimentary_owner(uuid) to authenticated, service_role;

-- SECURITY INVOKER is intentional: current_user must be the real DB role, not
-- the function owner or a client-supplied JWT claim. PayPal uses service_role.
create or replace function dentalcloud_private.guard_clinic_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  incoming jsonb := new.data;
  editable jsonb;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if current_user <> 'authenticated' then
    raise exception 'Authenticated clinic access required' using errcode = '42501';
  end if;
  if jsonb_typeof(incoming) is distinct from 'object' then
    raise exception 'Clinic data must be an object' using errcode = '22023';
  end if;

  -- Allowlist ordinary settings. Preserve every other existing field, including
  -- future billing fields, even when an older client submits a stale full row.
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into editable
  from jsonb_each(incoming) as entry(k, v)
  where k = any(array['name', 'nameAr', 'settings', 'prices',
                     'customInstructions', 'customSheets', 'labs']);

  if tg_op = 'INSERT' then
    new.data := editable || jsonb_build_object(
      'id', new.id,
      'createdAt', coalesce(new.created_at, now()),
      'tier', case when incoming->>'tier' in ('pro', 'economy') then 'pro' else 'student' end,
      'paid', false
    );
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
      raise exception 'Clinic identity and ownership are server-managed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.data := old.data || editable || jsonb_build_object('id', old.id);
    -- Selecting the free Student plan remains supported by existing clients.
    -- It never grants Pro; paid/trial status is otherwise server-managed.
    if incoming->>'tier' = 'student' then
      new.data := jsonb_set(new.data, '{tier}', '"student"'::jsonb);
    elsif old.data->>'tier' = 'economy' then
      new.data := jsonb_set(new.data, '{tier}', '"pro"'::jsonb);
    end if;
  end if;

  if dentalcloud_private.complimentary_owner(new.owner_id) then
    new.data := new.data || '{"tier":"pro","paid":true}'::jsonb;
  end if;
  return new;
end
$$;

create or replace function dentalcloud_private.guard_doctor_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if current_user <> 'authenticated' then
    raise exception 'Authenticated doctor access required' using errcode = '42501';
  end if;
  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'Doctor data must be an object' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.clinic_id is distinct from old.clinic_id then
      raise exception 'Doctor identity and clinic membership are server-managed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    if not dentalcloud_private.owns_clinic(old.clinic_id) then
      new.data := (new.data - array['role', 'isOwner'])
        || (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
            from jsonb_each(old.data) as entry(k, v)
            where k = any(array['role', 'isOwner']));
    end if;
  end if;
  new.data := new.data || jsonb_build_object('id', new.id, 'clinicId', new.clinic_id);
  -- A display-only doctor can never impersonate the account owner.
  if not dentalcloud_private.is_login_user(new.id) then
    new.data := new.data || '{"isOwner":false}'::jsonb;
  end if;
  return new;
end
$$;

revoke all on function dentalcloud_private.guard_clinic_write() from public;
revoke all on function dentalcloud_private.guard_doctor_write() from public;

drop trigger if exists guard_clinic_write on public.clinics;
create trigger guard_clinic_write before insert or update on public.clinics
for each row execute function dentalcloud_private.guard_clinic_write();
drop trigger if exists guard_doctor_write on public.doctors;
create trigger guard_doctor_write before insert or update on public.doctors
for each row execute function dentalcloud_private.guard_doctor_write();

drop policy if exists clinics_insert on public.clinics;
create policy clinics_insert on public.clinics for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics for update to authenticated
  using (id = public.current_clinic_id() or owner_id = auth.uid())
  with check (id = public.current_clinic_id() or owner_id = auth.uid());

-- Only an owner may bootstrap their own login membership. Additional doctors
-- are display profiles until a trusted invitation flow creates login access.
drop policy if exists doctors_insert on public.doctors;
create policy doctors_insert on public.doctors for insert to authenticated
  with check (
    dentalcloud_private.owns_clinic(clinic_id)
    and (id = auth.uid() or not dentalcloud_private.is_login_user(id))
  );
drop policy if exists doctors_update on public.doctors;
create policy doctors_update on public.doctors for update to authenticated
  using (id = auth.uid() or dentalcloud_private.owns_clinic(clinic_id))
  with check (id = auth.uid() or dentalcloud_private.owns_clinic(clinic_id));
drop policy if exists doctors_delete on public.doctors;
create policy doctors_delete on public.doctors for delete to authenticated
  using (
    dentalcloud_private.owns_clinic(clinic_id)
    and not dentalcloud_private.is_login_user(id)
  );

-- Atomic patient deletion: a rejected child delete rolls back the whole call.
-- Explicit clinic filters supplement RLS, including for JSON-linked children.
create or replace function public.delete_patient_with_records(p_patient_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  target_clinic uuid := public.current_clinic_id();
  deleted_id uuid;
begin
  if auth.uid() is null or target_clinic is null then
    raise exception 'Authenticated clinic access required' using errcode = '42501';
  end if;
  perform 1 from public.patients
    where id = p_patient_id and clinic_id = target_clinic for update;
  if not found then return null; end if;

  delete from public.tooth_records where clinic_id = target_clinic and data->>'patientId' = p_patient_id::text;
  delete from public.appointments where clinic_id = target_clinic and data->>'patientId' = p_patient_id::text;
  delete from public.payments where clinic_id = target_clinic and data->>'patientId' = p_patient_id::text;
  delete from public.lab_orders where clinic_id = target_clinic and data->>'patientId' = p_patient_id::text;
  delete from public.patients where id = p_patient_id and clinic_id = target_clinic returning id into deleted_id;
  return deleted_id;
end
$$;
revoke all on function public.delete_patient_with_records(uuid) from public;
grant execute on function public.delete_patient_with_records(uuid) to authenticated;

-- Merge billing fields under a revision check, preserving concurrent settings.
-- Only the existing service role can call this; browser users cannot grant access.
create or replace function public.apply_subscription_patch(
  p_clinic_id uuid, p_expected_revision text, p_patch jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved jsonb;
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Server-managed subscriptions' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Invalid subscription patch' using errcode = '22023';
  end if;
  update public.clinics
  set data = data || p_patch || jsonb_build_object('subscriptionRevision', gen_random_uuid()::text)
  where id = p_clinic_id and (data->>'subscriptionRevision') is not distinct from p_expected_revision
  returning data into saved;
  return saved;
end
$$;
revoke all on function public.apply_subscription_patch(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_subscription_patch(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;

-- DentalCloud: enforce subscription writes and throttle coupon notifications.
-- Apply AFTER access_hardening.sql. Does not delete data or change entitlements.
begin;

create or replace function dentalcloud_private.safe_time(value text)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  if value is null or value = '' then return null; end if;
  return value::timestamptz;
exception when others then return null;
end $$;
revoke all on function dentalcloud_private.safe_time(text) from public;

-- -1: expired/unpaid, 0: Student, 1: valid Pro. Only trusted clinic fields count.
create or replace function dentalcloud_private.access_level(p_clinic uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare c jsonb; paid_at timestamptz; paid_until timestamptz;
begin
  select data into c from public.clinics
  where id = p_clinic and (id = public.current_clinic_id() or owner_id = auth.uid());
  if c is null then return -1; end if;
  if c->>'tier' = 'student' then return 0; end if;
  if c->>'tier' not in ('pro', 'economy') or c->>'tier' is null then return -1; end if;
  if dentalcloud_private.safe_time(c->>'trialEndsAt') > now() then return 1; end if;
  if c->'paid' is distinct from 'true'::jsonb then return -1; end if;
  paid_until := dentalcloud_private.safe_time(c->>'paidThrough');
  if c->>'subscriptionProvider' is distinct from 'paypal' then
    -- Existing permanent manual grants survive; explicit manual expiries count.
    if coalesce(c->>'paidThrough','') = '' or paid_until > now() then return 1; end if;
    return -1;
  end if;
  paid_at := dentalcloud_private.safe_time(coalesce(nullif(c->>'subscriptionLastPaidAt',''), c->>'paidAt'));
  if c->'subscriptionPaymentVerified' is distinct from 'true'::jsonb
    or coalesce(c->>'subscriptionVerifiedAmount','') !~ '^50([.]0+)?$'
    or upper(coalesce(c->>'subscriptionVerifiedCurrency','')) <> 'USD'
    or paid_at is null or paid_at > now() + interval '5 minutes' then return -1; end if;
  if coalesce(c->>'paidThrough','') = '' then paid_until := paid_at + interval '1 year'; end if;
  if paid_until is null or paid_until <= now() then return -1; end if;
  if jsonb_typeof(coalesce(c->'subscriptionRevokedPayments','[]'::jsonb)) <> 'array' then return -1; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(c->'subscriptionRevokedPayments','[]'::jsonb)) r
    where (nullif(r->>'id','') is not null and r->>'id' = c->>'subscriptionVerifiedPaymentId')
      or dentalcloud_private.safe_time(r->>'time') = paid_at
  ) then return -1; end if;
  return 1;
end $$;
revoke all on function dentalcloud_private.access_level(uuid) from public;
grant execute on function dentalcloud_private.access_level(uuid) to authenticated, service_role;

create or replace function dentalcloud_private.guard_subscription_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare level integer; cid uuid; before_data jsonb := '{}'; after_data jsonb := '{}'; k text;
begin
  if current_user in ('postgres','service_role','supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if current_user <> 'authenticated' then
    raise exception 'Authenticated clinic access required' using errcode = '42501';
  end if;
  if tg_table_name = 'clinics' then cid := new.id;
  elsif tg_op = 'DELETE' then cid := old.clinic_id;
  else cid := new.clinic_id; end if;
  level := dentalcloud_private.access_level(cid);
  if tg_op <> 'INSERT' then before_data := old.data; end if;
  if tg_op <> 'DELETE' then after_data := new.data; end if;

  if tg_table_name in ('appointments','payments','lab_orders') then
    if level < 1 then raise exception 'Active Pro subscription required' using errcode = '42501'; end if;
  elsif tg_table_name = 'clinics' then
    -- Renewal, account settings, and free-plan selection remain accessible.
    foreach k in array array['prices','customInstructions','customSheets','labs'] loop
      if level < 1 and coalesce(after_data->k,'null') is distinct from coalesce(before_data->k,'null') then
        raise exception 'Active Pro subscription required' using errcode = '42501';
      end if;
    end loop;
  elsif tg_table_name = 'doctors' then
    -- Own login profile remains editable, including before purchasing a plan.
    if (tg_op = 'DELETE' or new.id <> auth.uid()) and level < 1 then
      raise exception 'Active Pro subscription required' using errcode = '42501';
    end if;
  else
    if level < 0 then raise exception 'Subscription expired: records are read-only' using errcode = '42501'; end if;
    if level = 0 and tg_op <> 'DELETE' then
      if tg_table_name = 'patients' then
        foreach k in array array['orthodontics','consent'] loop
          if coalesce(after_data->k,'{}') is distinct from coalesce(before_data->k,'{}') then
            raise exception 'Active Pro subscription required' using errcode = '42501';
          end if;
        end loop;
        if coalesce(after_data->'photos','[]') is distinct from coalesce(before_data->'photos','[]') then
          if jsonb_typeof(after_data->'photos') <> 'array' or jsonb_array_length(after_data->'photos') > 1
             or exists (select 1 from jsonb_array_elements(after_data->'photos') p where p->>'category' is distinct from 'xray') then
            raise exception 'Student plan allows one X-ray per patient' using errcode = '42501';
          end if;
        end if;
      elsif tg_table_name = 'tooth_records' then
        if coalesce(after_data->'price','0') is distinct from coalesce(before_data->'price','0') then
          raise exception 'Active Pro subscription required for fees' using errcode = '42501';
        end if;
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function dentalcloud_private.guard_subscription_write() from public;
do $$
declare t text;
begin
  foreach t in array array['patients','tooth_records','appointments','payments','lab_orders','doctors'] loop
    execute format('drop trigger if exists z_subscription_write on public.%I', t);
    execute format('create trigger z_subscription_write before insert or update or delete on public.%I for each row execute function dentalcloud_private.guard_subscription_write()', t);
  end loop;
end $$;
drop trigger if exists z_subscription_write on public.clinics;
create trigger z_subscription_write before update on public.clinics
for each row execute function dentalcloud_private.guard_subscription_write();

-- Check the image allowance during Storage permission checks. Supabase may
-- perform its final write as a service role after this permission transaction.
-- Reads/export stay unchanged; same-path upserts replace the existing image.
create or replace function dentalcloud_private.check_image_write(p_name text, p_old_name text, p_delete boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare cid uuid := public.current_clinic_id(); pid text; level integer;
begin
  if cid is null or split_part(p_name,'/',1) <> cid::text then
    raise exception 'Clinic image access denied' using errcode = '42501';
  end if;
  perform 1 from public.clinics where id = cid for update;
  level := dentalcloud_private.access_level(cid);
  if level < 0 then raise exception 'Subscription expired: images are read-only' using errcode = '42501'; end if;
  if p_delete then return; end if;
  pid := split_part(p_name,'/',2);
  if not exists(select 1 from public.patients where id::text = pid and clinic_id = cid) then
    raise exception 'Patient image path required' using errcode = '42501';
  end if;
  if level = 0 and exists (
    select 1 from storage.objects o where bucket_id = 'patient-images'
      and to_jsonb(o)->>'archived_at' is null
      and split_part(name,'/',1) = cid::text and split_part(name,'/',2) = pid
      and (p_old_name is null or name <> p_old_name)
  ) then raise exception 'Student plan allows one X-ray per patient' using errcode = '42501'; end if;
end $$;
revoke all on function dentalcloud_private.check_image_write(text,text,boolean) from public;
grant execute on function dentalcloud_private.check_image_write(text,text,boolean) to authenticated;

create or replace function dentalcloud_private.guard_image_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') then
    if tg_op = 'DELETE' then return old; end if; return new;
  end if;
  if tg_op <> 'INSERT' and old.bucket_id = 'patient-images' then
    perform dentalcloud_private.check_image_write(old.name, old.name, true);
  end if;
  if tg_op <> 'DELETE' and new.bucket_id = 'patient-images' then
    perform dentalcloud_private.check_image_write(new.name, case when tg_op = 'UPDATE' then old.name else new.name end, false);
  end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end $$;
revoke all on function dentalcloud_private.guard_image_write() from public;
drop trigger if exists dentalcloud_subscription_write on storage.objects;
create trigger dentalcloud_subscription_write before insert or update or delete on storage.objects
for each row execute function dentalcloud_private.guard_image_write();

-- Durable per-user throttling, shared across Cloudflare workers and restarts.
create table if not exists dentalcloud_private.coupon_notifications (
  user_id uuid primary key, last_reserved_at timestamptz not null
);
alter table dentalcloud_private.coupon_notifications enable row level security;
revoke all on dentalcloud_private.coupon_notifications from public, anon, authenticated;
create or replace function public.reserve_coupon_notification(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then return false; end if;
  insert into dentalcloud_private.coupon_notifications(user_id,last_reserved_at) values(p_user_id,now())
  on conflict (user_id) do update set last_reserved_at=excluded.last_reserved_at
    where dentalcloud_private.coupon_notifications.last_reserved_at <= now() - interval '24 hours';
  get diagnostics changed = row_count;
  return changed = 1;
end $$;
revoke all on function public.reserve_coupon_notification(uuid) from public, anon, authenticated;
grant execute on function public.reserve_coupon_notification(uuid) to service_role;

revoke execute on function public.current_clinic_id() from public, anon;
grant execute on function public.current_clinic_id() to authenticated, service_role;
revoke execute on function public.track_daily_active(date,text,text,jsonb) from public, anon;
grant execute on function public.track_daily_active(date,text,text,jsonb) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;

-- DentalCloud: confirmed educational email required for new Student enrolments.
-- Apply after access_hardening.sql. Existing Student clinics are retained.
begin;

create or replace function dentalcloud_private.student_email_eligible(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null
      and lower(btrim(u.email)) ~ '^[^@[:space:]]+@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
      and length(split_part(btrim(u.email), '@', 2)) <= 253
      and split_part(lower(btrim(u.email)), '@', 2) ~ '[.]edu([.]|$)'
  )
$$;
revoke all on function dentalcloud_private.student_email_eligible(uuid) from public;
grant execute on function dentalcloud_private.student_email_eligible(uuid) to authenticated, service_role;

-- Runs after guard_clinic_write so the effective tier, not a forged payload,
-- determines eligibility. Ordinary saves of existing Student clinics are safe.
create or replace function dentalcloud_private.guard_student_email()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  if new.data->>'tier' is distinct from 'student' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.data->>'tier' = 'student' then return new; end if;
  end if;
  if not dentalcloud_private.student_email_eligible(new.owner_id) then
    raise exception 'student_email_required' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function dentalcloud_private.guard_student_email() from public;
drop trigger if exists guard_student_email on public.clinics;
create trigger guard_student_email before insert or update on public.clinics
for each row execute function dentalcloud_private.guard_student_email();
notify pgrst, 'reload schema';
commit;

-- DentalCloud: independent clinic operating expenses.
-- Apply after schema.sql / subscription_enforcement.sql, before deploying the UI.
begin;
create table if not exists public.clinic_expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists clinic_expenses_clinic on public.clinic_expenses(clinic_id);
alter table public.clinic_expenses enable row level security;
revoke all on public.clinic_expenses from public, anon;
grant select, insert, update, delete on public.clinic_expenses to authenticated, service_role;
drop policy if exists clinic_expenses_member on public.clinic_expenses;
create policy clinic_expenses_member on public.clinic_expenses for all to authenticated
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

create or replace function dentalcloud_private.guard_clinic_expense()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare cid uuid; amount numeric; paid_date date;
begin
  if tg_op = 'DELETE' then cid := old.clinic_id; else cid := new.clinic_id; end if;
  if current_user not in ('postgres','service_role','supabase_admin') then
    if current_user <> 'authenticated' or dentalcloud_private.access_level(cid) < 1 then
      raise exception 'Active Pro subscription required' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.clinic_id <> old.clinic_id) then
    raise exception 'Expense identity cannot be changed' using errcode = '42501';
  end if;
  if jsonb_typeof(new.data) is distinct from 'object'
    or jsonb_typeof(new.data->'amount') is distinct from 'number'
    or coalesce(new.data->>'category','') not in ('rent','secretary','salaries','electricity','water','internet','supplies','maintenance','other')
    or coalesce(new.data->>'currency','') !~ '^[A-Z]{3}$'
    or coalesce(new.data->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or length(coalesce(new.data->>'note','')) > 500 then
    raise exception 'Invalid expense' using errcode = '23514';
  end if;
  amount := (new.data->>'amount')::numeric;
  paid_date := (new.data->>'date')::date;
  if amount <= 0 or amount > 9999999 or amount <> round(amount,3) then
    raise exception 'Invalid expense amount' using errcode = '23514';
  end if;
  new.data := new.data || jsonb_build_object('id',new.id,'clinicId',new.clinic_id);
  new.updated_at := now();
  return new;
end $$;
revoke all on function dentalcloud_private.guard_clinic_expense() from public;
drop trigger if exists guard_clinic_expense on public.clinic_expenses;
create trigger guard_clinic_expense before insert or update or delete on public.clinic_expenses
  for each row execute function dentalcloud_private.guard_clinic_expense();
notify pgrst, 'reload schema';
commit;
