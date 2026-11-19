# Patient notifications

Patient opt-in is explicit and separate from a doctor's program settings.
The card explains the two types: appointment reminders within the preceding
24 hours (five-minute scheduler resolution), and check-up booking reminders
every 30 days starting from consent. No historical messages are backfilled.
Bookings made or subscriptions enabled inside the 24-hour window are reminded
on the next run. Cancelled, rescheduled and past appointments are rechecked.

Doctors can pause either type in Settings → Loyalty cards. Patients can stop
their card/device subscription from the public card. Rotation of a card token
revokes its device subscriptions. Disabling the program or an expired Pro
subscription suppresses sending. Apple requires an installed Home Screen web
app; the dedicated loyalty manifest restores the last card saved on that device.
Never open a real patient's sharing link or approve notification permissions
as a test without their authorization.

Apply `supabase/loyalty_push.sql`, then generate a prime256v1 VAPID key pair and
a random 32-byte dispatch secret securely. Insert one row into
`dentalcloud_private.push_config` (id=true), keeping enabled=false until the
functions and service worker are deployed. Public/private keys use base64url;
the dispatch secret uses hexadecimal. Do not commit keys or print them in logs.
Apply `supabase/loyalty_push_schedule.sql` and enable that private config row.
Only service-role RPCs can access push subscriptions/configuration; anonymous
visitors reach a validated token-scoped Pages endpoint. Outbound destinations
are restricted to supported browser push services. Payloads use RFC8291
encryption and VAPID authentication. Private keys never reach frontend code.

The cron job queues at most 10 sends per run. Increase throughput deliberately
if usage grows. Jobs deduplicate by subscription and appointment/start time or
review period. Explicit transient responses retry at most three times;
ambiguous network failures/process crashes do not automatically resend.
Permanent 404/410 endpoints are removed. Completed jobs expire after 90 days.
Push-service acceptance is not proof the device displayed a notification.
OS permissions, connectivity and battery settings can delay/prevent delivery.

To pause all sending: set enabled=false in the private config row. No patient
records or card stamps are changed. The demo UI simulates opt-in without
requesting native permission or registering a subscription.
