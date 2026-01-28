import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, LogOut, ArrowLeft, Sun, Moon, Package } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../theme-provider'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface SystemAdminLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
}

const getNavItems = (t: (key: string) => string) => [
  {
    label: t('admin.overview'),
    path: '/admin',
    icon: ShieldCheck,
  },
  {
    label: t('packages.title'),
    path: '/admin/packages',
    icon: Package,
  },
]

export function SystemAdminLayout({ title, description, children }: SystemAdminLayoutProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, toggleTheme } = useTheme()
  const navItems = useMemo(() => getNavItems(t), [t])

  const initials = useMemo(() => {
    const fallback = 'SA'
    if (!user?.email) return fallback
    const [namePart] = user.email.split('@')
    if (!namePart) return fallback
    return namePart
      .split(/[.\-_]/)
      .map((chunk) => chunk[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 3)
      .padEnd(2, 'A')
  }, [user?.email])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-72 flex-col border-r border-border bg-card/95 backdrop-blur-sm p-6 lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('admin.systemControl')}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{t('admin.supersetConsole')}</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 rounded-2xl border border-border bg-muted/50 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </div>
              <div className="leading-tight">
                <p className="text-xs uppercase text-muted-foreground">{t('users.role')}</p>
                <p className="text-sm font-semibold text-foreground">{t('admin.systemAdministrator')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('admin.backToERP')}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleTheme}>
                {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.logout')}
            </Button>
          </div>
        </aside>

        <main className="flex-1 bg-muted/30 p-4 lg:p-10 scroll-smooth">
          <header className="sticky top-4 z-30 mb-8 rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-lg backdrop-blur">
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{t('admin.systemAdmin')}</p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
                {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <LanguageSwitcher />
                <Button variant="outline" onClick={() => navigate('/')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('admin.backToERPPanel')}
                </Button>
                <Button variant="secondary" onClick={toggleTheme}>
                  {resolvedTheme === 'dark' ? (
                    <>
                      <Sun className="mr-2 h-4 w-4" />
                      {t('admin.switchToLight')}
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 h-4 w-4" />
                      {t('admin.switchToDark')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </header>

          <div className="space-y-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
