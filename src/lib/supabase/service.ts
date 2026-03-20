import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service role key.
 * This bypasses RLS entirely — use only for server-side operations
 * that genuinely need elevated privileges (e.g., inserting audit logs,
 * managing completed trades, system-level operations).
 *
 * Returns null if the service role key is not configured.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key_here') {
    return null
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
