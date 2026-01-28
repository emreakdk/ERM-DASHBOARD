import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User, Session, AuthError, PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { updateDebugState } from '../lib/debug'
import { withTimeout } from '../lib/with-timeout'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  blockMessage: string | null
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [blockMessage, setBlockMessage] = useState<string | null>(null)

  const checkBlockedStatus = useCallback(async (userId: string) => {
    type ProfileRow = {
      is_blocked: boolean | null
      full_name: string | null
      email: string | null
    }

    try {
      const { data, error } = await withTimeout<{ data: ProfileRow | null; error: PostgrestError | null }>(
        async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('is_blocked, full_name, email')
            .eq('id', userId)
            .single<ProfileRow>()
          return { data, error }
        },
        5000,
        'Timeout'
      )

      if (error || !data) {
        return false
      }

      if (data.is_blocked) {
        setBlockMessage('Hesabınız askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.')
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        return true
      }

      return false
    } catch (err) {
      return false
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const isBlocked = await checkBlockedStatus(session.user.id)
        if (!isBlocked) {
          setSession(session)
          setUser(session.user)
        }
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const isBlocked = await checkBlockedStatus(session.user.id)
        if (!isBlocked) {
          setSession(session)
          setUser(session.user)
        }
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    updateDebugState({
      authLoading: loading,
      authUserId: user?.id ?? null,
      hasSession: Boolean(session),
      blockMessage,
    })
  }, [blockMessage, loading, session, user?.id])

  const signIn = async (email: string, password: string) => {
    setBlockMessage(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (!error && data.user) {
      const isBlocked = await checkBlockedStatus(data.user.id)
      if (isBlocked) {
        return { error: { message: 'Hesabınız askıya alınmıştır', name: 'BlockedAccountError', status: 403 } as AuthError }
      }
    }
    
    return { error }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { error }
  }

  const signOut = async () => {
    setBlockMessage(null)
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    blockMessage,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth hook AuthProvider içinde kullanılmalı')
  }
  return context
}
