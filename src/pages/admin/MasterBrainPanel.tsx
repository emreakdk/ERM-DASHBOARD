import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useActiveSubscriptionPlans } from '../../hooks/useSubscription'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  Shield,
  Trash2,
  Edit,
  Key,
  Ban,
  CheckCircle,
  Plus,
  Search,
  Calendar as CalendarIcon,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { SystemAdminLayout } from '../../components/layout/SystemAdminLayout'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { Input } from '../../components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { useToast } from '../../components/ui/use-toast'
import { CreateUserDialog } from '../../components/admin/CreateUserDialog'
import { CompanyLogoUpload } from '../../components/admin/CompanyLogoUpload'
import { PermissionMatrix } from '../../components/admin/PermissionMatrix'
import { SystemHealthDashboard } from '../../components/admin/SystemHealthDashboard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Label } from '../../components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { Calendar } from '../../components/ui/calendar'
import {
  fetchAdminCompanies,
  fetchAdminProfiles,
  fetchSystemActivityLogs,
  fetchSystemUptimeSeconds,
  type AdminCompanyRecord,
  type AdminProfileRow,
} from './adminQueries'
import { deleteUser, resetUserPassword, updateUserProfile } from './userManagement'
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLogger'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency } from '../../lib/format'
import { translateActivityDescription } from '../../lib/i18n-utils'

type SystemErrorLog = {
  id: string
  company_id?: string | null
  user_id: string | null
  error_code: string
  error_message: string
  error_details?: Record<string, unknown> | null
  error_source?: string | null
  source?: string
  function_name?: string | null
  severity?: string | null
  resolved?: boolean | null
  request_path?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy, HH:mm', { locale: tr })
  } catch {
    return value
  }
}

function formatUptime(seconds?: number | null, locale: string = 'tr') {
  if (seconds === undefined || seconds === null) return '—'

  const isEnglish = locale.startsWith('en')
  const unitLabels = isEnglish
    ? { day: 'd', hour: 'h', minute: 'm', second: 's' }
    : { day: 'g', hour: 's', minute: 'dk', second: 'sn' }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const parts: string[] = []
  if (days) parts.push(`${days}${unitLabels.day}`)
  if (hours) parts.push(`${hours}${unitLabels.hour}`)
  if (minutes) parts.push(`${minutes}${unitLabels.minute}`)
  if (!parts.length) parts.push(`${remainingSeconds}${unitLabels.second}`)

  return parts.join(' ')
}

function getErrorMessage(error: unknown, t?: (key: string) => string) {
  if (!error) return t?.('admin.unknownError') ?? 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error)
}

function cleanActivityMessage(message?: string | null) {
  if (!message) return ''
  return message.replace(/\s*\([^)]*?tl\)/gi, '').trim()
}

function getRoleBadgeColor(role?: string | null) {
  switch (role) {
    case 'superadmin':
      return 'bg-purple-500/10 text-purple-300 border-purple-500/30'
    case 'admin':
      return 'bg-blue-500/10 text-blue-300 border-blue-500/30'
    case 'user':
      return 'bg-green-500/10 text-green-300 border-green-500/30'
    default:
      return 'bg-gray-500/10 text-gray-300 border-gray-500/30'
  }
}

function getRoleLabel(role?: string | null, t?: (key: string) => string) {
  if (!t) {
    switch (role) {
      case 'superadmin': return 'Süper Admin'
      case 'admin': return 'Admin'
      case 'user': return 'Kullanıcı'
      default: return 'Sistem'
    }
  }
  switch (role) {
    case 'superadmin':
      return t('roles.superadmin')
    case 'admin':
      return t('roles.admin')
    case 'user':
      return t('roles.user')
    default:
      return t('admin.system')
  }
}

/**
 * Hata seviyesine göre badge CSS sınıflarını döndürür
 * @param severity - Hata seviyesi (critical, warning, info, error)
 * @returns Tailwind CSS sınıfları
 */
