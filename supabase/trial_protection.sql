-- Run this once in Supabase SQL Editor before deploying the trial-protection
-- code. It is safe to run more than once.

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

create index if not exists idx_subscription_trials_clinic
  on public.subscription_trials(clinic_id);

-- Existing installations may already have the table from an earlier rollout.
alter table public.subscription_trials
  add column if not exists paypal_payer_id text,
  add column if not exists paypal_email text,
  add column if not exists paypal_payment_token_id text;

-- If an older deployment wrote duplicate identities before the unique indexes
-- existed, keep the earliest trial as the owner. Later rows are cleared here;
-- authenticated status sync will then fail to reclaim the identity, cancel the
-- duplicate PayPal subscription, and expire that clinic's free access.
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

alter table public.subscription_trials enable row level security;

-- No client policies: only the payment functions, using the service-role key,
-- may read or write this ledger.

-- Preserve the one-trial rule for clinics that already used a trial before
-- this table existed. The owner-doctor email is the signed-in account email.
insert into public.subscription_trials (
  email, user_id, clinic_id, status, paypal_subscription_id,
  trial_started_at, trial_ends_at, created_at, updated_at
)
select
  lower(btrim(d.data->>'email')),
  d.id,
  c.id,
  case
    when coalesce(c.data->>'subscriptionPaymentVerified', 'false') = 'true' then 'paid'
    when c.data->>'trialEndsAt' is not null and (c.data->>'trialEndsAt')::timestamptz < now() then 'expired'
    else 'active'
  end,
  nullif(c.data->>'paypalSubscriptionId', ''),
  nullif(c.data->>'trialStartedAt', '')::timestamptz,
  nullif(c.data->>'trialEndsAt', '')::timestamptz,
  coalesce(nullif(c.data->>'trialStartedAt', '')::timestamptz, c.created_at, now()),
  now()
from public.clinics c
join public.doctors d on d.id = c.owner_id
where nullif(lower(btrim(d.data->>'email')), '') is not null
  and (
    nullif(c.data->>'trialStartedAt', '') is not null
    or nullif(c.data->>'paypalSubscriptionId', '') is not null
  )
on conflict (email) do nothing;

notify pgrst, 'reload schema';
