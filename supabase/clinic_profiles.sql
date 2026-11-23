-- Apply after subscription_enforcement.sql. No existing patients are reassigned.
-- Staff use narrowly scoped RPCs; direct table access remains owner-only.
begin;
create table if not exists public.clinic_profiles (
  user_id uuid primary key references public.doctors(id),
  clinic_id uuid not null references public.clinics(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.clinic_profiles enable row level security;
revoke all on public.clinic_profiles from anon, authenticated;
grant select on public.clinic_profiles to authenticated;
grant all on public.clinic_profiles to service_role;
drop policy if exists owner_read on public.clinic_profiles;
create policy owner_read on public.clinic_profiles for select to authenticated
  using (dentalcloud_private.owns_clinic(clinic_id));

create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path='' as $$
  select d.clinic_id from public.doctors d join public.clinics c on c.id=d.clinic_id
  where d.id=auth.uid() and (c.owner_id=auth.uid() or exists (
    select 1 from public.clinic_profiles p where p.user_id=d.id and p.clinic_id=d.clinic_id and p.active
  )) limit 1
$$;

-- RESTRICTIVE policies also constrain any older permissive policies.
do $$ declare t text; begin
  foreach t in array array['patients','tooth_records','appointments','payments','lab_orders','clinic_expenses','suggestions'] loop
    execute format('drop policy if exists profiles_owner_only on public.%I',t);
    execute format('create policy profiles_owner_only on public.%I as restrictive for all to authenticated using (dentalcloud_private.owns_clinic(clinic_id)) with check (dentalcloud_private.owns_clinic(clinic_id))',t);
  end loop;
end $$;
-- Preserve the application's existing global support-inbox policy for its owner.
drop policy if exists profiles_owner_only on public.suggestions;
create policy profiles_owner_only on public.suggestions as restrictive for all to authenticated
  using (dentalcloud_private.owns_clinic(public.current_clinic_id()))
  with check (dentalcloud_private.owns_clinic(clinic_id));
drop policy if exists profiles_owner_only on public.clinics;
create policy profiles_owner_only on public.clinics as restrictive for all to authenticated
  using (owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists profiles_read on public.doctors;
create policy profiles_read on public.doctors as restrictive for select to authenticated
  using(dentalcloud_private.owns_clinic(clinic_id) or id=auth.uid());
drop policy if exists profiles_update on public.doctors;
create policy profiles_update on public.doctors as restrictive for update to authenticated
  using(dentalcloud_private.owns_clinic(clinic_id)) with check(dentalcloud_private.owns_clinic(clinic_id));

create or replace function dentalcloud_private.profile_pick(j jsonb, keys text[])
returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(j) where key=any(keys)
$$;
-- Nested medical objects may contain legacy structured financial fields.
create or replace function dentalcloud_private.profile_medical(j jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; k text; v jsonb;
begin
  if jsonb_typeof(j)='object' then
    result:='{}';
    for k,v in select * from jsonb_each(j) loop
      if k !~* '(price|cost|amount|paid|payment|balance|debt|discount|revenue|income|fee|financial|billing|total|مدفوع|سعر|رصيد|تكلفة)' then
        result:=result || jsonb_build_object(k,dentalcloud_private.profile_medical(v));
      end if;
    end loop;
    return result;
  elsif jsonb_typeof(j)='array' then
    select coalesce(jsonb_agg(dentalcloud_private.profile_medical(value)),'[]'::jsonb) into result from jsonb_array_elements(j);
    return result;
  end if;
  return j;
end $$;
create or replace function dentalcloud_private.profile_patient_owned(p uuid, cid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.patients where id=p and clinic_id=cid
    and coalesce(nullif(data->>'assignedDoctorId',''),data->>'createdBy')=auth.uid()::text)
$$;

create or replace function dentalcloud_private.profile_media_write(path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); pid uuid;
begin
  if split_part(path,'/',1) is distinct from cid::text or cid is null then return false; end if;
  if dentalcloud_private.owns_clinic(cid) then return true; end if;
  begin pid:=split_part(path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  return dentalcloud_private.profile_patient_owned(pid,cid);
end $$;
revoke all on function dentalcloud_private.profile_media_write(text) from public;
grant execute on function dentalcloud_private.profile_media_write(text) to authenticated;
drop policy if exists profiles_media_insert on storage.objects;
create policy profiles_media_insert on storage.objects as restrictive for insert to authenticated
  with check(bucket_id<>'patient-images' or dentalcloud_private.profile_media_write(name));
drop policy if exists profiles_media_update on storage.objects;
create policy profiles_media_update on storage.objects as restrictive for update to authenticated
  using(bucket_id<>'patient-images' or dentalcloud_private.profile_media_write(name))
  with check(bucket_id<>'patient-images' or dentalcloud_private.profile_media_write(name));
drop policy if exists profiles_media_delete on storage.objects;
create policy profiles_media_delete on storage.objects as restrictive for delete to authenticated
  using(bucket_id<>'patient-images' or dentalcloud_private.profile_media_write(name));

create or replace function public.clinic_profile_can_manage()
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if not dentalcloud_private.owns_clinic(public.current_clinic_id()) or dentalcloud_private.access_level(public.current_clinic_id())<1 then
    raise exception 'Active clinic owner required' using errcode='42501';
  end if;
  return true;
end $$;
revoke all on function public.clinic_profile_can_manage() from public;
grant execute on function public.clinic_profile_can_manage() to authenticated;

create or replace function public.clinic_profile_context()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); c public.clinics; d public.doctors; own boolean; level integer; safe jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if cid is null then return null; end if;
  select * into c from public.clinics where id=cid;
  select * into d from public.doctors where id=auth.uid();
  own:=c.owner_id=auth.uid();
  if own then safe:=c.data;
  else
    level:=dentalcloud_private.access_level(cid);
    safe:=dentalcloud_private.profile_pick(c.data,array['name','nameAr','prices','customInstructions','customSheets','tier']);
    safe:=safe || jsonb_build_object('settings',dentalcloud_private.profile_pick(coalesce(c.data->'settings','{}'),array['currency','logo']),
      'paid',level>=0,'subscriptionProvider','profile','paidThrough',case when level>=0 then to_jsonb(now()+interval '2 minutes') else to_jsonb(now()-interval '1 minute') end,
      'trialUsedAt','2000-01-01T00:00:00Z');
  end if;
  return jsonb_build_object('user',(d.data-'passwordHash') || jsonb_build_object('id',d.id,'clinicId',cid,'isOwner',own,'isClinicOwner',own,'staffProfile',not own),
    'clinic',safe || jsonb_build_object('id',cid));
end $$;

create or replace function public.clinic_profile_rows(p_table text, p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); r record; out_rows jsonb:='[]'; item jsonb; own boolean; pid uuid;
begin
  if auth.uid() is null or cid is null then raise exception 'Profile unavailable' using errcode='42501'; end if;
  if p_table not in ('doctors','patients','tooth_records','appointments','payments','lab_orders') then raise exception 'Not allowed' using errcode='42501'; end if;
  for r in execute format('select id,data from public.%I where clinic_id=$1 and ($2 is null or id>$2) order by id limit 500',p_table) using cid,p_after loop
    if p_table='doctors' then
      item:=dentalcloud_private.profile_pick(r.data,array['name','nameAr','specialty','color','role']);
    elsif p_table='appointments' then
      item:=dentalcloud_private.profile_pick(r.data,array['patientId','doctorId','start','end','reason','step','status','notes','loyaltyCategory','loyaltyExcluded']);
    else
      if p_table='patients' then pid:=r.id; else pid:=nullif(r.data->>'patientId','')::uuid; end if;
      own:=dentalcloud_private.profile_patient_owned(pid,cid) or dentalcloud_private.owns_clinic(cid);
      if own then item:=r.data;
      elsif p_table in ('payments','lab_orders') then item:=jsonb_build_object('_restricted',true);
      elsif p_table='patients' then
        item:=dentalcloud_private.profile_medical(dentalcloud_private.profile_pick(r.data,array['fileNo','name','nameAr','phone','gender','dob','age','occupation','address','complaint','history','exam','orthodontics','perio','plaque','photos','consent','createdBy','createdAt','assignedDoctorId']));
      else
        item:=dentalcloud_private.profile_pick(r.data,array['patientId','doctorId','date','status','surfaces','toothId','dentition','type','treatment','treatmentKey','itemKey','name','nameAr','notes','kind','label','cariesClass']);
      end if;
      if p_table='patients' then item:=item || jsonb_build_object('canViewFinance',own); end if;
    end if;
    -- Restricted placeholders preserve pagination without disclosing record IDs.
    if item ? '_restricted' then out_rows:=out_rows || jsonb_build_array(jsonb_build_object('_restricted',true));
    else out_rows:=out_rows || jsonb_build_array(item || jsonb_build_object('id',r.id,'clinicId',cid)); end if;
  end loop;
  return jsonb_build_object('rows',out_rows,'next',case when jsonb_array_length(out_rows)=500 then r.id else null end);
end $$;

create or replace function public.clinic_profile_save(p_table text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); rid uuid; pid uuid; old_data jsonb; incoming jsonb; saved jsonb; keys text[]; existing_cid uuid;
begin
  if cid is null or auth.uid() is null or dentalcloud_private.access_level(cid)<1 then raise exception 'Active clinic profile required' using errcode='42501'; end if;
  if p_table not in ('patients','tooth_records','appointments','payments') or jsonb_typeof(p_data)<>'object' then raise exception 'Not allowed' using errcode='42501'; end if;
  rid:=(p_data->>'id')::uuid;
  if rid is null then raise exception 'Record ID required'; end if;
  -- Serialize same-record writes, including simultaneous INSERT attempts.
  perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
  execute format('select clinic_id,data from public.%I where id=$1 for update',p_table) into existing_cid,old_data using rid;
  if existing_cid is not null and existing_cid<>cid then raise exception 'Not allowed' using errcode='42501'; end if;
  if p_table='patients' then pid:=rid; else pid:=coalesce(old_data->>'patientId',p_data->>'patientId')::uuid; end if;
  if p_table<>'patients' and not exists(select 1 from public.patients where id=pid and clinic_id=cid) then raise exception 'Unknown patient' using errcode='42501'; end if;
  -- Lock assignment while authorizing and writing, so reassignment cannot race a financial write.
  perform 1 from public.patients where id=pid and clinic_id=cid for update;
  if p_table<>'appointments' and not (p_table='patients' and old_data is null)
    and not dentalcloud_private.profile_patient_owned(pid,cid) then raise exception 'Patient belongs to another profile' using errcode='42501'; end if;
  if old_data is not null and p_table<>'patients' and p_data->>'patientId' is distinct from old_data->>'patientId' then raise exception 'Cannot move records between patients' using errcode='42501'; end if;
  if p_table='patients' then
    keys:=array['fileNo','name','nameAr','phone','gender','dob','age','occupation','address','complaint','history','exam','orthodontics','perio','plaque','photos','consent'];
  elsif p_table='appointments' then
    keys:=array['patientId','doctorId','start','end','reason','step','status','notes','loyaltyCategory','loyaltyExcluded'];
    if not exists(select 1 from public.doctors where id=(p_data->>'doctorId')::uuid and clinic_id=cid) then raise exception 'Unknown doctor'; end if;
    if dentalcloud_private.safe_time(p_data->>'end')<=dentalcloud_private.safe_time(p_data->>'start') or dentalcloud_private.safe_time(p_data->>'start') is null or dentalcloud_private.safe_time(p_data->>'end') is null then raise exception 'Invalid appointment'; end if;
  elsif p_table='tooth_records' then
    keys:=array['patientId','date','status','surfaces','toothId','dentition','type','treatment','treatmentKey','itemKey','name','nameAr','notes','price','kind','label','cariesClass'];
    if coalesce((p_data->>'price')::numeric,0)<0 then raise exception 'Invalid price'; end if;
  else
    keys:=array['patientId','date','note','methods','amount','currency','method'];
    if coalesce((p_data->>'amount')::numeric,0)<0 then raise exception 'Invalid amount'; end if;
  end if;
  incoming:=dentalcloud_private.profile_pick(p_data,keys);
  saved:=coalesce(old_data,'{}') || incoming || jsonb_build_object('id',rid,'clinicId',cid,'updatedBy',auth.uid(),'updatedAt',now());
  if old_data is null then saved:=saved || jsonb_build_object('createdBy',auth.uid(),'createdAt',now()); end if;
  if p_table='patients' and old_data is null then saved:=saved || jsonb_build_object('assignedDoctorId',auth.uid()); end if;
  if p_table in ('payments','tooth_records') then saved:=saved || jsonb_build_object('doctorId',coalesce(old_data->>'doctorId',auth.uid()::text)); end if;
  execute format('insert into public.%I(id,clinic_id,data) values($1,$2,$3) on conflict(id) do update set data=excluded.data',p_table) using rid,cid,saved;
  if p_table='patients' then saved:=saved || '{"canViewFinance":true}'; end if;
  return saved;
end $$;

-- Only the owner assigns responsibility. Staff cannot claim a patient's finances.
create or replace function public.clinic_profile_assign(p_patient uuid,p_doctor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id();
begin
  if not dentalcloud_private.owns_clinic(cid) or dentalcloud_private.access_level(cid)<1 then raise exception 'Owner required' using errcode='42501'; end if;
  if not exists(select 1 from public.doctors where id=p_doctor and clinic_id=cid) then raise exception 'Unknown doctor'; end if;
  update public.patients set data=data || jsonb_build_object('assignedDoctorId',p_doctor,'updatedBy',auth.uid(),'updatedAt',now()) where id=p_patient and clinic_id=cid;
  if not found then raise exception 'Unknown patient'; end if;
end $$;

revoke all on function dentalcloud_private.profile_pick(jsonb,text[]),dentalcloud_private.profile_medical(jsonb),dentalcloud_private.profile_patient_owned(uuid,uuid) from public;
revoke all on function public.clinic_profile_context(), public.clinic_profile_rows(text,uuid),public.clinic_profile_save(text,jsonb),public.clinic_profile_assign(uuid,uuid) from public;
grant execute on function public.clinic_profile_context(), public.clinic_profile_rows(text,uuid),public.clinic_profile_save(text,jsonb),public.clinic_profile_assign(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