function getSeverityBadgeClasses(severity?: string | null) {
  switch ((severity ?? 'error').toLowerCase()) {
    case 'critical':
      return 'bg-red-500/10 text-red-400 border-red-500/30'
    case 'warning':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30'
    case 'info':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    case 'error':
    default:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  }
}

/**
 * Master Brain Panel - Enterprise SaaS Yönetim Paneli
 * 
 * Sistem genelinde şirket, kullanıcı ve aktivite yönetimi sağlar.
 * Superadmin rolüne sahip kullanıcılar için tasarlanmıştır.
 * 
 * @component
 * @returns Master Brain Panel bileşeni
 */
export function MasterBrainPanel() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [searchCompany, setSearchCompany] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [searchActivity, setSearchActivity] = useState('')
  const [activityDateRange, setActivityDateRange] = useState<{ from?: Date; to?: Date }>()
  const dateLocale = i18n.language === 'en' ? enUS : tr
  const activityTypeLabels: Record<string, string> = useMemo(
    () => ({
      user_created: t('admin.activityTypes.user_created'),
      user_updated: t('admin.activityTypes.user_updated'),
      user_deleted: t('admin.activityTypes.user_deleted'),
      user_blocked: t('admin.activityTypes.user_blocked'),
      user_unblocked: t('admin.activityTypes.user_unblocked'),
      company_created: t('admin.activityTypes.company_created'),
      company_updated: t('admin.activityTypes.company_updated'),
      company_status_changed: t('admin.activityTypes.company_status_changed'),
      password_reset: t('admin.activityTypes.password_reset'),
      role_changed: t('admin.activityTypes.role_changed'),
      permission_updated: t('admin.activityTypes.permission_updated'),
      quota_updated: t('admin.activityTypes.quota_updated'),
      invoice_status_updated: t('admin.activityTypes.invoice_status_updated'),
    }),
    [t]
  )
  const [selectedCompanyForPermissions, setSelectedCompanyForPermissions] = useState<string | null>(
    null
  )
  const [deleteUserDialog, setDeleteUserDialog] = useState<{
    open: boolean
    user: AdminProfileRow | null
  }>({ open: false, user: null })
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean
    user: AdminProfileRow | null
    newPassword: string
  }>({ open: false, user: null, newPassword: '' })
  const [editCompanyDialog, setEditCompanyDialog] = useState<{
    open: boolean
    company: AdminCompanyRecord | null
    name: string
    planId: string | null
    invoiceLimit: number
    userLimit: number
    transactionLimit: number
  }>({ open: false, company: null, name: '', planId: null, invoiceLimit: 1000, userLimit: 50, transactionLimit: 10000 })
  const [createCompanyDialog, setCreateCompanyDialog] = useState<{
    open: boolean
    name: string
  }>({ open: false, name: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'error_logs'>('overview')

  const companyQuery = useQuery({
    queryKey: ['admin_companies_master'],
    queryFn: fetchAdminCompanies,
  })

  const profileQuery = useQuery({
    queryKey: ['admin_profiles_master'],
    queryFn: fetchAdminProfiles,
  })

  const uptimeQuery = useQuery({
    queryKey: ['system_uptime_master'],
    queryFn: fetchSystemUptimeSeconds,
  })

  const activityQuery = useQuery({
    queryKey: ['system_activity_master', searchActivity, activityDateRange],
    queryFn: () => fetchSystemActivityLogs(searchActivity ? 50 : 10),
  })

  const errorLogsQuery = useQuery({
    queryKey: ['system_errors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data || []
    },
  })

  const plansQuery = useActiveSubscriptionPlans()

  const filteredCompanies = useMemo(() => {
    if (!companyQuery.data) return []
    if (!searchCompany) return companyQuery.data
    return companyQuery.data.filter((c) =>
      c.name.toLowerCase().includes(searchCompany.toLowerCase())
    )
  }, [companyQuery.data, searchCompany])

  const filteredUsers = useMemo(() => {
    if (!profileQuery.data) return []
    if (!searchUser) return profileQuery.data
    return profileQuery.data.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email.toLowerCase().includes(searchUser.toLowerCase())
    )
  }, [profileQuery.data, searchUser])

  const stats = useMemo(() => {
    const companies = companyQuery.data ?? []
    const users = profileQuery.data ?? []
    const totalTransactions = companies.reduce((sum, c) => sum + c.transactionCount, 0)
    const activeCompanies = companies.filter((c) => c.is_active !== false).length
    const blockedUsers = users.filter((u) => u.is_blocked).length

    return {
      totalCompanies: companies.length,
      activeCompanies,
      totalUsers: users.length,
      blockedUsers,
      totalTransactions,
    }
  }, [companyQuery.data, profileQuery.data])

  const createCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('companies').insert({ name }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: async (data) => {
      toast({ title: t('admin.companyCreated'), description: t('admin.companyCreatedDesc') })
      if (user?.id) {
        await logActivity({
          actorId: user.id,
          actionType: 'company_created',
          description: t('admin.newCompanyCreated', { name: data.name }),
          metadata: { company_id: data.id, company_name: data.name }
        })
      }
      queryClient.invalidateQueries({ queryKey: ['admin_companies_master'] })
      queryClient.invalidateQueries({ queryKey: ['system_activity_master'] })
      setCreateCompanyDialog({ open: false, name: '' })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast({
        title: t('users.deleteUser'),
        description: t('users.userDeletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_master'] })
      setDeleteUserDialog({ open: false, user: null })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      resetUserPassword(userId, password),
    onSuccess: () => {
      toast({ title: t('auth.resetPassword'), description: t('users.passwordResetSuccess') })
      setResetPasswordDialog({ open: false, user: null, newPassword: '' })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const updateCompanyMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      planId,
      logoUrl,
      invoiceLimit,
      userLimit,
      transactionLimit,
    }: {
      id: string
      name: string
      planId: string | null
      logoUrl?: string
      invoiceLimit?: number
      userLimit?: number
      transactionLimit?: number
    }) => {
      const payload: Record<string, string | number | null> = { name }
      if (logoUrl !== undefined) payload.logo_url = logoUrl
      if (invoiceLimit !== undefined) payload.invoice_limit = invoiceLimit
      if (userLimit !== undefined) payload.user_limit = userLimit
      if (transactionLimit !== undefined) payload.transaction_limit = transactionLimit
      payload.plan_id = planId

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(sessionError.message)
      }
      if (!session?.access_token) {
        throw new Error('Invalid admin session')
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${id}&select=*`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) {
        const details = Array.isArray(result) ? result[0] : result
        const message = details?.message || details?.error || t('admin.companyUpdateFailed')
        throw new Error(message)
      }

      return { id, name, payload, updatedRow: Array.isArray(result) ? result[0] : result }
    },
    onSuccess: async (data) => {
      toast({ title: t('admin.companyUpdated') })
      if (user?.id) {
        await logActivity({
          actorId: user.id,
          actionType: 'company_updated',
          description: t('admin.companyInfoUpdated', { name: data.name }),
          metadata: { company_id: data.id, updates: data.payload }
        })
      }
      queryClient.invalidateQueries({ queryKey: ['admin_companies_master'] })
      queryClient.invalidateQueries({ queryKey: ['system_activity_master'] })
      setEditCompanyDialog({ open: false, company: null, name: '', planId: null, invoiceLimit: 1000, userLimit: 50, transactionLimit: 10000 })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const toggleCompanyActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('companies').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_companies_master'] })
    },
  })

  const toggleUserBlockedMutation = useMutation({
    mutationFn: async ({ id, isBlocked, userName }: { id: string; isBlocked: boolean; userName: string }) => {
      await updateUserProfile(id, { is_blocked: isBlocked })
      return { id, isBlocked, userName }
    },
    onSuccess: async (data) => {
      if (user?.id) {
        await logActivity({
          actorId: user.id,
          actionType: data.isBlocked ? 'user_blocked' : 'user_unblocked',
          description: data.isBlocked ? t('admin.userBlocked', { name: data.userName }) : t('admin.userUnblocked', { name: data.userName }),
          metadata: { target_user_id: data.id, is_blocked: data.isBlocked }
        })
      }
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_master'] })
      queryClient.invalidateQueries({ queryKey: ['system_activity_master'] })
    },
  })

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role, userName }: { id: string; role: 'admin' | 'user' | 'superadmin'; userName: string }) => {
      await updateUserProfile(id, { role })
      return { id, role, userName }
    },
    onSuccess: async (data) => {
      if (user?.id) {
        await logActivity({
          actorId: user.id,
          actionType: 'role_changed',
          description: `Kullanıcı rolü değiştirildi: ${data.userName} -> ${data.role}`,
          metadata: { target_user_id: data.id, new_role: data.role }
        })
      }
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_master'] })
      queryClient.invalidateQueries({ queryKey: ['system_activity_master'] })
    },
  })

  const updateUserCompanyMutation = useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string | null }) => {
      await updateUserProfile(id, { company_id: companyId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_master'] })
    },
  })


  const hasErrors =
    companyQuery.error || profileQuery.error || uptimeQuery.error || activityQuery.error

  return (
    <SystemAdminLayout
      title={t('admin.masterBrainTitle')}
      description={t('admin.masterBrainDescription')}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as 'overview' | 'health' | 'error_logs')
        }
        className="mt-4 space-y-8"
      >
        <TabsList className="flex w-full justify-start gap-2 border-b bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all data-[state=active]:border-primary data-[state=active]:text-primary hover:text-primary/70"
          >
            {t('admin.overview')}
          </TabsTrigger>
          <TabsTrigger
            value="health"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all data-[state=active]:border-primary data-[state=active]:text-primary hover:text-primary/70"
          >
            {t('admin.systemHealth')}
          </TabsTrigger>
          <TabsTrigger
            value="error_logs"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-all data-[state=active]:border-primary data-[state=active]:text-primary hover:text-primary/70"
          >
            {t('admin.errorLogs')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
        {/* Error Alerts */}
        {hasErrors && (
          <Alert variant="destructive">
            <AlertTitle>{t('admin.dataLoadError')}</AlertTitle>
            <AlertDescription>
              {companyQuery.error && <div>{t('admin.companies')}: {getErrorMessage(companyQuery.error, t)}</div>}
              {profileQuery.error && <div>{t('admin.users')}: {getErrorMessage(profileQuery.error, t)}</div>}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards - Modern Style */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-l-4 border-l-blue-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.totalCompanies')}
              </CardTitle>
              <div className="rounded-lg bg-blue-500/10 p-2 group-hover:bg-blue-500/20 transition-colors">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-blue-400 bg-clip-text text-transparent">{stats.totalCompanies}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.activeCompanies', { count: stats.activeCompanies })}
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-l-4 border-l-green-500 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.totalUsers')}
              </CardTitle>
              <div className="rounded-lg bg-green-500/10 p-2 group-hover:bg-green-500/20 transition-colors">
                <Users className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-green-600 to-green-400 bg-clip-text text-transparent">{stats.totalUsers}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.blockedAccounts', { count: stats.blockedUsers })}
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-l-4 border-l-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.systemUptime')}
              </CardTitle>
              <div className="rounded-lg bg-purple-500/10 p-2 group-hover:bg-purple-500/20 transition-colors">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-purple-600 to-purple-400 bg-clip-text text-transparent">{formatUptime(uptimeQuery.data, i18n.language)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t('admin.continuousOperation')}</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-l-4 border-l-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.transactionVolume')}
              </CardTitle>
              <div className="rounded-lg bg-orange-500/10 p-2 group-hover:bg-orange-500/20 transition-colors">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-orange-600 to-orange-400 bg-clip-text text-transparent">{stats.totalTransactions.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t('admin.totalRecords')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Companies Section */}
        <Card className="shadow-lg border-border/50 backdrop-blur-sm" id="companies">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Building2 className="h-5 w-5" />
                  {t('admin.companyManagement')}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t('admin.viewAndManageCompanies')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
                  <Input
                    placeholder={t('admin.searchCompany')}
                    value={searchCompany}
                    onChange={(e) => setSearchCompany(e.target.value)}
                    className="pl-9 w-[200px] transition-all focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button onClick={() => setCreateCompanyDialog({ open: true, name: '' })} className="shadow-sm hover:shadow-md transition-all">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('admin.newCompany')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t('table.company')}</TableHead>
                    <TableHead className="font-semibold">{t('companies.plan')}</TableHead>
                    <TableHead className="font-semibold">{t('table.status')}</TableHead>
                    <TableHead className="font-semibold">{t('table.users')}</TableHead>
                    <TableHead className="font-semibold">{t('table.records')}</TableHead>
                    <TableHead className="font-semibold">{t('table.createdAt')}</TableHead>
                    <TableHead className="text-right font-semibold">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {searchCompany ? t('admin.noCompaniesFound') : t('admin.noCompaniesYet')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => (
                      <TableRow key={company.id} className="group hover:bg-muted/70 transition-colors duration-200">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-semibold text-white shadow-sm">
                              {company.logo_url ? (
                                <img
                                  src={company.logo_url}
                                  alt={company.name}
                                  className="h-full w-full rounded-lg object-cover"
                                />
                              ) : (
                                company.name?.charAt(0).toUpperCase() ?? '?'
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{company.name}</p>
                              <p className="text-xs text-muted-foreground">
                                ID: {company.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">
                              {company.plan?.display_name || t('admin.noPlanShort')}
                            </span>
                            {company.plan && (
                              <span className="text-xs text-muted-foreground">
                                {t('admin.planPricePerMonth', {
                                  price: company.plan.price,
                                  currency: company.plan.currency,
                                })}
                              </span>
                            )}
                            {company.is_trial && (
                              <Badge variant="secondary" className="text-xs w-fit">
                                {t('admin.trialBadge')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={company.is_active ?? true}
                              onCheckedChange={(checked) =>
                                toggleCompanyActiveMutation.mutate({
                                  id: company.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <Badge
                              variant={company.is_active ? 'default' : 'secondary'}
                              className="font-medium"
                            >
                              {company.is_active ? t('status.active') : t('status.inactive')}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {company.userCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {company.transactionCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(company.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                              onClick={() =>
                                setEditCompanyDialog({
                                  open: true,
                                  company,
                                  name: company.name,
                                  planId: company.plan_id || null,
                                  invoiceLimit: company.invoice_limit || 1000,
                                  userLimit: company.user_limit || 50,
                                  transactionLimit: company.transaction_limit || 10000,
                                })
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-purple-500/10 hover:text-purple-500 hover:border-purple-500/50 transition-all"
                              onClick={() => setSelectedCompanyForPermissions(company.id)}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Users Section */}
        <Card className="shadow-lg border-border/50 backdrop-blur-sm" id="users">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-5 w-5" />
                  {t('admin.userManagement')}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t('admin.viewAndManageUsers')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
                  <Input
                    placeholder={t('admin.searchUser')}
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="pl-9 w-[200px] transition-all focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <CreateUserDialog />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-lg border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t('common.user')}</TableHead>
                    <TableHead className="font-semibold">{t('users.role')}</TableHead>
                    <TableHead className="font-semibold">{t('table.company')}</TableHead>
                    <TableHead className="font-semibold">{t('table.status')}</TableHead>
                    <TableHead className="text-right font-semibold">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {searchUser ? t('admin.noUsersFound') : t('admin.noUsersYet')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="group hover:bg-muted/70 transition-colors duration-200">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-teal-600 text-sm font-semibold text-white shadow-sm">
                              {user.full_name?.charAt(0).toUpperCase() ||
                                user.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name || t('admin.unnamed')}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(role: 'admin' | 'user' | 'superadmin') =>
                              updateUserRoleMutation.mutate({ id: user.id, role, userName: user.full_name || user.email })
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">{t('roles.user')}</SelectItem>
                              <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                              <SelectItem value="superadmin">{t('roles.superadmin')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.company_id || '__none__'}
                            onValueChange={(value) =>
                              updateUserCompanyMutation.mutate({
                                id: user.id,
                                companyId: value === '__none__' ? null : value,
                              })
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t('admin.noCompany')}</SelectItem>
                              {companyQuery.data?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!user.is_blocked}
                              onCheckedChange={(checked) =>
                                toggleUserBlockedMutation.mutate({
                                  id: user.id,
                                  isBlocked: !checked,
                                  userName: user.full_name || user.email,
                                })
                              }
                            />
                            {user.is_blocked ? (
                              <Badge variant="destructive" className="gap-1">
                                <Ban className="h-3 w-3" />
                                {t('admin.blocked')}
                              </Badge>
                            ) : (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {t('common.active')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/50 transition-all"
                              onClick={() =>
                                setResetPasswordDialog({ open: true, user, newPassword: '' })
                              }
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-all"
                              onClick={() => setDeleteUserDialog({ open: true, user })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-lg border-border/50 backdrop-blur-sm" id="activity">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5" />
                {t('admin.recentActivity')}
              </CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
                  <Input
                    placeholder={t('admin.searchActivityPlaceholder')}
                    value={searchActivity}
                    onChange={(e) => setSearchActivity(e.target.value)}
                    className="pl-9 w-[200px] transition-all focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {activityDateRange?.from ? (
                        activityDateRange.to ? (
                          <>
                            {format(activityDateRange.from, 'd MMM', { locale: dateLocale })} -{' '}
                            {format(activityDateRange.to, 'd MMM', { locale: dateLocale })}
                          </>
                        ) : (
                          format(activityDateRange.from, 'd MMM yyyy', { locale: dateLocale })
                        )
                      ) : (
                        <span>{t('activities.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      selected={activityDateRange?.from}
                      onSelect={(date) => {
                        if (date) {
                          setActivityDateRange({ from: date, to: date })
                        }
                      }}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
                {(searchActivity || activityDateRange) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchActivity('')
                      setActivityDateRange(undefined)
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : activityQuery.data?.filter((log) => {
                const matchesSearch =
                  !searchActivity ||
                  (log.description || log.message || '')
                    .toLowerCase()
                    .includes(searchActivity.toLowerCase()) ||
                  (log.actor?.full_name || '')
                    .toLowerCase()
                    .includes(searchActivity.toLowerCase()) ||
                  (log.actor?.email || '')
                    .toLowerCase()
                    .includes(searchActivity.toLowerCase())

                const matchesDate =
                  !activityDateRange?.from ||
                  (new Date(log.created_at) >= activityDateRange.from &&
                    (!activityDateRange.to || new Date(log.created_at) <= activityDateRange.to))

                return matchesSearch && matchesDate
              }).map((log) => {
                const rawDescription = log.description || cleanActivityMessage(log.message) || ''
                const translatedDescription = translateActivityDescription(rawDescription, t)
                const actionLabel = log.action_type
                  ? activityTypeLabels[log.action_type] ?? log.action_type.replace(/_/g, ' ')
                  : null

                return (
                  <div
                    key={log.id}
                    className="group flex items-start gap-3 rounded-lg border bg-card/50 backdrop-blur-sm p-4 text-sm transition-all duration-200 hover:bg-muted/70 hover:shadow-md hover:border-primary/30"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Activity className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{translatedDescription}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {log.actor?.full_name || log.actor?.email || t('admin.system')}
                        </span>
                        {log.actor?.role && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${getRoleBadgeColor(log.actor.role)}`}
                          >
                            {getRoleLabel(log.actor.role)}
                          </Badge>
                        )}
                        <span>•</span>
                        <span>{formatDate(log.created_at)}</span>
                        {actionLabel && (
                          <>
                            <span>•</span>
                            <span className="text-primary/60">{actionLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="health">
          <SystemHealthDashboard />
        </TabsContent>

        <TabsContent value="error_logs" className="space-y-6">
          <Card className="shadow-lg border-border/50 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  {t('admin.errorLogs')}
                </CardTitle>
                <CardDescription>{t('admin.monitorSystemErrors')}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => errorLogsQuery.refetch()}>
                {t('common.refresh')}
              </Button>
            </CardHeader>
            <CardContent>
              {errorLogsQuery.isLoading ? (
                <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
              ) : errorLogsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>{t('common.error')}</AlertTitle>
                  <AlertDescription>{t('admin.errorLogsLoadFailed')}</AlertDescription>
                </Alert>
              ) : errorLogsQuery.data && errorLogsQuery.data.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>{t('admin.severity')}</TableHead>
                        <TableHead>{t('admin.code')}</TableHead>
                        <TableHead>{t('admin.source')}</TableHead>
                        <TableHead>{t('admin.function')}</TableHead>
                        <TableHead>{t('admin.message')}</TableHead>
                        <TableHead>{t('common.date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(errorLogsQuery.data as SystemErrorLog[]).map((log) => (
                        <TableRow key={log.id} className="group align-top hover:bg-muted/70 transition-colors duration-200">
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getSeverityBadgeClasses(log.severity)}`}
                            >
                              {log.severity ?? 'error'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.error_code}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium capitalize">{log.source}</div>
                            {log.company_id && (
                              <div className="text-xs text-muted-foreground">
                                {t('table.company')}: {log.company_id.slice(0, 8)}…
                              </div>
                            )}
                            {log.user_id && (
                              <div className="text-xs text-muted-foreground">
                                {t('common.user')}: {log.user_id.slice(0, 8)}…
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{log.function_name || '—'}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{log.error_message}</div>
                            {log.error_details && (
                              <pre className="mt-1 max-h-24 overflow-y-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                                {JSON.stringify(log.error_details, null, 2)}
                              </pre>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDate(log.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">{t('admin.noErrorLogs')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Company Dialog */}
      <Dialog
        open={createCompanyDialog.open}
        onOpenChange={(open) => !open && setCreateCompanyDialog({ open: false, name: '' })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.createCompany')}</DialogTitle>
            <DialogDescription>{t('admin.addNewCompany')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">{t('companies.companyName')}</Label>
              <Input
                id="company_name"
                value={createCompanyDialog.name}
                onChange={(e) =>
                  setCreateCompanyDialog((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t('admin.companyNamePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateCompanyDialog({ open: false, name: '' })}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createCompanyMutation.mutate(createCompanyDialog.name)}
              disabled={!createCompanyDialog.name.trim() || createCompanyMutation.isPending}
            >
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Matrix Dialog */}
      {selectedCompanyForPermissions && (
        <Dialog
          open={!!selectedCompanyForPermissions}
          onOpenChange={() => setSelectedCompanyForPermissions(null)}
        >
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{t('admin.permissionManagement')}</DialogTitle>
              <DialogDescription>
                {t('admin.configurePermissions')}
              </DialogDescription>
            </DialogHeader>
            <PermissionMatrix
              companyId={selectedCompanyForPermissions}
              companyName={
                companyQuery.data?.find((c) => c.id === selectedCompanyForPermissions)?.name || ''
              }
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Company Dialog */}
      <Dialog
        open={editCompanyDialog.open}
        onOpenChange={(open) =>
          !open && setEditCompanyDialog({ open: false, company: null, name: '', planId: null, invoiceLimit: 1000, userLimit: 50, transactionLimit: 10000 })
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('companies.editCompany')}</DialogTitle>
            <DialogDescription>{t('admin.updateCompanyInfo')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('companies.companyName')}</Label>
              <Input
                value={editCompanyDialog.name}
                onChange={(e) =>
                  setEditCompanyDialog((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('companies.subscription')}</Label>
              <Select
                value={editCompanyDialog.planId || '__none__'}
                onValueChange={(value) =>
                  setEditCompanyDialog((prev) => ({ ...prev, planId: value === '__none__' ? null : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('companies.selectPlan')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('admin.noPlan')}</SelectItem>
                  {plansQuery.data?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.display_name} ({formatCurrency(plan.price)}/{plan.billing_period === 'monthly' ? t('admin.monthly') : t('admin.yearly')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('admin.planSelectionDescription')}
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('forms.maxInvoices')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={editCompanyDialog.invoiceLimit}
                  onChange={(e) =>
                    setEditCompanyDialog((prev) => ({ ...prev, invoiceLimit: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('forms.maxUsers')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={editCompanyDialog.userLimit}
                  onChange={(e) =>
                    setEditCompanyDialog((prev) => ({ ...prev, userLimit: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('forms.maxTransactions')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={editCompanyDialog.transactionLimit}
                  onChange={(e) =>
                    setEditCompanyDialog((prev) => ({ ...prev, transactionLimit: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            
            {editCompanyDialog.company && (
              <div className="space-y-2">
                <Label>{t('companies.logo')}</Label>
                <CompanyLogoUpload
                  companyId={editCompanyDialog.company.id}
                  currentLogoUrl={editCompanyDialog.company.logo_url}
                  onUploadSuccess={(url) =>
                    updateCompanyMutation.mutate({
                      id: editCompanyDialog.company!.id,
                      name: editCompanyDialog.name,
                      planId: editCompanyDialog.planId,
                      logoUrl: url,
                      invoiceLimit: editCompanyDialog.invoiceLimit,
                      userLimit: editCompanyDialog.userLimit,
                      transactionLimit: editCompanyDialog.transactionLimit,
                    })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCompanyDialog({ open: false, company: null, name: '', planId: null, invoiceLimit: 1000, userLimit: 50, transactionLimit: 10000 })}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() =>
                editCompanyDialog.company &&
                updateCompanyMutation.mutate({
                  id: editCompanyDialog.company.id,
                  name: editCompanyDialog.name,
                  planId: editCompanyDialog.planId,
                  invoiceLimit: editCompanyDialog.invoiceLimit,
                  userLimit: editCompanyDialog.userLimit,
                  transactionLimit: editCompanyDialog.transactionLimit,
                })
              }
              disabled={!editCompanyDialog.name.trim()}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog
        open={deleteUserDialog.open}
        onOpenChange={(open) => !open && setDeleteUserDialog({ open: false, user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.deleteUser')}</DialogTitle>
            <DialogDescription>
              {t('admin.deleteUserWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm font-medium">
              {t('admin.confirmDeleteUser', { name: deleteUserDialog.user?.full_name || deleteUserDialog.user?.email })}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteUserDialog({ open: false, user: null })}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteUserDialog.user && deleteUserMutation.mutate(deleteUserDialog.user.id)
              }
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetPasswordDialog.open}
        onOpenChange={(open) =>
          !open && setResetPasswordDialog({ open: false, user: null, newPassword: '' })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
            <DialogDescription>{t('admin.setNewPasswordForUser')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('common.user')}</Label>
              <Input
                value={resetPasswordDialog.user?.full_name || resetPasswordDialog.user?.email || ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>{t('auth.newPassword')}</Label>
              <Input
                type="password"
                value={resetPasswordDialog.newPassword}
                onChange={(e) =>
                  setResetPasswordDialog((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                placeholder={t('auth.minCharacters', { count: 6 })}
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setResetPasswordDialog({ open: false, user: null, newPassword: '' })
              }
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() =>
                resetPasswordDialog.user &&
                resetPasswordMutation.mutate({
                  userId: resetPasswordDialog.user.id,
                  password: resetPasswordDialog.newPassword,
                })
              }
              disabled={resetPasswordDialog.newPassword.length < 6}
            >
              {t('auth.resetPassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SystemAdminLayout>
  )
}
