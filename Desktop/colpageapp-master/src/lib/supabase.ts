import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side Supabase client (for browser usage with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin Supabase client (for server-side usage, bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

// User type definition
export interface User {
  id: string
  email: string
  credits: number
  subscription_type?: 'monthly' | 'yearly' | null
  subscription_tier?: 'basic' | 'standard' | 'premium' | null
  subscription_expires_at?: string | null
  created_at?: string
  updated_at?: string
}

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at'>>
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          transaction_type: 'purchase' | 'usage' | 'refund'
          description: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['credit_transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Omit<Database['public']['Tables']['credit_transactions']['Row'], 'id' | 'created_at'>>
      }
    }
  }
}
