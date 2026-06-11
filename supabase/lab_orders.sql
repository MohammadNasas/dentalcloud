-- DentalCloud — add the lab_orders table to an existing Supabase project.
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run (idempotent). Requires the original schema.sql to have been
-- applied already (it provides public.clinics and public.current_clinic_id()).

create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create index if not exists idx_lab_clinic on public.lab_orders(clinic_id);

alter table public.lab_orders enable row level security;

drop policy if exists lab_orders_all on public.lab_orders;
create policy lab_orders_all on public.lab_orders for all
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());
