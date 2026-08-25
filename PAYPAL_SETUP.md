# PayPal subscription webhook

The free-trial protection uses signed PayPal webhooks to stop a duplicate
subscription as soon as it becomes active.

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
