-- DentalCloud — retire the Economy tier and upgrade every matching clinic.
-- Run once in Supabase SQL Editor. Safe to re-run.

update public.clinics
set data = jsonb_set(data, '{tier}', '"pro"'::jsonb, true)
where data->>'tier' = 'economy';
