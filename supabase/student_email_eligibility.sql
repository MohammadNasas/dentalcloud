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
