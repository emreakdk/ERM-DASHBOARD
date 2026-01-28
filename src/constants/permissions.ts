import type { Database } from '../types/database'

export type ModuleKey =
  | 'dashboard'
  | 'finance'
  | 'customers'
  | 'invoices'
  | 'quotes'
  | 'products'
  | 'deals'
  | 'activities'
  | 'accounts'
  | 'settings'

export const MODULE_KEYS: ModuleKey[] = [
  'dashboard',
  'finance',
  'customers',
  'invoices',
  'quotes',
  'products',
  'deals',
  'activities',
  'accounts',
  'settings',
]

export const MODULE_ROUTE_MAP: Partial<Record<ModuleKey, string>> = {
  dashboard: '/',
  finance: '/finans',
  customers: '/musteriler',
  invoices: '/faturalar',
  quotes: '/teklifler',
  products: '/urun-hizmet',
  deals: '/firsatlar',
  activities: '/aktiviteler',
  accounts: '/kasa-banka',
  settings: '/ayarlar',
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  finance: 'Finans',
  customers: 'Müşteriler',
  invoices: 'Faturalar',
  quotes: 'Teklifler',
  products: 'Ürün/Hizmet',
  deals: 'Fırsatlar',
  activities: 'Aktiviteler',
  accounts: 'Kasa/Banka',
  settings: 'Ayarlar',
}

export type RolePermissionMap = Record<ModuleKey, { view: boolean; edit: boolean }>

export type TenantRoleLike = 'superadmin' | 'admin' | 'user' | null
type RolePermissionRow = Database['public']['Tables']['role_permissions']['Row']

export function createDefaultPermissions(role: TenantRoleLike): RolePermissionMap {
  const base = role === 'user' ? { view: true, edit: false } : { view: true, edit: true }

  if (role === 'superadmin') {
    return MODULE_KEYS.reduce<RolePermissionMap>((acc, key) => {
      acc[key] = { view: true, edit: true }
      return acc
    }, {} as RolePermissionMap)
  }

  return MODULE_KEYS.reduce<RolePermissionMap>((acc, key) => {
    acc[key] = { ...base }
    return acc
  }, {} as RolePermissionMap)
}

export const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {
  '/': 'dashboard',
  '/finans': 'finance',
  '/musteriler': 'customers',
  '/faturalar': 'invoices',
  '/invoices/new': 'invoices',
  '/teklifler': 'quotes',
  '/urun-hizmet': 'products',
  '/firsatlar': 'deals',
  '/aktiviteler': 'activities',
  '/kasa-banka': 'accounts',
  '/ayarlar': 'settings',
}

export function mapRolePermissionsForUser(
  rows: RolePermissionRow[] | null,
  role: TenantRoleLike
): RolePermissionMap {
  const map = createDefaultPermissions(role)

  if (!rows || !role || role === 'superadmin') {
    return map
  }

  rows.forEach((row) => {
    if (row.role_name !== role) return
    const moduleKey = row.module_key as ModuleKey
    if (!MODULE_KEYS.includes(moduleKey)) return

    map[moduleKey] = {
      view: row.can_view,
      edit: row.can_view ? row.can_edit : false,
    }
  })

  return map
}
