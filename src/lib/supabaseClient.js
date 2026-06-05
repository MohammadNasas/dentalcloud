import { createClient } from '@supabase/supabase-js'

// Reads config from environment (.env). When both are present the app runs in
// CLOUD mode (shared online accounts, web + desktop). Otherwise it stays in
// LOCAL mode (offline demo on this device only) so it always works.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloud = Boolean(url && anonKey)

export const supabase = isCloud
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // parse password-recovery tokens from the URL
        flowType: 'implicit', // tokens in the hash — reliable with HashRouter
      },
    })
  : null
