# Usage analytics

Run `supabase/analytics.sql` once in Supabase SQL Editor, then deploy the app.
After that, every logged-in cloud user records a lightweight heartbeat on open
and every few minutes while the app is visible.

No patient data is stored. The analytics row stores only:

- clinic id
- user id
- local day
- platform: `web`, `desktop`, or `pwa`
- first/last seen timestamps
- ping count
- basic metadata such as tier, clinic name, timezone, and path

## Daily active users

```sql
select
  day,
  count(distinct user_id) as active_users,
  count(distinct clinic_id) as active_clinics
from public.daily_active_users
group by day
order by day desc;
```

## Daily active by platform

```sql
select
  day,
  platform,
  count(distinct user_id) as active_users,
  count(distinct clinic_id) as active_clinics
from public.daily_active_users
group by day, platform
order by day desc, platform;
```

## Today: website vs desktop

```sql
select
  platform,
  count(distinct user_id) as active_users,
  count(distinct clinic_id) as active_clinics
from public.daily_active_users
where day = current_date
group by platform
order by platform;
```

## Last seen per clinic

```sql
select
  c.id as clinic_id,
  c.data->>'name' as clinic_name,
  c.data->>'tier' as plan,
  max(a.last_seen_at) as last_seen_at,
  string_agg(distinct a.platform, ', ' order by a.platform) as platforms
from public.clinics c
left join public.daily_active_users a on a.clinic_id = c.id
group by c.id, c.data
order by last_seen_at desc nulls last;
```

## Active users in the last 7 days

```sql
select
  count(distinct user_id) as active_users_7d,
  count(distinct clinic_id) as active_clinics_7d
from public.daily_active_users
where day >= current_date - interval '6 days';
```

## Full activity log

```sql
select
  a.day,
  a.platform,
  a.first_seen_at,
  a.last_seen_at,
  a.ping_count,
  c.data->>'name' as clinic_name,
  d.data->>'email' as email,
  d.data->>'name' as doctor_name
from public.daily_active_users a
left join public.clinics c on c.id = a.clinic_id
left join public.doctors d on d.id = a.user_id
order by a.day desc, a.last_seen_at desc;
```
