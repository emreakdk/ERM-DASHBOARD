import { useState, useEffect, useMemo, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { useTenant } from '../../contexts/TenantContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import type { ModuleKey } from '../../constants/permissions'
import { useTheme } from '../theme-provider'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { LanguageSwitcher } from '../LanguageSwitcher'
import {
  LayoutDashboard,
  Wallet,
  Banknote,
  ShoppingBag,
  Kanban,
  Calendar,
  FileSignature,
  FileText,
  Users,
  Settings,
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
  ChevronDown,
  Crown,
  Building2,
} from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  headerRight?: React.ReactNode
}

type SidebarItem = {
  path?: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  moduleKey?: ModuleKey
}

type SidebarGroup = {
  id: 'finance' | 'other'
  title: string
  defaultOpen: boolean
  items: SidebarItem[]
}

const getSidebarGroups = (t: (key: string) => string): SidebarGroup[] => [
  {
    id: 'finance',
    title: t('nav.financeAccounting'),
    defaultOpen: true,
    items: [
      { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard, moduleKey: 'dashboard' },
      { path: '/kasa-banka', label: t('nav.cashBank'), icon: Wallet, moduleKey: 'accounts' },
      { path: '/finans', label: t('nav.finance'), icon: Banknote, moduleKey: 'finance' },
      { path: '/firsatlar', label: t('nav.deals'), icon: Kanban, moduleKey: 'deals' },
      { path: '/teklifler', label: t('nav.quotes'), icon: FileSignature, moduleKey: 'quotes' },
      { path: '/faturalar', label: t('nav.invoices'), icon: FileText, moduleKey: 'invoices' },
      { path: '/musteriler', label: t('nav.customers'), icon: Users, moduleKey: 'customers' },
      { path: '/urun-hizmet', label: t('nav.products'), icon: ShoppingBag, moduleKey: 'products' },
    ],
  },
  {
    id: 'other',
    title: t('nav.other'),
    defaultOpen: true,
    items: [
      { path: '/aktiviteler', label: t('nav.activities'), icon: Calendar, moduleKey: 'activities' },
      { path: '/ayarlar', label: t('nav.settings'), icon: Settings, moduleKey: 'settings' },
    ],
  },
]

const getDefaultOpenGroups = (): Record<SidebarGroup['id'], boolean> => ({
  finance: true,
  other: true,
})

