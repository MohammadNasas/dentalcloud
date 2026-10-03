# DentalCloud authentication emails

Supabase project: txgnlxdpjhcncwrccnvm. Website deployments publish only image assets, not these email settings. Paste each template into Authentication > Emails with its subject from subjects.json.

- confirmation.html retains {{ .Token }} for signup OTP.
- recovery.html retains {{ .ConfirmationURL }} for password recovery.
- public/email contains compact PNG versions of the existing logo and Lucide icons; regenerate with node scripts/build-email-assets.mjs. Deploy these before saving templates.

Design matches the approved preview's 380px card, typography sizes, spacing, dividers, colors and icons. Cairo/Inter are progressive enhancements: clients that block web fonts fall back to Tahoma/Arial; clients that block remote images may hide the logo/icons. Message text and actions remain functional.

2026-10-03 correction: the first deployed version changed proportions and used Unicode icon substitutes, and the user reported the logo missing in a received email. Corrected using the original layout measurements and explicit PNG assets. Actual inbox rendering must be checked with a newly received message; browser rendering alone does not prove email-client parity.
