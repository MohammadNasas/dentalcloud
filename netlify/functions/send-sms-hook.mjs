// Netlify Function: Supabase Auth Send SMS Hook.
// Route through netlify.toml: POST /api/send-sms-hook
//
// Required encrypted environment variables:
//   TEXTBELT_API_KEY
//   SUPABASE_AUTH_HOOK_SECRET
import { handleTextbeltSmsHook } from '../../server/textbeltSmsHook.js'

export default async (request) =>
  handleTextbeltSmsHook(request, {
    TEXTBELT_API_KEY: process.env.TEXTBELT_API_KEY,
    SUPABASE_AUTH_HOOK_SECRET: process.env.SUPABASE_AUTH_HOOK_SECRET,
  })
