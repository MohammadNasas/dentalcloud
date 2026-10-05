-- DentalCloud: independent clinic operating expenses.
-- Apply after schema.sql / subscription_enforcement.sql, before deploying the UI.
begin;
create table if not exists public.clinic_expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists clinic_expenses_clinic on public.clinic_expenses(clinic_id);
alter table public.clinic_expenses enable row level security;
revoke all on public.clinic_expenses from public, anon;
grant select, insert, update, delete on public.clinic_expenses to authenticated, service_role;
drop policy if exists clinic_expenses_member on public.clinic_expenses;
create policy clinic_expenses_member on public.clinic_expenses for all to authenticated
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

create or replace function dentalcloud_private.guard_clinic_expense()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare cid uuid; amount numeric; paid_date date;
begin
  if tg_op = 'DELETE' then cid := old.clinic_id; else cid := new.clinic_id; end if;
  if current_user not in ('postgres','service_role','supabase_admin') then
    if current_user <> 'authenticated' or dentalcloud_private.access_level(cid) < 1 then
      raise exception 'Active Pro subscription required' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.clinic_id <> old.clinic_id) then
    raise exception 'Expense identity cannot be changed' using errcode = '42501';
  end if;
  if jsonb_typeof(new.data) is distinct from 'object'
    or jsonb_typeof(new.data->'amount') is distinct from 'number'
    or coalesce(new.data->>'category','') not in ('rent','secretary','salaries','electricity','water','internet','supplies','maintenance','other')
    or coalesce(new.data->>'currency','') !~ '^[A-Z]{3}$'
    or coalesce(new.data->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or length(coalesce(new.data->>'note','')) > 500 then
    raise exception 'Invalid expense' using errcode = '23514';
  end if;
  amount := (new.data->>'amount')::numeric;
  paid_date := (new.data->>'date')::date;
  if amount <= 0 or amount > 9999999 or amount <> round(amount,3) then
    raise exception 'Invalid expense amount' using errcode = '23514';
  end if;
  new.data := new.data || jsonb_build_object('id',new.id,'clinicId',new.clinic_id);
  new.updated_at := now();
  return new;
end $$;
revoke all on function dentalcloud_private.guard_clinic_expense() from public;
drop trigger if exists guard_clinic_expense on public.clinic_expenses;
create trigger guard_clinic_expense before insert or update or delete on public.clinic_expenses
  for each row execute function dentalcloud_private.guard_clinic_expense();
notify pgrst, 'reload schema';
commit;
