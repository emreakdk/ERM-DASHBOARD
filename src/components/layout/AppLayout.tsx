import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../theme-provider'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import {
  LayoutDashboard,
  Wallet,
  Banknote,
  FileText,
  Users,
  Settings,
  LogOut,
  User,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
} from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
}

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/kasa-banka', label: 'Kasa & Banka', icon: Wallet },
  { path: '/finans', label: 'Finans', icon: Banknote },
  { path: '/faturalar', label: 'Faturalar', icon: FileText },
  { path: '/musteriler', label: 'Müşteriler', icon: Users },
  { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
]

export function AppLayout({ children, title = 'Dashboard' }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
    return (
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex h-16 items-center border-b border-border',
            collapsed ? 'justify-center px-2' : 'px-6'
          )}
        >
          <h1 className={cn('font-bold tracking-tight', collapsed ? 'text-lg' : 'text-xl')}>
            {collapsed ? 'ERP' : 'ERP Panel'}
          </h1>
        </div>

        <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
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
          })}
        </nav>

        <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.full_name || 'Kullanıcı'}
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
              title="Tema Değiştir"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && <span className="ml-2">Tema</span>}
            </Button>

            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={cn(
                collapsed ? 'h-10 w-10' : 'flex-1 justify-start',
                'text-muted-foreground'
              )}
              onClick={handleLogout}
              title="Çıkış Yap"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Çıkış Yap</span>}
            </Button>
          </div>
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
                    <span className="sr-only">Menü</span>
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
                title={isCollapsed ? 'Sidebar Aç' : 'Sidebar Kapat'}
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
              {/* Global filters will be inserted here by pages */}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
