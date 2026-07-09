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

-- Done. ✅  Next: copy your Project URL + anon key into the app's .env (see SUPABASE_SETUP.md)
