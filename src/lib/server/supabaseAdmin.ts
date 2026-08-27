import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { isDemoMode } from './demo/config'
import { createDemoSupabaseClient } from './demo/fakeSupabase'

let cachedClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient

  // Demo mode short-circuits before the credential check: the whole point is to
  // run with no database behind the app.
  if (isDemoMode()) {
    cachedClient = createDemoSupabaseClient()
    return cachedClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset.')
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cachedClient
}
