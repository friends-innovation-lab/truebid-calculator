'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, SupabaseClient } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  useEffect(() => {
    // Initialize Supabase client only on client-side
    const supabase = createClient()
    supabaseRef.current = supabase

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Function to manually refresh user data (e.g., after updating user metadata)
  const refreshUser = async () => {
    if (!supabaseRef.current) return
    const { data: { user: refreshedUser } } = await supabaseRef.current.auth.getUser()
    if (refreshedUser) {
      setUser(refreshedUser)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
