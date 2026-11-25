-- Owner-authorized device access for pre-profile doctor identities (no time limit).
-- Existing doctor IDs, creation dates and patient/appointment associations stay intact.
begin;
create table if not exists public.clinic_profile_devices (
  token_hash text primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  profile_ids uuid[] not null,
  expires_at timestamptz not null
);
alter table public.clinic_profile_devices enable row level security;
revoke all on public.clinic_profile_devices from public, anon, authenticated;
grant all on public.clinic_profile_devices to service_role;

create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path='' as $$
  select d.clinic_id from public.doctors d join public.clinics c on c.id=d.clinic_id
  where d.id=auth.uid() and (c.owner_id=auth.uid() or (
    not (d.data ? 'profileDeletedAt') and exists (
      select 1 from public.clinic_profiles p where p.user_id=d.id and p.clinic_id=d.clinic_id and p.active
    ))) limit 1
$$;

create or replace function public.clinic_profile_finish_legacy(p_clinic uuid,p_doctor uuid,p_email text)
returns void language plpgsql security definer set search_path='' as $$
declare d public.doctors; c public.clinics;
begin
  select * into d from public.doctors where id=p_doctor and clinic_id=p_clinic for update;
  select * into c from public.clinics where id=p_clinic;
  if d.id is null or c.owner_id=p_doctor or d.data ? 'profileDeletedAt'
    or not coalesce((d.data ? 'passwordHash' or d.data->>'profileLoginMode'='device'),false)
    or exists(select 1 from public.clinic_profiles where user_id=p_doctor and not active)
    or exists(select 1 from public.clinic_profiles where user_id=p_doctor and clinic_id<>p_clinic)
    or not exists(select 1 from auth.users where id=p_doctor and email=p_email
      and raw_app_meta_data->>'legacyClinicId'=p_clinic::text) then
    raise exception 'Legacy profile unavailable' using errcode='42501';
  end if;
  update public.doctors set data=(data-'passwordHash') || jsonb_build_object('email',p_email,'profileLoginMode','device') where id=p_doctor;
  insert into public.clinic_profiles(user_id,clinic_id,active) values(p_doctor,p_clinic,true)
    on conflict(user_id) do nothing;
end $$;
revoke all on function public.clinic_profile_finish_legacy(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.clinic_profile_finish_legacy(uuid,uuid,text) to service_role;

-- Tombstone and revoke under the same row lock used by legacy activation.
-- Deletion never cascades into clinical history, and device tokens cannot restore it.
create or replace function public.clinic_profile_archive(p_doctor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); d public.doctors;
begin
  if cid is null or not dentalcloud_private.owns_clinic(cid) or p_doctor=auth.uid() then
    raise exception 'Owner required' using errcode='42501';
  end if;
  select * into d from public.doctors where id=p_doctor and clinic_id=cid for update;
  if d.id is null then raise exception 'Unknown profile' using errcode='42501'; end if;
  update public.clinic_profiles set active=false where user_id=p_doctor and clinic_id=cid;
  update public.doctors set data=(data-'passwordHash') || jsonb_build_object('profileDeletedAt',now()) where id=p_doctor;
end $$;
revoke all on function public.clinic_profile_archive(uuid) from public, anon;
grant execute on function public.clinic_profile_archive(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
