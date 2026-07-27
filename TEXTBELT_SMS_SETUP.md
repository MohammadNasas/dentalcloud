# Textbelt phone verification setup

DentalCloud uses Supabase Auth to generate and verify phone OTP codes. The
`/api/send-sms-hook` server function only delivers Supabase's code through
Textbelt, so the Textbelt API key never reaches the browser.

## 1. Deploy the function

The repository contains both deployment variants:

- Cloudflare Pages: `functions/api/send-sms-hook.js`
- Netlify: `netlify/functions/send-sms-hook.mjs`

The production Cloudflare URL is:

`https://dentalcloud.pages.dev/api/send-sms-hook`

## 2. Add encrypted environment variables

Add these two server-only variables to the production host:

- `TEXTBELT_API_KEY`: the purchased Textbelt key.
- `SUPABASE_AUTH_HOOK_SECRET`: the signing secret configured for the Supabase
  Auth hook. Supabase/Standard Webhooks secrets look like
  `v1,whsec_<base64-value>`.

Never prefix either variable with `VITE_`; doing that would expose it to the
browser bundle.

## 3. Configure Supabase Auth

In the Supabase dashboard:

1. Open **Authentication > Hooks**.
2. Add or enable **Send SMS** as an **HTTP Hook**.
3. Use `https://dentalcloud.pages.dev/api/send-sms-hook` as the hook URL.
4. Configure the same signing secret as `SUPABASE_AUTH_HOOK_SECRET`.
5. Open **Authentication > Providers > Phone** and enable Phone authentication.
6. Keep automatic phone confirmation disabled so users must enter the OTP.

The existing React registration screen already calls `supabase.auth.signUp()`
with the phone and verifies the entered code through
`supabase.auth.verifyOtp()`. No Textbelt secret belongs in frontend code.

## 4. Test

Create a clinic account with a phone in E.164 format, for example
`+970591234567`. A successful send consumes one Textbelt SMS credit. The
message is short GSM text to keep it to one SMS segment.

Run the local hook tests with `npm run test:sms`.

If sending fails, check:

- Cloudflare/Netlify function logs for `Textbelt SMS send failed`.
- Textbelt quota for the purchased API key.
- Supabase Auth logs for hook timeout or signature errors.
