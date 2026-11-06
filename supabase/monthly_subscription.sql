-- Apply before deploying monthly checkout. No existing entitlements are changed.
begin;
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
    or not (
      (coalesce(c->>'subscriptionVerifiedPlan','pro') = 'pro' and coalesce(c->>'subscriptionVerifiedAmount','') ~ '^50([.]0+)?$')
      or (coalesce(c->>'subscriptionVerifiedPlan','pro') = 'pro_monthly' and coalesce(c->>'subscriptionVerifiedAmount','') ~ '^7([.]0+)?$')
    )
    or upper(coalesce(c->>'subscriptionVerifiedCurrency','')) <> 'USD'
    or paid_at is null or paid_at > now() + interval '5 minutes' then return -1; end if;
  if coalesce(c->>'paidThrough','') <> '' and paid_until is null then return -1; end if;
  paid_until := least(paid_until, (paid_at at time zone 'UTC' +
    case when c->>'subscriptionVerifiedPlan' = 'pro_monthly' then interval '1 month' else interval '1 year' end) at time zone 'UTC');
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

notify pgrst, 'reload schema';
commit;
