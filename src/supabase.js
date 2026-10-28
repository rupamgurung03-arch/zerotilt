import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://reycvzqoeerdiykruqkk.supabase.co'
const supabaseAnonKey = 'PASTE_YOUR_COPIED_ANON_KEY_HERE' // Replace with your anon public key

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Sign in with Google
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://zerotilt.rupamgurung03.workers.dev'
    }
  })
  if (error) alert(error.message)
}

// Email Sign Up
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) alert(error.message)
  return { data, error }
}

// Email Sign In
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) alert(error.message)
  return { data, error }
}

// Sign Out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) alert(error.message)
}