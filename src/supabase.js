import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://reycvzqoeerdiykruqkk.supabase.co'
const supabaseAnonKey = 'sb_publishable_QWrNA4NJlTbNd2UZREsjng_0Z9HeKpQ'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// The anon/publishable key is safe for frontend use when RLS is enabled.
// Never put a service_role or secret key in this browser client.
export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'missing-public-anon-key')

const missingConfigError = () => new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the app build environment.')

// Email Sign Up
export async function signUpWithEmail(email, password) {
  if (!isSupabaseConfigured) return { data: null, error: missingConfigError() }
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
}

// Email Sign In
export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured) return { data: null, error: missingConfigError() }
  return supabase.auth.signInWithPassword({ email, password })
}

// Sign Out
export async function signOut() {
  if (!isSupabaseConfigured) return { error: missingConfigError() }
  return supabase.auth.signOut()
}
