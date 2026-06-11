import { createClient } from '@supabase/supabase-js'

// Reads config from environment (.env). When both are present the app runs in
// CLOUD mode (shared online accounts, web + desktop). Otherwise it stays in
// LOCAL mode (offline demo on this device only) so it always works.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloud = Boolean(url && anonKey)

// Stores the session in sessionStorage when the user unchecks "Remember me",
// so it expires when the browser tab closes. Falls back to localStorage otherwise.
const rememberStorage = {
  getItem(key) {
    const rem = localStorage.getItem('_rememberMe') !== 'false'
    return rem ? localStorage.getItem(key) : (sessionStorage.getItem(key) ?? localStorage.getItem(key))
  },
  setItem(key, value) {
    if (localStorage.getItem('_rememberMe') === 'false') {
      sessionStorage.setItem(key, value)
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
      sessionStorage.removeItem(key)
    }
  },
  removeItem(key) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = isCloud
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // parse password-recovery tokens from the URL
        flowType: 'implicit', // tokens in the hash — reliable with HashRouter
        storage: rememberStorage,
      },
    })
  : null
