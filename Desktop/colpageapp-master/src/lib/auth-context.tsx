'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface CustomUser extends SupabaseUser {
  credits: number
  subscription_tier?: 'basic' | 'standard' | 'premium' | null
}

interface AuthContextType {
  user: CustomUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  refreshCredits: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Extend user with credits and subscription_tier (mock for now)
        const customUser: CustomUser = {
          ...session.user,
          credits: 0, // Default credits
          subscription_tier: null // Default tier
        }
        setUser(customUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Extend user with credits and subscription_tier (mock for now)
          const customUser: CustomUser = {
            ...session.user,
            credits: 0, // Default credits
            subscription_tier: null // Default tier
          }
          setUser(customUser)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const refreshCredits = () => {
    // Placeholder implementation - in a real app this would refresh user data
    console.log('Refreshing credits...')
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshCredits,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