export function AppLayout({ children, title = 'Dashboard', headerRight }: AppLayoutProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { companyName, role } = useTenant()
  const { permissions, loading: permissionsLoading } = usePermissions()
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed')
      return saved ? (JSON.parse(saved) as boolean) : false
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<SidebarGroup['id'], boolean>>(() => {
    const defaults = getDefaultOpenGroups()

    try {
      const saved = localStorage.getItem('sidebar-open-groups')
      if (!saved) return defaults
      const parsed = JSON.parse(saved) as Partial<Record<SidebarGroup['id'], unknown>>

      return {
        finance: typeof parsed.finance === 'boolean' ? parsed.finance : defaults.finance,
        other: typeof parsed.other === 'boolean' ? parsed.other : defaults.other,
      }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed))
    } catch {
      // ignore
    }
  }, [isCollapsed])

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-open-groups', JSON.stringify(openGroups))
    } catch {
      // ignore
    }
  }, [openGroups])

  const isSuperAdmin = role === 'superadmin'
  const isCompanyAdmin = role === 'admin'

  const sidebarGroups = useMemo(() => getSidebarGroups(t), [t])

  const visibleSidebarGroups = useMemo(() => {
    return sidebarGroups
      .map((group) => {
        let groupItems = [...group.items]

        groupItems = groupItems.filter((item) => {
          if (!permissionsLoading && item.moduleKey) {
            return permissions[item.moduleKey]?.view ?? false
          }

          return true
        })

        if (group.id === 'other' && role === 'superadmin') {
          const hasAdminLink = groupItems.some((item) => item.path === '/admin')
          if (!hasAdminLink) {
            groupItems.push({
              path: '/admin',
              label: t('nav.masterBrain'),
              icon: Crown,
            })
          }
        }

        if (group.id === 'other' && role === 'admin') {
          const hasCompanyAdminLink = groupItems.some((item) => item.path === '/admin/company')
          if (!hasCompanyAdminLink) {
            groupItems.push({
              path: '/admin/company',
              label: t('nav.companyManagement'),
              icon: Building2,
            })
          }
        }

        return {
          ...group,
          items: groupItems,
        }
      })
      .filter((group) => group.items.length > 0)
  }, [permissions, permissionsLoading, role, isSuperAdmin, isCompanyAdmin, sidebarGroups, t])
  const companyDisplayName = companyName ?? 'ERP Panel'
  const companyInitials = useMemo(() => {
    if (!companyName) return 'ERP'
    const parts = companyName.trim().split(/\s+/)
    return parts
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'ERP'
  }, [companyName])
  const roleLabel =
    role === 'superadmin' ? t('roles.superadmin') : role === 'admin' ? t('roles.admin') : role === 'user' ? t('roles.user') : t('roles.noRole')

  const showCompanySwitcher = false
  const renderCompanySelect = useCallback(() => null, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      // Use navigate instead of window.location for smoother transition
      navigate('/login', { replace: true })
    } catch (error) {
      navigate('/login', { replace: true })
    } finally {
      // Reset state after a brief delay
      setTimeout(() => setIsLoggingOut(false), 100)
    }
  }

  const SidebarContent = ({
    collapsed,
    onNavigate,
  }: {
    collapsed: boolean
    onNavigate?: () => void
  }) => {
    const flatItems = visibleSidebarGroups.flatMap((g) => g.items)

    const renderItem = (item: SidebarItem) => {
      const Icon = item.icon

      if (item.disabled) {
        return (
          <div
            key={item.label}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'h-10 justify-center px-2' : 'gap-3 px-3 py-2.5',
              'text-muted-foreground/60 cursor-not-allowed'
            )}
            title={collapsed ? item.label : t('common.comingSoon')}
          >
            <Icon className="h-5 w-5" />
            {!collapsed && item.label}
          </div>
        )
      }

      return (
        <NavLink
          key={item.path}
          to={item.path as string}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'h-10 justify-center px-2' : 'gap-3 px-3 py-2.5',
              isActive
                ? collapsed
                  ? 'bg-primary/15 text-primary'
                  : 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
          title={collapsed ? item.label : undefined}
        >
          <Icon className="h-5 w-5" />
          {!collapsed && item.label}
        </NavLink>
      )
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            'flex h-16 items-center border-b border-border',
            collapsed ? 'justify-center px-2' : 'px-6'
          )}
        >
          {collapsed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {companyInitials}
            </div>
          ) : (
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{companyDisplayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          )}
        </div>

        <nav className={cn('flex-1 min-h-0 overflow-y-auto space-y-1', collapsed ? 'p-2' : 'p-4')}>
          {!collapsed && showCompanySwitcher && (
            <div className="mb-4">{renderCompanySelect()}</div>
          )}
          {collapsed ? (
            flatItems.map(renderItem)
          ) : (
            <div className="space-y-2">
              {visibleSidebarGroups.map((group) => {
                const isOpen = openGroups[group.id]

                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-2 py-2 text-xs font-semibold tracking-wider text-muted-foreground transition-colors',
                        'hover:bg-accent hover:text-accent-foreground'
                      )}
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          isOpen ? 'rotate-180' : 'rotate-0'
                        )}
                      />
                    </button>

                    {isOpen && <div className="space-y-1 pt-1">{group.items.map(renderItem)}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </nav>

        <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.full_name || t('common.user')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          )}

          <div className={cn('flex gap-2', collapsed ? 'flex-col' : 'flex-row')}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn(
                collapsed ? 'h-10 w-10' : 'flex-1 justify-start',
                'text-muted-foreground'
              )}
              onClick={toggleTheme}
              title={t('settings.theme')}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && <span className="ml-2">{t('settings.theme')}</span>}
            </Button>

            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn(
                collapsed ? 'h-10 w-10' : 'flex-1 justify-start',
                'text-muted-foreground'
              )}
              onClick={handleLogout}
              title={t('nav.logout')}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-2">{t('nav.logout')}</span>}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoggingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('auth.loggingOut')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen border-r border-border bg-background transition-all duration-300 md:block',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent collapsed={isCollapsed} />
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300',
          isCollapsed ? 'md:pl-16' : 'md:pl-64'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2">
              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{t('common.menu')}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SidebarContent
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>

              {/* Desktop collapse */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setIsCollapsed((v) => !v)}
                title={isCollapsed ? t('common.openSidebar') : t('common.closeSidebar')}
              >
                <ChevronLeft
                  className={cn(
                    'h-5 w-5 transition-transform duration-300',
                    isCollapsed ? 'rotate-180' : 'rotate-0'
                  )}
                />
              </Button>

              <h2 className="text-xl font-semibold md:text-2xl">{title}</h2>
            </div>

            <div className="flex items-center gap-3">
              {showCompanySwitcher && (
                <div className="hidden md:block">{renderCompanySelect()}</div>
              )}
              <LanguageSwitcher />
              {headerRight}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
