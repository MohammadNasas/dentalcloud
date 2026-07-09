# Payment follow-up email

This sends a one-time professional email to clinics that selected the
`economy` plan (`$70/year`) but still have `paid !== true` in Supabase.

The endpoint is protected and defaults to preview mode. It only sends emails
when the request includes `send: true`.

## Required environment variables

Add these to Cloudflare Pages or Netlify environment variables:

```txt
CAMPAIGN_ADMIN_SECRET=choose-a-long-random-secret
RESEND_API_KEY=re_xxxxxxxxx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Optional:

```txt
RESEND_FROM=DentalCloud <dentalcloudd@gmail.com>
SUPPORT_EMAIL=dentalcloudd@gmail.com
SUPPORT_WHATSAPP=+972599510078
SITE_URL=https://your-site.com
```

## Preview recipients

```bash
curl -X POST "https://your-site.com/api/payment-followup" \
  -H "Authorization: Bearer YOUR_CAMPAIGN_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"send\":false,\"limit\":50}"
```

## Send emails

```bash
curl -X POST "https://your-site.com/api/payment-followup" \
  -H "Authorization: Bearer YOUR_CAMPAIGN_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"send\":true,\"limit\":50}"
```

After a successful send, the function writes `paymentFollowupSentAt` into the
clinic's `data` JSON so the same clinic is skipped next time.

To resend intentionally:

```bash
curl -X POST "https://your-site.com/api/payment-followup" \
  -H "Authorization: Bearer YOUR_CAMPAIGN_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"send\":true,\"force\":true,\"limit\":50}"
```
