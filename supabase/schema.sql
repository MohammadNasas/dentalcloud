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

create index if not exists idx_doctors_clinic on public.doctors(clinic_id);
create index if not exists idx_patients_clinic on public.patients(clinic_id);
create index if not exists idx_tooth_clinic on public.tooth_records(clinic_id);
create index if not exists idx_appt_clinic on public.appointments(clinic_id);
create index if not exists idx_pay_clinic on public.payments(clinic_id);
create index if not exists idx_sugg_clinic on public.suggestions(clinic_id);
create index if not exists idx_lab_clinic on public.lab_orders(clinic_id);

-- ── Helper: the clinic the current logged-in user belongs to ─────────────
create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.doctors where id = auth.uid() limit 1
$$;

-- ── Enable Row-Level Security ────────────────────────────────────────────
alter table public.clinics       enable row level security;
alter table public.doctors       enable row level security;
alter table public.patients      enable row level security;
alter table public.tooth_records enable row level security;
alter table public.appointments  enable row level security;
alter table public.payments      enable row level security;
alter table public.suggestions   enable row level security;
alter table public.lab_orders    enable row level security;

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
