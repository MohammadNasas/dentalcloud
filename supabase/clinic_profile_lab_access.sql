-- Existing profile permissions remain unchanged except scoped lab access.
begin;
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
    safe:=safe || jsonb_build_object('labs',coalesce((select jsonb_agg(dentalcloud_private.profile_pick(lab,array['id','name','phone'])) from jsonb_array_elements(case when jsonb_typeof(c.data->'labs')='array' then c.data->'labs' else '[]'::jsonb end) lab),'[]'::jsonb));
    safe:=safe || jsonb_build_object('settings',dentalcloud_private.profile_pick(coalesce(c.data->'settings','{}'),array['currency','logo']),
      'paid',level>=0,'subscriptionProvider','profile','paidThrough',case when level>=0 then to_jsonb(now()+interval '2 minutes') else to_jsonb(now()-interval '1 minute') end,
      'trialUsedAt','2000-01-01T00:00:00Z');
  end if;
  return jsonb_build_object('user',(d.data-'passwordHash') || jsonb_build_object('id',d.id,'clinicId',cid,'isOwner',own,'isClinicOwner',own,'staffProfile',not own),
    'clinic',safe || jsonb_build_object('id',cid));
end $$;

create or replace function public.clinic_profile_save(p_table text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); rid uuid; pid uuid; old_data jsonb; incoming jsonb; saved jsonb; keys text[]; existing_cid uuid;
begin
  if cid is null or auth.uid() is null or dentalcloud_private.access_level(cid)<1 then raise exception 'Active clinic profile required' using errcode='42501'; end if;
  if p_table not in ('patients','tooth_records','appointments','payments','lab_orders') or jsonb_typeof(p_data)<>'object' then raise exception 'Not allowed' using errcode='42501'; end if;
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
  elsif p_table='lab_orders' then
    keys:=array['patientId','labId','labName','labPhone','workType','customWorkType','shade','pieces','toothIds','specs','price','paid','dueDate','status'];
    if coalesce((p_data->>'price')::numeric,0)<0 or coalesce((p_data->>'paid')::numeric,0)<0 then raise exception 'Invalid lab amount'; end if;
    if coalesce(p_data->>'status','') not in ('draft','sent','received','completed') then raise exception 'Invalid lab status'; end if;
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
notify pgrst,'reload schema';
commit;
