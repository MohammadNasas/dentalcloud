# PayPal subscription webhook

The free-trial protection uses signed PayPal webhooks to stop a duplicate
subscription as soon as it becomes active. The same PayPal payer ID, PayPal
billing email, or saved payment-source vault ID can claim the free month only
once, even when a different DentalCloud email is used. The authenticated status
sync repeats this check for older subscriptions and revokes a duplicate trial
when that account next opens.

Before deploying the functions, run `supabase/trial_protection.sql` once in the
Supabase SQL Editor. The unique server-only ledger is what makes the check
atomic; deploying the JavaScript without this migration is not sufficient.

1. In PayPal Developer Dashboard, open your REST app and add a webhook URL:
   `https://YOUR-DOMAIN/api/paypal-webhook`
2. Subscribe to these events:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `PAYMENT.SALE.COMPLETED`
   - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.REVERSED`
3. Copy the webhook ID into the deployment environment as
   `PAYPAL_WEBHOOK_ID`.

`PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_ROLE_KEY` must also be configured as server-side variables.
Never put `PAYPAL_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` variables.

For repeat customers whose PayPal/card identity already used the free month,
DentalCloud offers a separate Pro subscription that charges `$50 USD`
immediately and has no trial cycle. You may set these reusable plan IDs:

- `PAYPAL_PRO_TRIAL_PLAN_ID`: one free month, then $50/year.
- `PAYPAL_PRO_PAID_PLAN_ID`: $50 immediately, then $50/year.

If either plan ID is omitted, the server creates the appropriate PayPal plan
at checkout. Setting both IDs is recommended in production to avoid creating
duplicate catalog plans.
