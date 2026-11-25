-- Apply after clinic_profile_lab_access.sql. Doctors can work on every clinic patient.
-- Assistants retain assigned-patient finance. Clinic administration stays owner-only.
begin;
create or replace function dentalcloud_private.profile_patient_access(p uuid, cid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.patients pat where pat.id=p and pat.clinic_id=cid
    and cid=public.current_clinic_id() and (
      dentalcloud_private.owns_clinic(cid)
      or exists(select 1 from public.doctors d join public.clinic_profiles cp on cp.user_id=d.id and cp.clinic_id=d.clinic_id
        where d.id=auth.uid() and d.clinic_id=cid and cp.active and d.data->>'role'='doctor')
      or dentalcloud_private.profile_patient_owned(p,cid)))
$$;
revoke all on function dentalcloud_private.profile_patient_access(uuid,uuid) from public;
create or replace function dentalcloud_private.profile_media_write(path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); pid uuid;
begin
  if split_part(path,'/',1) is distinct from cid::text or cid is null then return false; end if;
  if dentalcloud_private.owns_clinic(cid) then return true; end if;
  begin pid:=split_part(path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  return dentalcloud_private.profile_patient_access(pid,cid);
end $$;

create or replace function public.clinic_profile_rows(p_table text, p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cid uuid:=public.current_clinic_id(); r record; out_rows jsonb:='[]'; item jsonb; own boolean; pid uuid;
begin
  if auth.uid() is null or cid is null then raise exception 'Profile unavailable' using errcode='42501'; end if;
  if p_table not in ('doctors','patients','tooth_records','appointments','payments','lab_orders') then raise exception 'Not allowed' using errcode='42501'; end if;
  for r in execute format('select id,data from public.%I where clinic_id=$1 and ($2 is null or id>$2) order by id limit 500',p_table) using cid,p_after loop
    if p_table='doctors' then
      item:=dentalcloud_private.profile_pick(r.data,array['name','nameAr','specialty','color','role','profileDeletedAt']);
    elsif p_table='appointments' then
      item:=dentalcloud_private.profile_pick(r.data,array['patientId','doctorId','start','end','reason','step','status','notes','loyaltyCategory','loyaltyExcluded']);
    else
      if p_table='patients' then pid:=r.id; else pid:=nullif(r.data->>'patientId','')::uuid; end if;
      own:=dentalcloud_private.profile_patient_access(pid,cid) or dentalcloud_private.owns_clinic(cid);
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
  if p_table not in ('patients','tooth_records','appointments','payments','lab_orders') or jsonb_typeof(p_data)<>'object' then raise exception 'Not allowed' using errcode='42501'; end if;
  rid:=(p_data->>'id')::uuid;
  if rid is null then raise exception 'Record ID required'; end if;
  -- Serialize same-record writes, including simultaneous INSERT attempts.
  perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
  execute format('select clinic_id,data from public.%I where id=$1 for update',p_table) into existing_cid,old_data using rid;
  if existing_cid is not null and existing_cid<>cid then raise exception 'Not allowed' using errcode='42501'; end if;
  if p_table='patients' then pid:=rid; else pid:=coalesce(old_data->>'patientId',p_data->>'patientId')::uuid; end if;
  if p_table<>'patients' and not exists(select 1 from public.patients where id=pid and clinic_id=cid) then raise exception 'Unknown patient' using errcode='42501'; end if;
  -- Lock the patient while authorizing and writing.
  perform 1 from public.patients where id=pid and clinic_id=cid for update;
  if p_table<>'appointments' and not (p_table='patients' and old_data is null)
    and not dentalcloud_private.profile_patient_access(pid,cid) then raise exception 'Patient belongs to another profile' using errcode='42501'; end if;
  if old_data is not null and p_table<>'patients' and p_data->>'patientId' is distinct from old_data->>'patientId' then raise exception 'Cannot move records between patients' using errcode='42501'; end if;
  if p_table='patients' then
    keys:=array['fileNo','name','nameAr','phone','gender','dob','age','occupation','address','complaint','history','exam','orthodontics','perio','plaque','photos','consent','importedHistory','openingBalance'];
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
