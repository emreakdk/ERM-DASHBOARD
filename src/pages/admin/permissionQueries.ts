import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import type { ModuleKey } from '../../constants/permissions'

export type RolePermissionRow = Database['public']['Tables']['role_permissions']['Row']

export type PermissionMatrix = {
  [key in ModuleKey]?: {
    admin: { view: boolean; edit: boolean }
    user: { view: boolean; edit: boolean }
  }
}

function isRolePermissionRow(value: unknown): value is RolePermissionRow {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RolePermissionRow>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.company_id === 'string' &&
    (candidate.role_name === 'admin' || candidate.role_name === 'user') &&
    typeof candidate.module_key === 'string' &&
    typeof candidate.can_view === 'boolean' &&
    typeof candidate.can_edit === 'boolean' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  )
}

export async function fetchCompanyPermissions(companyId: string): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase.rpc('get_company_permissions', {
    p_company_id: companyId,
  })

  if (error) {
    throw error
  }

  if (!data) return []
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response shape from get_company_permissions')
  }

  return data.filter(isRolePermissionRow)
}

export async function updateCompanyPermissions(
  companyId: string,
  permissions: Array<{
    role_name: 'admin' | 'user'
    module_key: string
    can_view: boolean
    can_edit: boolean
  }>
): Promise<void> {
  const { error } = await supabase.rpc('update_company_permissions', {
    p_company_id: companyId,
    p_permissions: permissions,
  })

  if (error) {
    throw error
  }
}

export async function checkUserPermission(
  userId: string,
  moduleKey: string,
  permissionType: 'view' | 'edit'
): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_permission', {
    p_user_id: userId,
    p_module_key: moduleKey,
    p_permission_type: permissionType,
  })

  if (error) {
    return false
  }

  return typeof data === 'boolean' ? data : false
}

export function buildPermissionMatrix(permissions: RolePermissionRow[]): PermissionMatrix {
  const matrix: PermissionMatrix = {}

  permissions.forEach((perm) => {
    const moduleKey = perm.module_key as ModuleKey
    if (!matrix[moduleKey]) {
      matrix[moduleKey] = {
        admin: { view: true, edit: true },
        user: { view: true, edit: false },
      }
    }

    if (perm.role_name === 'admin') {
      matrix[moduleKey]!.admin = {
        view: perm.can_view,
        edit: perm.can_edit,
      }
    } else if (perm.role_name === 'user') {
      matrix[moduleKey]!.user = {
        view: perm.can_view,
        edit: perm.can_edit,
      }
    }
  })

  return matrix
}
