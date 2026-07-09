-- DentalCloud usage analytics.
-- Run this once in Supabase SQL Editor for an existing project.

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

create index if not exists idx_daily_active_day on public.daily_active_users(day desc);
create index if not exists idx_daily_active_clinic_day on public.daily_active_users(clinic_id, day desc);
create index if not exists idx_daily_active_platform_day on public.daily_active_users(platform, day desc);

alter table public.daily_active_users enable row level security;

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
