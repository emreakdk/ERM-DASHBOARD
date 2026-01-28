import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { updateDebugState } from '../lib/debug'
import { withTimeout } from '../lib/with-timeout'

export type TenantRole = 'superadmin' | 'admin' | 'user'

interface TenantState {
  companyId: string | null
  companyName: string | null
  role: TenantRole | null
  userRole: TenantRole | null
  loading: boolean
  refreshTenant: () => Promise<void>
}

const TenantContext = createContext<TenantState | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [role, setRole] = useState<TenantRole | null>(null)
  const [loading, setLoading] = useState(true)

  const resetTenantState = useCallback(() => {
    setCompanyId(null)
    setCompanyName(null)
    setRole(null)
  }, [])

  const fetchTenant = useCallback(
    async (userId: string) => {
      type ProfileRow = {
        company_id?: string | null
        role?: TenantRole | null
        company?: { name?: string | null } | null
      }

      setLoading(true)
      try {
        const { data: profile, error: profileError } = await withTimeout<{
          data: ProfileRow | null
          error: PostgrestError | null
        }>(
          async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('company_id, role, company:companies(name)')
              .eq('id', userId)
              .maybeSingle<ProfileRow>()
            return { data, error }
          },
          8000,
          'Profile fetch timeout'
        )

        if (profileError || !profile) {
          resetTenantState()
          return
        }

        const cid = profile.company_id ?? null
        let resolvedCompanyName = profile.company?.name ?? null

        if (cid && !resolvedCompanyName) {
          const { data: companyRow } = await supabase
            .from('companies')
            .select('name')
            .eq('id', cid)
            .maybeSingle<{ name: string | null }>()
          resolvedCompanyName = companyRow?.name ?? null
        }

        const resolvedRole = (profile.role as TenantRole | null) ?? 'user'

        setCompanyId(cid)
        setCompanyName(resolvedCompanyName)
        setRole(resolvedRole)
      } catch (error) {
        resetTenantState()
      } finally {
        setLoading(false)
      }
    },
    [resetTenantState]
  )

  useEffect(() => {
    if (user?.id) {
      void fetchTenant(user.id)
    } else {
      resetTenantState()
      setLoading(false)
    }
  }, [user?.id, fetchTenant, resetTenantState])

  const refreshTenant = useCallback(async () => {
    if (user?.id) {
      await fetchTenant(user.id)
    } else {
      resetTenantState()
      setLoading(false)
    }
  }, [fetchTenant, resetTenantState, user?.id])

  const value = useMemo(
    () => ({
      companyId,
      companyName,
      role,
      userRole: role,
      loading,
      refreshTenant,
    }),
    [
      companyId,
      companyName,
      role,
      loading,
      refreshTenant,
    ]
  )

  useEffect(() => {
    updateDebugState({
      tenantLoading: loading,
      tenantRole: role,
      tenantCompanyId: companyId,
      tenantSelectedCompanyId: null,
    })
  }, [companyId, loading, role])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant hook TenantProvider içinde kullanılmalı')
  }
  return ctx
}
