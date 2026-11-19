-- Run after loyalty_push.sql and private VAPID configuration, once the API is deployed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function dentalcloud_private.dispatch_loyalty_push()
returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 select dispatch_secret into secret from dentalcloud_private.push_config where id and enabled;
 if secret is null then return; end if;
 perform net.http_post(url:='https://dentalcloudapp.com/api/loyalty-push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function dentalcloud_private.dispatch_loyalty_push() from public,anon,authenticated;
select cron.schedule('dentalcloud-loyalty-push','*/5 * * * *','select dentalcloud_private.dispatch_loyalty_push()');
