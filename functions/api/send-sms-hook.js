// Cloudflare Pages Function: Supabase Auth Send SMS Hook.
// Route: POST /api/send-sms-hook
//
// Required encrypted environment variables:
//   TEXTBELT_API_KEY
//   SUPABASE_AUTH_HOOK_SECRET
import { handleTextbeltSmsHook } from '../../server/textbeltSmsHook.js'

export const onRequestPost = ({ request, env }) => handleTextbeltSmsHook(request, env)
