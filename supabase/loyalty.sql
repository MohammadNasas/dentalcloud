-- Apply after schema.sql, access_hardening.sql and subscription_enforcement.sql.
-- No historical visits are awarded when a clinic first enables loyalty.
begin;
create table if not exists public.loyalty_programs (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  enabled boolean not null default false,
  target integer not null default 5 check(target between 1 and 20),
  reward text not null check(length(btrim(reward)) between 1 and 160),
  categories jsonb not null default '["general","treatment","checkup"]'
    check(jsonb_typeof(categories)='array' and jsonb_array_length(categories) between 1 and 3
      and categories <@ '["general","treatment","checkup"]'::jsonb),
  updated_at timestamptz not null default now()
);
create table if not exists public.loyalty_cards (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  token text unique not null default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  target integer not null check(target between 1 and 20),
  reward text not null,
  categories jsonb not null,
  enrolled_at timestamptz not null default now()
);
create index if not exists loyalty_cards_clinic on public.loyalty_cards(clinic_id);
create table if not exists public.loyalty_stamps (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.loyalty_cards(patient_id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visited_at timestamptz not null
);
create index if not exists loyalty_stamps_patient on public.loyalty_stamps(patient_id);
create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.loyalty_cards(patient_id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid unique references public.appointments(id) on delete set null,
  cost integer not null check(cost between 1 and 20),
  reward text not null, redeemed_by uuid not null,
  redeemed_at timestamptz not null default now()
);
create index if not exists loyalty_redemptions_patient on public.loyalty_redemptions(patient_id);

create or replace function dentalcloud_private.require_loyalty_access(p_clinic uuid, p_owner boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_clinic is distinct from public.current_clinic_id()
    or dentalcloud_private.access_level(p_clinic) < 1
    or (p_owner and not dentalcloud_private.owns_clinic(p_clinic)) then
    raise exception 'Active clinic access required' using errcode='42501';
  end if;
end $$;
revoke all on function dentalcloud_private.require_loyalty_access(uuid,boolean) from public;

create or replace function dentalcloud_private.enroll_loyalty_patient()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.loyalty_cards(patient_id,clinic_id,target,reward,categories)
  select new.id,new.clinic_id,p.target,p.reward,p.categories
  from public.loyalty_programs p where p.clinic_id=new.clinic_id and p.enabled
  on conflict(patient_id) do nothing;
  return new;
end $$;
drop trigger if exists enroll_loyalty_patient on public.patients;
create trigger enroll_loyalty_patient after insert on public.patients
for each row execute function dentalcloud_private.enroll_loyalty_patient();

create or replace function public.save_loyalty_program(p_enabled boolean,p_target integer,p_reward text,p_categories jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id();
begin
  perform dentalcloud_private.require_loyalty_access(cid,true);
  insert into public.loyalty_programs(clinic_id,enabled,target,reward,categories)
  values(cid,p_enabled,p_target,btrim(p_reward),p_categories)
  on conflict(clinic_id) do update set enabled=excluded.enabled,target=excluded.target,
    reward=excluded.reward,categories=excluded.categories,updated_at=now();
  if p_enabled then
    insert into public.loyalty_cards(patient_id,clinic_id,target,reward,categories)
    select id,cid,p_target,btrim(p_reward),p_categories from public.patients where clinic_id=cid
    on conflict(patient_id) do nothing;
  end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function dentalcloud_private.sync_loyalty_stamp()
returns trigger language plpgsql security definer set search_path='' as $$
declare card public.loyalty_cards; started timestamptz;
begin
  -- Lock the patient's card before changing its stamp balance/redemption state.
  if tg_op='UPDATE' and old.data->>'patientId' is distinct from new.data->>'patientId' then
    perform 1 from public.loyalty_cards where patient_id::text=old.data->>'patientId' for update;
  end if;
  select * into card from public.loyalty_cards
    where patient_id::text=new.data->>'patientId' and clinic_id=new.clinic_id for update;
  if exists(select 1 from public.loyalty_redemptions where appointment_id=new.id) then
    if tg_op='UPDATE' and (old.data->>'patientId' is distinct from new.data->>'patientId'
      or new.data->>'status' is distinct from 'completed') then
      raise exception 'A redeemed reward visit cannot be reassigned or uncompleted';
    end if;
    return new;
  end if;
  started:=dentalcloud_private.safe_time(new.data->>'start');
  if card.patient_id is not null and new.data->>'status'='completed'
    and started>=card.enrolled_at and started<=now()
    and new.data->'loyaltyExcluded' is distinct from 'true'::jsonb
    and card.categories ? coalesce(nullif(new.data->>'loyaltyCategory',''),'general')
    and (exists(select 1 from public.loyalty_programs where clinic_id=new.clinic_id and enabled)
      or exists(select 1 from public.loyalty_stamps where appointment_id=new.id and patient_id=card.patient_id)) then
    insert into public.loyalty_stamps(appointment_id,patient_id,clinic_id,visited_at)
    values(new.id,card.patient_id,new.clinic_id,started)
    on conflict(appointment_id) do update set patient_id=excluded.patient_id,visited_at=excluded.visited_at;
  else
    delete from public.loyalty_stamps where appointment_id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists sync_loyalty_stamp on public.appointments;
create trigger sync_loyalty_stamp after insert or update on public.appointments
for each row execute function dentalcloud_private.sync_loyalty_stamp();

create or replace function dentalcloud_private.lock_loyalty_visit_delete()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.loyalty_cards where patient_id::text=old.data->>'patientId' for update;
  return old;
end $$;
drop trigger if exists lock_loyalty_visit_delete on public.appointments;
create trigger lock_loyalty_visit_delete before delete on public.appointments
for each row execute function dentalcloud_private.lock_loyalty_visit_delete();

create or replace function dentalcloud_private.loyalty_snapshot(p_patient uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('target',c.target,'reward',c.reward,
   'visits',greatest(0,(select count(*) from public.loyalty_stamps s where s.patient_id=c.patient_id)
     -coalesce((select sum(r.cost) from public.loyalty_redemptions r where r.patient_id=c.patient_id),0)),
   'adjustment',least(0,(select count(*) from public.loyalty_stamps s where s.patient_id=c.patient_id)
     -coalesce((select sum(r.cost) from public.loyalty_redemptions r where r.patient_id=c.patient_id),0)),
   'redeemed',(select count(*) from public.loyalty_redemptions r where r.patient_id=c.patient_id),
   'clinicName',cl.data->>'name','clinicNameAr',cl.data->>'nameAr','enabled',p.enabled)
 from public.loyalty_cards c join public.clinics cl on cl.id=c.clinic_id
 join public.loyalty_programs p on p.clinic_id=c.clinic_id where c.patient_id=p_patient;
$$;
revoke all on function dentalcloud_private.loyalty_snapshot(uuid) from public;
create or replace function public.get_loyalty_card(p_patient uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loyalty_cards;
begin
  select * into c from public.loyalty_cards where patient_id=p_patient;
  if c.patient_id is null then return null; end if;
  if auth.uid() is null or c.clinic_id is distinct from public.current_clinic_id() then
    raise exception 'Clinic access required' using errcode='42501'; end if;
  return dentalcloud_private.loyalty_snapshot(p_patient)||jsonb_build_object('token',c.token,'enrolledAt',c.enrolled_at);
end $$;
create or replace function public.read_public_loyalty_card(p_token text)
returns jsonb language sql stable security definer set search_path='' as $$
 select dentalcloud_private.loyalty_snapshot(patient_id)-'adjustment'-'redeemed'
 from public.loyalty_cards where token=p_token and length(p_token)=64;
$$;
revoke all on function public.read_public_loyalty_card(text) from public,anon,authenticated;
grant execute on function public.read_public_loyalty_card(text) to service_role;

create or replace function public.rotate_loyalty_token(p_patient uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform dentalcloud_private.require_loyalty_access(public.current_clinic_id());
  update public.loyalty_cards set token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')
  where patient_id=p_patient and clinic_id=public.current_clinic_id();
end $$;
create or replace function public.redeem_loyalty_reward(p_patient uuid,p_appointment uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loyalty_cards; ap public.appointments; balance bigint; earned_at timestamptz; prog public.loyalty_programs;
begin
  perform dentalcloud_private.require_loyalty_access(public.current_clinic_id());
  select * into c from public.loyalty_cards where patient_id=p_patient and clinic_id=public.current_clinic_id() for update;
  if c.patient_id is null then raise exception 'Card not found'; end if;
  select * into prog from public.loyalty_programs where clinic_id=c.clinic_id;
  if not prog.enabled then raise exception 'Loyalty is paused'; end if;
  if exists(select 1 from public.loyalty_redemptions where appointment_id=p_appointment and patient_id=p_patient) then
    return dentalcloud_private.loyalty_snapshot(p_patient); end if;
  select * into ap from public.appointments where id=p_appointment and clinic_id=c.clinic_id;
  if ap.id is null or ap.data->>'patientId' is distinct from p_patient::text
    or ap.data->>'status' is distinct from 'completed' then raise exception 'Choose a completed reward visit'; end if;
  select count(*),max(visited_at) into balance,earned_at from public.loyalty_stamps
    where patient_id=p_patient and appointment_id<>p_appointment;
  balance:=balance-coalesce((select sum(cost) from public.loyalty_redemptions where patient_id=p_patient),0);
  if balance<c.target or dentalcloud_private.safe_time(ap.data->>'start') is null
    or dentalcloud_private.safe_time(ap.data->>'start')<=earned_at
    or dentalcloud_private.safe_time(ap.data->>'start')>now() then
    raise exception 'Complete the required visits before the reward visit'; end if;
  delete from public.loyalty_stamps where appointment_id=p_appointment;
  insert into public.loyalty_redemptions(patient_id,clinic_id,appointment_id,cost,reward,redeemed_by)
  values(p_patient,c.clinic_id,p_appointment,c.target,c.reward,auth.uid());
  update public.loyalty_cards set target=prog.target,reward=prog.reward,categories=prog.categories where patient_id=p_patient;
  return dentalcloud_private.loyalty_snapshot(p_patient);
end $$;


do $$ declare tbl text; begin
 foreach tbl in array array['loyalty_programs','loyalty_cards','loyalty_stamps','loyalty_redemptions'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon, authenticated',tbl);
  execute format('grant all on public.%I to service_role',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('drop policy if exists clinic_read on public.%I',tbl);
  execute format('create policy clinic_read on public.%I for select to authenticated using (clinic_id=public.current_clinic_id())',tbl);
 end loop;
end $$;
revoke all on function public.save_loyalty_program(boolean,integer,text,jsonb),public.get_loyalty_card(uuid),public.rotate_loyalty_token(uuid),public.redeem_loyalty_reward(uuid,uuid) from public;
grant execute on function public.save_loyalty_program(boolean,integer,text,jsonb),public.get_loyalty_card(uuid),public.rotate_loyalty_token(uuid),public.redeem_loyalty_reward(uuid,uuid) to authenticated;
commit;
