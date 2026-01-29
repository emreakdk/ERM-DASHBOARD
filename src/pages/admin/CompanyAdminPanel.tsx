import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, TrendingUp, AlertCircle, Plus, Search, Edit, Trash2, Key } from 'lucide-react'
import { AppLayout } from '../../components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
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
import { useToast } from '../../components/ui/use-toast'
import { useTenant } from '../../contexts/TenantContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLogger'
import type { Database } from '../../types/database'
import { deleteUser, resetUserPassword, updateUserProfile } from './userManagement'
import { PermissionMatrix } from '../../components/admin/PermissionMatrix'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

interface CompanyUser extends ProfileRow {
  created_at: string
}

interface QuotaUsage {
  quota_type: string
  current_usage: number
  quota_limit: number
  percentage_used: number
}

async function fetchCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .returns<CompanyUser[]>()

  if (error) throw error
  return data ?? []
}

async function fetchCompanyQuotas(companyId: string): Promise<QuotaUsage[]> {
  try {
    type PlanFeaturesRow = {
      plan_id: string | null
      subscription_plans: {
        features: Record<string, unknown> | null
      } | null
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        plan_id,
        subscription_plans (
          features
        )
      `)
      .eq('id', companyId)
      .maybeSingle<PlanFeaturesRow>()

    if (companyError || !company) return []

    const features = company.subscription_plans?.features ?? null
    if (!features) return []

    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const getNumericFeature = (key: string, fallback: number) => {
      const value = features[key]
      return typeof value === 'number' ? value : fallback
    }

    const maxUsers = getNumericFeature('max_users', 50)
    const maxInvoices = getNumericFeature('max_invoices', 1000)
    const maxCustomers = getNumericFeature('max_customers', 500)

    return [
      {
        quota_type: 'users',
        current_usage: userCount || 0,
        quota_limit: maxUsers,
        percentage_used: maxUsers === -1 ? 0 : ((userCount || 0) / maxUsers) * 100,
      },
      {
        quota_type: 'invoices',
        current_usage: invoiceCount || 0,
        quota_limit: maxInvoices,
        percentage_used: maxInvoices === -1 ? 0 : ((invoiceCount || 0) / maxInvoices) * 100,
      },
      {
        quota_type: 'customers',
        current_usage: customerCount || 0,
        quota_limit: maxCustomers,
        percentage_used: maxCustomers === -1 ? 0 : ((customerCount || 0) / maxCustomers) * 100,
      },
    ]
  } catch {
    return []
  }
}

export function CompanyAdminPanel() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { companyId, companyName } = useTenant()
  const { user } = useAuth()
  const { refreshPermissions } = usePermissions()
  const [searchUser, setSearchUser] = useState('')
  const [createUserDialog, setCreateUserDialog] = useState({
    open: false,
    email: '',
    password: '',
    fullName: '',
    role: 'user' as 'admin' | 'user',
  })
  const [editUserDialog, setEditUserDialog] = useState<{
    open: boolean
    user: CompanyUser | null
    fullName: string
  }>({ open: false, user: null, fullName: '' })
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean
    user: CompanyUser | null
    newPassword: string
  }>({ open: false, user: null, newPassword: '' })
  const [deleteUserDialog, setDeleteUserDialog] = useState<{
    open: boolean
    user: CompanyUser | null
  }>({ open: false, user: null })

  const usersQuery = useQuery({
    queryKey: ['company_users', companyId],
    queryFn: () => fetchCompanyUsers(companyId!),
    enabled: !!companyId,
  })

  const quotasQuery = useQuery({
    queryKey: ['company_quotas', companyId],
    queryFn: () => fetchCompanyQuotas(companyId!),
    enabled: !!companyId,
  })

  const filteredUsers = useMemo(() => {
    if (!usersQuery.data) return []
    if (!searchUser) return usersQuery.data
    return usersQuery.data.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email.toLowerCase().includes(searchUser.toLowerCase())
    )
  }, [usersQuery.data, searchUser])

  const primaryAdminId = useMemo(() => {
    const admins = (usersQuery.data ?? [])
      .filter((u) => u.role === 'admin')
      .sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
        return aDate - bDate
      })
    return admins[0]?.id ?? null
  }, [usersQuery.data])

  const isProtectedAdmin = (user: CompanyUser) => user.role === 'admin' && user.id === primaryAdminId

  const updateUserNameMutation = useMutation({
    mutationFn: async ({ userId, fullName }: { userId: string; fullName: string }) => {
      await updateUserProfile(userId, { full_name: fullName })
    },
    onSuccess: () => {
      toast({ title: t('admin.userUpdated') })
      setEditUserDialog({ open: false, user: null, fullName: '' })
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      await resetUserPassword(userId, newPassword)
    },
    onSuccess: () => {
      toast({ title: t('users.passwordResetSuccess'), description: t('admin.userPasswordChanged') })
      setResetPasswordDialog({ open: false, user: null, newPassword: '' })
    },
    onError: (error: unknown) => {
      toast({ title: t('common.error'), description: error as string, variant: 'destructive' })
    },
  })

  const deleteCompanyUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await deleteUser(userId)
    },
    onSuccess: () => {
      toast({ title: t('users.deleteUser') })
      setDeleteUserDialog({ open: false, user: null })
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const handleRoleChange = (user: CompanyUser, role: 'admin' | 'user') => {
    if (isProtectedAdmin(user) && role !== 'admin') {
      toast({
        title: t('admin.actionBlocked'),
        description: t('admin.cannotChangeFirstAdminRole'),
        variant: 'destructive',
      })
      return
    }
    updateUserRoleMutation.mutate({ userId: user.id, role })
  }

  const handleBlockToggle = (user: CompanyUser, checked: boolean) => {
    if (isProtectedAdmin(user) && !checked) {
      toast({
        title: t('admin.actionBlocked'),
        description: t('admin.cannotBlockFirstAdmin'),
        variant: 'destructive',
      })
      return
    }
    toggleUserBlockedMutation.mutate({ userId: user.id, isBlocked: !checked })
  }

  const handleDeleteRequest = (user: CompanyUser) => {
    if (isProtectedAdmin(user)) {
      toast({
        title: t('admin.actionBlocked'),
        description: t('admin.cannotDeleteFirstAdmin'),
        variant: 'destructive',
      })
      return
    }
    setDeleteUserDialog({ open: true, user })
  }

  const stats = useMemo(() => {
    const users = usersQuery.data || []
    const quotas = quotasQuery.data || []
    
    const userQuota = quotas.find((q) => q.quota_type === 'users')
    const invoiceQuota = quotas.find((q) => q.quota_type === 'invoices')

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => !u.is_blocked).length,
      adminUsers: users.filter((u) => u.role === 'admin').length,
      userQuotaUsage: userQuota?.percentage_used || 0,
      invoiceQuotaUsage: invoiceQuota?.percentage_used || 0,
    }
  }, [usersQuery.data, quotasQuery.data])

  const createUserMutation = useMutation({
    mutationFn: async (payload: typeof createUserDialog) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          full_name: payload.fullName,
          company_id: companyId,
          role: payload.role,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'User creation failed')
      return data
    },
    onSuccess: async (data) => {
      toast({ title: t('admin.userCreated'), description: t('admin.newUserAddedSuccessfully') })
      if (user?.id) {
        await logActivity({
          actorId: user.id,
          actionType: 'user_created',
          description: t('admin.newUserCreatedLog', { email: createUserDialog.email }),
          metadata: { target_user_id: data.profile?.id, email: createUserDialog.email },
        })
      }
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
      queryClient.invalidateQueries({ queryKey: ['company_quotas', companyId] })
      setCreateUserDialog({ open: false, email: '', password: '', fullName: '', role: 'user' })
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' })
    },
  })

  const toggleUserBlockedMutation = useMutation({
    mutationFn: async ({ userId, isBlocked }: { userId: string; isBlocked: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: isBlocked })
        .eq('id', userId)
      if (error) throw error
      return { userId, isBlocked }
    },
    onSuccess: async (data) => {
      if (user?.id) {
        const targetUser = usersQuery.data?.find((u) => u.id === data.userId)
        await logActivity({
          actorId: user.id,
          actionType: data.isBlocked ? 'user_blocked' : 'user_unblocked',
          description: data.isBlocked ? t('admin.userBlocked', { name: targetUser?.email }) : t('admin.userUnblocked', { name: targetUser?.email }),
          metadata: { target_user_id: data.userId, is_blocked: data.isBlocked },
        })
      }
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
    },
  })

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'user' }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (error) throw error
      return { userId, role }
    },
    onSuccess: async (data) => {
      if (user?.id) {
        const targetUser = usersQuery.data?.find((u) => u.id === data.userId)
        await logActivity({
          actorId: user.id,
          actionType: 'role_changed',
          description: t('admin.roleChangedLog', { email: targetUser?.email, role: data.role }),
          metadata: { target_user_id: data.userId, new_role: data.role },
        })
      }
      queryClient.invalidateQueries({ queryKey: ['company_users', companyId] })
    },
  })

  function getQuotaColor(percentage: number) {
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 70) return 'text-orange-400'
    return 'text-green-400'
  }

  if (!companyId) {
    return (
      <AppLayout title={t('nav.companyManagement')}>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{t('admin.companyNotFound')}</h3>
            <p className="text-muted-foreground">
              {t('admin.mustBeLinkedToCompany')}
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('nav.companyManagement')}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{companyName} {t('admin.managementPanel')}</h1>
          <p className="text-muted-foreground">{t('admin.manageCompanyUsersAndSettings')}</p>
        </div>

        {/* Stats Cards - Grid Mobile Fix */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.totalUsers')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.activeUsers} {t('common.active')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.adminUsers')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.adminUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.userQuota')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getQuotaColor(stats.userQuotaUsage)}`}>
                %{stats.userQuotaUsage.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('admin.usageRate')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('admin.invoiceQuota')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getQuotaColor(stats.invoiceQuotaUsage)}`}>
                %{stats.invoiceQuotaUsage.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('admin.usageRate')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quota Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('admin.quotaDetails')}
            </CardTitle>
            <CardDescription>{t('admin.companyResourceLimits')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quotasQuery.data?.map((quota) => {
                const isUnlimited = quota.quota_limit === -1
                return (
                  <div key={quota.quota_type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">
                        {quota.quota_type === 'users' && t('table.users')}
                        {quota.quota_type === 'invoices' && t('nav.invoices')}
                        {quota.quota_type === 'customers' && t('nav.customers')}
                      </span>
                      <span className={isUnlimited ? 'text-green-600 font-semibold' : getQuotaColor(quota.percentage_used)}>
                        {quota.current_usage} / {isUnlimited ? '∞' : quota.quota_limit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isUnlimited
                            ? 'bg-green-500'
                            : quota.percentage_used >= 90
                            ? 'bg-red-500'
                            : quota.percentage_used >= 70
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: isUnlimited ? '100%' : `${Math.min(quota.percentage_used, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Users Management */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('admin.userManagement')}
                </CardTitle>
                <CardDescription className="mt-1">{t('admin.viewAndManageCompanyUsers')}</CardDescription>
              </div>
              <div className="flex w-full sm:w-auto gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('admin.searchUser')}
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="pl-9 w-full sm:w-[200px]"
                  />
                </div>
                <Button onClick={() => setCreateUserDialog({ ...createUserDialog, open: true })}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.newUser')}</span>
                  <span className="sm:hidden">{t('common.add')}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Table Mobile Fix: overflow-x-auto & min-width */}
            <div className="rounded-lg border overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">{t('common.user')}</TableHead>
                    <TableHead className="font-semibold">{t('users.role')}</TableHead>
                    <TableHead className="font-semibold">{t('table.status')}</TableHead>
                    <TableHead className="text-right font-semibold">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {searchUser ? t('admin.noUsersFound') : t('admin.noUsersYet')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
                              {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
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
                            onValueChange={(role: 'admin' | 'user') => handleRoleChange(user, role)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">{t('roles.user')}</SelectItem>
                              <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!user.is_blocked}
                              onCheckedChange={(checked) => handleBlockToggle(user, checked)}
                              disabled={isProtectedAdmin(user)}
                            />
                            {user.is_blocked ? (
                              <Badge variant="destructive">{t('admin.blocked')}</Badge>
                            ) : (
                              <Badge variant="default">{t('common.active')}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditUserDialog({
                                  open: true,
                                  user,
                                  fullName: user.full_name || '',
                                })
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setResetPasswordDialog({ open: true, user, newPassword: '' })}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRequest(user)}
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

        {/* Permission Matrix */}
        <div className="rounded-xl border bg-card p-6 overflow-x-auto">
          <PermissionMatrix
            companyId={companyId}
            companyName={companyName ?? t('admin.defaultCompanyName')}
            onUpdated={() => {
              refreshPermissions()
            }}
          />
        </div>

        {/* Create User Dialog */}
        <Dialog
          open={createUserDialog.open}
          onOpenChange={(open) =>
            !open && setCreateUserDialog({ open: false, email: '', password: '', fullName: '', role: 'user' })
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.createNewUser')}</DialogTitle>
              <DialogDescription>{t('admin.addNewUserToCompany')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('common.email')}</Label>
                <Input
                  type="email"
                  value={createUserDialog.email}
                  onChange={(e) => setCreateUserDialog({ ...createUserDialog, email: e.target.value })}
                  placeholder={t('forms.emailPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('forms.fullName')}</Label>
                <Input
                  value={createUserDialog.fullName}
                  onChange={(e) => setCreateUserDialog({ ...createUserDialog, fullName: e.target.value })}
                  placeholder={t('forms.fullNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('auth.password')}</Label>
                <Input
                  type="password"
                  value={createUserDialog.password}
                  onChange={(e) => setCreateUserDialog({ ...createUserDialog, password: e.target.value })}
                  placeholder={t('auth.minCharacters', { count: 6 })}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('users.role')}</Label>
                <Select
                  value={createUserDialog.role}
                  onValueChange={(role: 'admin' | 'user') =>
                    setCreateUserDialog({ ...createUserDialog, role })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t('roles.user')}</SelectItem>
                    <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setCreateUserDialog({ open: false, email: '', password: '', fullName: '', role: 'user' })
                }
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => createUserMutation.mutate(createUserDialog)}
                disabled={
                  !createUserDialog.email ||
                  !createUserDialog.password ||
                  createUserDialog.password.length < 6 ||
                  createUserMutation.isPending
                }
              >
                {t('common.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog
          open={editUserDialog.open}
          onOpenChange={(open) => !open && setEditUserDialog({ open: false, user: null, fullName: '' })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.userInfo')}</DialogTitle>
              <DialogDescription>{t('admin.updateUserDisplayName')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>{t('forms.fullName')}</Label>
                <Input
                  className="mt-1"
                  value={editUserDialog.fullName}
                  onChange={(e) => setEditUserDialog((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder={t('forms.fullNamePlaceholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditUserDialog({ open: false, user: null, fullName: '' })}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() =>
                  editUserDialog.user &&
                  updateUserNameMutation.mutate({
                    userId: editUserDialog.user.id,
                    fullName: editUserDialog.fullName,
                  })
                }
                disabled={!editUserDialog.fullName.trim() || updateUserNameMutation.isPending}
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog
          open={resetPasswordDialog.open}
          onOpenChange={(open) => !open && setResetPasswordDialog({ open: false, user: null, newPassword: '' })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('auth.resetPassword')}</DialogTitle>
              <DialogDescription>{t('admin.setNewPasswordForUser')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>{t('auth.newPassword')}</Label>
                <Input
                  type="password"
                  className="mt-1"
                  value={resetPasswordDialog.newPassword}
                  onChange={(e) =>
                    setResetPasswordDialog((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  minLength={6}
                  placeholder="En az 6 karakter"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setResetPasswordDialog({ open: false, user: null, newPassword: '' })}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() =>
                  resetPasswordDialog.user &&
                  resetPasswordMutation.mutate({
                    userId: resetPasswordDialog.user.id,
                    newPassword: resetPasswordDialog.newPassword,
                  })
                }
                disabled={
                  !resetPasswordDialog.newPassword ||
                  resetPasswordDialog.newPassword.length < 6 ||
                  resetPasswordMutation.isPending
                }
              >
                {t('admin.updatePassword')}
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
              <DialogTitle>{t('admin.deleteUserTitle')}</DialogTitle>
              <DialogDescription>
                {t('admin.deleteUserDescription')}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('admin.deleteUserConfirm', { email: deleteUserDialog.user?.email ?? '' })}
            </p>
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
                  deleteUserDialog.user && deleteCompanyUserMutation.mutate(deleteUserDialog.user.id)
                }
                disabled={deleteCompanyUserMutation.isPending}
              >
                {t('common.deleteConfirmAction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}