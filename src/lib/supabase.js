import { createClient } from '@supabase/supabase-js'

// Singleton guard: Vite HMR re-executes modules on edit, creating
// duplicate GoTrueClient instances. Stash the client on globalThis
// so hot reloads reuse the existing instance.
const KEY = '__supabase_client__'

export const supabase = globalThis[KEY] ?? createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
)

globalThis[KEY] = supabase