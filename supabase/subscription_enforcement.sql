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
