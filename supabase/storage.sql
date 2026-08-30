-- DentalCloud patient photos / X-rays cloud storage.
-- Run once in Supabase SQL Editor for an existing project.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-images',
  'patient-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are: <clinic-id>/<patient-id>/<image-id>.jpg
-- The app never exposes a public URL; authenticated clinic members access
-- their own folder through these Row-Level Security policies.
drop policy if exists patient_images_select on storage.objects;
create policy patient_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-images'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
  );

drop policy if exists patient_images_insert on storage.objects;
create policy patient_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-images'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
  );

drop policy if exists patient_images_update on storage.objects;
create policy patient_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'patient-images'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
  )
  with check (
    bucket_id = 'patient-images'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
  );

drop policy if exists patient_images_delete on storage.objects;
create policy patient_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'patient-images'
    and (storage.foldername(name))[1] = public.current_clinic_id()::text
  );
