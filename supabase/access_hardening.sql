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
