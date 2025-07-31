import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client for frontend operations (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations (bypasses RLS)
// Only available on server-side where service role key exists
export const supabaseAdmin = (() => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceKey) {
    // Return null if service key is not available (client-side)
    return null
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
})()

// Database types
export interface User {
  id: string
  email: string
  credits: number
  subscription_type: 'monthly' | 'yearly' | null
  subscription_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  transaction_type: 'purchase' | 'usage' | 'refund'
  description: string
  created_at: string
}
