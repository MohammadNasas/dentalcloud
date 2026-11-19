-- Apply after loyalty.sql. No notifications are enabled without patient opt-in.
begin;
alter table public.loyalty_programs add column if not exists push_review boolean not null default true;
alter table public.loyalty_programs add column if not exists push_appointment boolean not null default true;
create table if not exists dentalcloud_private.push_config (
 id boolean primary key default true check(id), public_key text not null, private_key text not null,
 dispatch_secret text not null, enabled boolean not null default false
);
revoke all on dentalcloud_private.push_config from public,anon,authenticated;
alter table dentalcloud_private.push_config enable row level security;
create table if not exists public.loyalty_push_subscriptions (
 id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.loyalty_cards(patient_id) on delete cascade,
 endpoint text not null check(length(endpoint)<2048), keys jsonb not null,
 lang text not null default 'ar' check(lang in ('ar','en')),
 consent_at timestamptz not null default now(), consent_version text not null default '2026-11-19',
 next_review timestamptz not null default now()+interval '30 days',
 unique(patient_id,endpoint)
);
create table if not exists public.loyalty_push_jobs (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.loyalty_push_subscriptions(id) on delete cascade,
 kind text not null check(kind in ('review','appointment')), event_key text not null,
 appointment_id uuid references public.appointments(id) on delete cascade, appointment_start timestamptz,
 status text not null default 'pending' check(status in ('pending','sending','sent','cancelled','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 claim_id uuid, created_at timestamptz not null default now(),
 unique(subscription_id,kind,event_key)
);
create index if not exists loyalty_push_due on public.loyalty_push_jobs(status,available_at);
alter table public.loyalty_push_subscriptions enable row level security;
alter table public.loyalty_push_jobs enable row level security;
revoke all on public.loyalty_push_subscriptions,public.loyalty_push_jobs from public,anon,authenticated;
grant all on public.loyalty_push_subscriptions,public.loyalty_push_jobs to service_role;

-- Eligibility uses the same billing rules as subscription_enforcement.sql,
-- without requiring the scheduler to impersonate an authenticated doctor.
create or replace function dentalcloud_private.push_clinic_active(p_clinic uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare c jsonb; paid_at timestamptz; paid_until timestamptz;
begin
 select data into c from public.clinics where id=p_clinic;
 if c is null or coalesce(c->>'tier','') not in ('pro','economy') then return false; end if;
 if dentalcloud_private.safe_time(c->>'trialEndsAt')>now() then return true; end if;
 if c->'paid' is distinct from 'true'::jsonb then return false; end if;
 paid_until:=dentalcloud_private.safe_time(c->>'paidThrough');
 if c->>'subscriptionProvider' is distinct from 'paypal' then
  return coalesce(c->>'paidThrough','')='' or coalesce(paid_until>now(),false);
 end if;
 paid_at:=dentalcloud_private.safe_time(coalesce(nullif(c->>'subscriptionLastPaidAt',''),c->>'paidAt'));
 if c->'subscriptionPaymentVerified' is distinct from 'true'::jsonb or not (
  (coalesce(c->>'subscriptionVerifiedPlan','pro')='pro' and coalesce(c->>'subscriptionVerifiedAmount','') ~ '^50([.]0+)?$') or
  (c->>'subscriptionVerifiedPlan'='pro_monthly' and coalesce(c->>'subscriptionVerifiedAmount','') ~ '^7([.]0+)?$'))
  or upper(coalesce(c->>'subscriptionVerifiedCurrency',''))<>'USD' or paid_at is null or paid_at>now()+interval '5 minutes'
  or (coalesce(c->>'paidThrough','')<>'' and paid_until is null) then return false; end if;
 paid_until:=least(paid_until,(paid_at at time zone 'UTC'+case when c->>'subscriptionVerifiedPlan'='pro_monthly' then interval '1 month' else interval '1 year' end) at time zone 'UTC');
 if paid_until is null or paid_until<=now() or jsonb_typeof(coalesce(c->'subscriptionRevokedPayments','[]'::jsonb))<>'array' then return false; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(c->'subscriptionRevokedPayments','[]'::jsonb)) r where
  (nullif(r->>'id','') is not null and r->>'id'=c->>'subscriptionVerifiedPaymentId') or dentalcloud_private.safe_time(r->>'time')=paid_at) then return false; end if;
 return true;
end $$;
revoke all on function dentalcloud_private.push_clinic_active(uuid) from public;

create or replace function public.set_loyalty_push_settings(p_review boolean,p_appointment boolean)
returns void language plpgsql security definer set search_path='' as $$
declare cl uuid:=public.current_clinic_id();
begin
 if auth.uid() is null or not dentalcloud_private.owns_clinic(cl) then raise exception 'Owner required' using errcode='42501'; end if;
 if p_review or p_appointment then perform dentalcloud_private.require_loyalty_access(cl,true); end if;
 update public.loyalty_programs set push_review=p_review,push_appointment=p_appointment where clinic_id=cl;
end $$;
revoke all on function public.set_loyalty_push_settings(boolean,boolean) from public;
grant execute on function public.set_loyalty_push_settings(boolean,boolean) to authenticated;

create or replace function public.loyalty_push_config()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('publicKey',public_key,'enabled',enabled) from dentalcloud_private.push_config where id;
$$;
create or replace function public.loyalty_push_manage(p_token text,p_action text,p_subscription jsonb,p_lang text default 'ar')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loyalty_cards; p public.loyalty_programs; active boolean; ep text:=p_subscription->>'endpoint';
begin
 select * into c from public.loyalty_cards where token=p_token and length(p_token)=64 for update;
 if c.patient_id is null then raise exception 'card_not_found'; end if;
 select * into p from public.loyalty_programs where clinic_id=c.clinic_id;
 active:=p.enabled and (p.push_review or p.push_appointment) and dentalcloud_private.push_clinic_active(c.clinic_id)
  and coalesce((select enabled from dentalcloud_private.push_config where id),false);
 if p_action='remove' then
  delete from public.loyalty_push_subscriptions where patient_id=c.patient_id and endpoint=ep;
 elsif p_action='subscribe' then
  if not active then raise exception 'reminders_paused'; end if;
  if not exists(select 1 from public.loyalty_push_subscriptions where patient_id=c.patient_id and endpoint=ep)
   and (select count(*) from public.loyalty_push_subscriptions where patient_id=c.patient_id)>=5 then raise exception 'device_limit'; end if;
  if p_lang not in ('ar','en') or ep is null or length(ep)>2047 or jsonb_typeof(p_subscription->'keys')<>'object' then raise exception 'bad_request'; end if;
  insert into public.loyalty_push_subscriptions(patient_id,endpoint,keys,lang) values(c.patient_id,ep,p_subscription->'keys',p_lang)
   on conflict(patient_id,endpoint) do update set keys=excluded.keys,lang=excluded.lang;
 elsif p_action<>'status' then raise exception 'bad_request'; end if;
 return jsonb_build_object('available',active,'review',p.push_review,'appointment',p.push_appointment,
  'subscribed',exists(select 1 from public.loyalty_push_subscriptions where patient_id=c.patient_id and endpoint=ep));
end $$;

-- Replacing a leaked card link also revokes devices registered through it.
create or replace function dentalcloud_private.revoke_card_push()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.token is distinct from new.token then delete from public.loyalty_push_subscriptions where patient_id=new.patient_id; end if;
 return new;
end $$;
revoke all on function dentalcloud_private.revoke_card_push() from public;
drop trigger if exists revoke_card_push on public.loyalty_cards;
create trigger revoke_card_push after update of token on public.loyalty_cards for each row execute function dentalcloud_private.revoke_card_push();

create or replace function public.loyalty_push_claim(p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg dentalcloud_private.push_config; s record; j record; jobs jsonb:='[]'::jsonb; claim uuid;
begin
 select * into cfg from dentalcloud_private.push_config where id and enabled;
 if cfg.id is null or p_secret is distinct from cfg.dispatch_secret then raise exception 'forbidden' using errcode='42501'; end if;
 -- Serialise enqueueing while allowing concurrent workers to finish sends.
 if not pg_try_advisory_xact_lock(64918320) then return jsonb_build_object('jobs','[]'::jsonb); end if;
 for s in select sub.* from public.loyalty_push_subscriptions sub join public.loyalty_cards c on c.patient_id=sub.patient_id
  join public.loyalty_programs p on p.clinic_id=c.clinic_id where sub.next_review<=now() and p.enabled and p.push_review
  and dentalcloud_private.push_clinic_active(c.clinic_id) order by sub.next_review limit 100 for update of sub skip locked
 loop
  insert into public.loyalty_push_jobs(subscription_id,kind,event_key) values(s.id,'review',s.next_review::text) on conflict do nothing;
  update public.loyalty_push_subscriptions set next_review=now()+interval '30 days' where id=s.id;
 end loop;
 insert into public.loyalty_push_jobs(subscription_id,kind,event_key,appointment_id,appointment_start)
 select sub.id,'appointment',a.id::text||':'||(a.data->>'start'),a.id,dentalcloud_private.safe_time(a.data->>'start')
 from public.loyalty_push_subscriptions sub join public.loyalty_cards c on c.patient_id=sub.patient_id
 join public.loyalty_programs p on p.clinic_id=c.clinic_id
 join public.appointments a on a.clinic_id=c.clinic_id and a.data->>'patientId'=c.patient_id::text
 where p.enabled and p.push_appointment and dentalcloud_private.push_clinic_active(c.clinic_id)
  and a.data->>'status'='scheduled' and dentalcloud_private.safe_time(a.data->>'start')>now()
  and dentalcloud_private.safe_time(a.data->>'start')<=now()+interval '24 hours'
 on conflict do nothing;
 -- Revalidate immediately before claiming: cancelled/rescheduled appointments,
 -- disabled clinic settings, expired subscriptions and revoked devices never send.
 for j in select q.*,sub.endpoint,sub.keys,sub.lang,c.token,c.clinic_id,c.patient_id,p.enabled,p.push_review,p.push_appointment,
   a.data appointment_data,a.clinic_id appointment_clinic
  from public.loyalty_push_jobs q join public.loyalty_push_subscriptions sub on sub.id=q.subscription_id
  join public.loyalty_cards c on c.patient_id=sub.patient_id join public.loyalty_programs p on p.clinic_id=c.clinic_id
  left join public.appointments a on a.id=q.appointment_id
  where q.status='pending' and q.available_at<=now() and q.attempts<3 order by q.available_at limit 10 for update of q skip locked
 loop
  if not j.enabled or not dentalcloud_private.push_clinic_active(j.clinic_id)
   or (j.kind='review' and not j.push_review)
   or (j.kind='appointment' and (not j.push_appointment or j.appointment_data->>'status' is distinct from 'scheduled'
    or j.appointment_data->>'patientId' is distinct from j.patient_id::text or j.appointment_clinic is distinct from j.clinic_id
    or dentalcloud_private.safe_time(j.appointment_data->>'start') is distinct from j.appointment_start or j.appointment_start<=now())) then
   update public.loyalty_push_jobs set status='cancelled' where id=j.id; continue;
  end if;
  claim:=gen_random_uuid();
  update public.loyalty_push_jobs set status='sending',claim_id=claim,attempts=attempts+1,available_at=now() where id=j.id;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('id',j.id,'claim',claim,'endpoint',j.endpoint,'keys',j.keys,'lang',j.lang,
   'kind',j.kind,'start',j.appointment_start,'url','https://dentalcloudapp.com/loyalty#'||j.token));
 end loop;
 -- Ambiguous sends (process crash) are not retried automatically: avoid duplicates.
 update public.loyalty_push_jobs set status='failed' where status='sending' and available_at<now()-interval '1 hour';
 delete from public.loyalty_push_jobs where created_at<now()-interval '90 days' and status in ('sent','cancelled','failed');
 return jsonb_build_object('jobs',jobs,'vapid',jsonb_build_object('subject','https://dentalcloudapp.com','publicKey',cfg.public_key,'privateKey',cfg.private_key));
end $$;

create or replace function public.loyalty_push_finish(p_secret text,p_id uuid,p_claim uuid,p_status integer)
returns void language plpgsql security definer set search_path='' as $$
declare j public.loyalty_push_jobs;
begin
 if not exists(select 1 from dentalcloud_private.push_config where id and p_secret=dispatch_secret) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into j from public.loyalty_push_jobs where id=p_id and claim_id=p_claim and status='sending' for update;
 if j.id is null then return; end if;
 if p_status in (404,410) then delete from public.loyalty_push_subscriptions where id=j.subscription_id; return; end if;
 update public.loyalty_push_jobs set status=case when p_status between 200 and 299 then 'sent'
  when p_status in (429,500,502,503,504) and attempts<3 then 'pending' else 'failed' end,
  available_at=now()+interval '30 minutes' where id=j.id;
end $$;
revoke all on function public.loyalty_push_config(),public.loyalty_push_manage(text,text,jsonb,text),public.loyalty_push_claim(text),public.loyalty_push_finish(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.loyalty_push_config(),public.loyalty_push_manage(text,text,jsonb,text),public.loyalty_push_claim(text),public.loyalty_push_finish(text,uuid,uuid,integer) to service_role;
commit;
