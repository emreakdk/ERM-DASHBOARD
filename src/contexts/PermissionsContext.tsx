import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTenant } from './TenantContext'
import type { ModuleKey, RolePermissionMap, TenantRoleLike } from '../constants/permissions'
import { createDefaultPermissions, mapRolePermissionsForUser } from '../constants/permissions'
import type { Database } from '../types/database'

interface PermissionsContextValue {
  loading: boolean
  permissions: RolePermissionMap
  canViewModule: (module: ModuleKey) => boolean
  canEditModule: (module: ModuleKey) => boolean
  refreshPermissions: () => Promise<void>
}

type RolePermissionRow = Database['public']['Tables']['role_permissions']['Row']

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { role, companyId, loading: tenantLoading } = useTenant()
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<RolePermissionMap>(() => createDefaultPermissions(null))

  const fetchPermissions = useCallback(async () => {
    const tenantRole = (role as TenantRoleLike) ?? null

    if (tenantLoading) {
      return
    }

    setLoading(true)
    try {
      if (!tenantRole) {
        setPermissions(createDefaultPermissions(null))
        return
      }

      if (tenantRole === 'superadmin') {
        setPermissions(createDefaultPermissions('superadmin'))
        return
      }

      if (!companyId) {
        setPermissions(createDefaultPermissions(tenantRole))
        return
      }

      let rows: RolePermissionRow[] = []

      if (tenantRole === 'admin' || tenantRole === 'user') {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('role_name, module_key, can_view, can_edit')
          .eq('company_id', companyId)
          .eq('role_name', tenantRole)

        if (error) {
          setPermissions(createDefaultPermissions(tenantRole))
          return
        }

        rows = (data as RolePermissionRow[]) ?? []
      }

      setPermissions(mapRolePermissionsForUser(rows, tenantRole))
    } catch (error) {
      setPermissions(createDefaultPermissions(role as TenantRoleLike))
    } finally {
      setLoading(false)
    }
  }, [companyId, role, tenantLoading])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const contextValue = useMemo<PermissionsContextValue>(
    () => ({
      loading,
      permissions,
      canViewModule: (module: ModuleKey) => !!permissions[module]?.view,
      canEditModule: (module: ModuleKey) => !!permissions[module]?.edit,
      refreshPermissions: fetchPermissions,
    }),
    [fetchPermissions, loading, permissions]
  )

  return <PermissionsContext.Provider value={contextValue}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) {
    throw new Error('usePermissions hook must be used within PermissionsProvider')
  }
  return ctx
}
