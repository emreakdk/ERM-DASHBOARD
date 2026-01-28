import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
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
import { useToast } from '../../components/ui/use-toast'
import { CreateUserDialog } from '../../components/admin/CreateUserDialog'
import { CompanyLogoUpload } from '../../components/admin/CompanyLogoUpload'
import { PermissionMatrix } from '../../components/admin/PermissionMatrix'
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
import {
  fetchAdminCompanies,
  fetchAdminProfiles,
  fetchSystemActivityLogs,
  fetchSystemUptimeSeconds,
  type AdminCompanyRecord,
  type AdminProfileRow,
} from './adminQueries'
import { deleteUser, resetUserPassword, updateUserProfile } from './userManagement'
import { supabase } from '../../lib/supabase'

function formatDate(value?: string | null) {
  if (!value) return '-'
  try {
    return format(new Date(value), 'dd.MM.yyyy HH:mm', { locale: tr })
  } catch {
    return value
  }
}

function formatUptime(seconds?: number | null) {
  if (seconds === undefined || seconds === null) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days) parts.push(`${days}g`)
  if (hours) parts.push(`${hours}s`)
  if (minutes) parts.push(`${minutes}dk`)
  if (!parts.length) parts.push(`${seconds % 60}sn`)
  return parts.join(' ')
}

function getErrorMessage(error: unknown) {
  if (!error) return 'Bilinmeyen hata'
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error)
}

export function NewAdminPanelPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

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
  }>({ open: false, company: null, name: '' })

  const companyQuery = useQuery({
    queryKey: ['admin_companies_v2'],
    queryFn: fetchAdminCompanies,
  })

  const profileQuery = useQuery({
    queryKey: ['admin_profiles_v2'],
    queryFn: fetchAdminProfiles,
  })

  const uptimeQuery = useQuery({
    queryKey: ['system_uptime_v2'],
    queryFn: fetchSystemUptimeSeconds,
  })

  const activityQuery = useQuery({
    queryKey: ['system_activity_v2'],
    queryFn: () => fetchSystemActivityLogs(8),
  })

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

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast({ title: 'Kullanıcı silindi', description: 'Kullanıcı kalıcı olarak sistemden kaldırıldı.' })
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_v2'] })
      setDeleteUserDialog({ open: false, user: null })
    },
    onError: (error) => {
      toast({ title: 'Hata', description: getErrorMessage(error), variant: 'destructive' })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      resetUserPassword(userId, password),
    onSuccess: () => {
      toast({ title: 'Şifre sıfırlandı', description: 'Kullanıcı şifresi başarıyla güncellendi.' })
      setResetPasswordDialog({ open: false, user: null, newPassword: '' })
    },
    onError: (error) => {
      toast({ title: 'Hata', description: getErrorMessage(error), variant: 'destructive' })
    },
  })

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, name, logoUrl }: { id: string; name: string; logoUrl?: string }) => {
      const payload: { name: string; logo_url?: string | null } = {
        name,
      }
      if (logoUrl !== undefined) {
        payload.logo_url = logoUrl || null
      }
      const { error } = await supabase.from('companies').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: 'Şirket güncellendi' })
      queryClient.invalidateQueries({ queryKey: ['admin_companies_v2'] })
      setEditCompanyDialog({ open: false, company: null, name: '' })
    },
    onError: (error) => {
      toast({ title: 'Hata', description: getErrorMessage(error), variant: 'destructive' })
    },
  })

  const toggleCompanyActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('companies').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_companies_v2'] })
    },
  })

  const toggleUserBlockedMutation = useMutation({
    mutationFn: async ({ id, isBlocked }: { id: string; isBlocked: boolean }) => {
      await updateUserProfile(id, { is_blocked: isBlocked })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_v2'] })
    },
  })

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'admin' | 'user' | 'superadmin' }) => {
      await updateUserProfile(id, { role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_v2'] })
    },
  })

  const updateUserCompanyMutation = useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string | null }) => {
      await updateUserProfile(id, { company_id: companyId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_profiles_v2'] })
    },
  })

  const hasErrors =
    companyQuery.error || profileQuery.error || uptimeQuery.error || activityQuery.error

  return (
    <SystemAdminLayout
      title="Master Brain Panel"
      description="Profesyonel SaaS yönetim merkezi"
    >
      <div className="space-y-6">
        {/* Theme Toggle - Removed, now in SystemAdminLayout */}

        {/* Error Alerts */}
        {hasErrors && (
          <Alert variant="destructive">
            <AlertTitle>Veri yükleme hatası</AlertTitle>
            <AlertDescription>
              {companyQuery.error && <div>Şirketler: {getErrorMessage(companyQuery.error)}</div>}
              {profileQuery.error && <div>Kullanıcılar: {getErrorMessage(profileQuery.error)}</div>}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Şirket</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">{stats.activeCompanies} aktif</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">{stats.blockedUsers} engelli</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sistem Uptime</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatUptime(uptimeQuery.data)}</div>
              <p className="text-xs text-muted-foreground">Kesintisiz çalışma</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">İşlem Hacmi</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">Toplam kayıt</p>
            </CardContent>
          </Card>
        </div>

        {/* Companies Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Şirket Yönetimi
                </CardTitle>
                <CardDescription>Tüm şirketleri görüntüleyin ve yönetin</CardDescription>
              </div>
              <Button
                onClick={() => {
                  /* Create company dialog */
                }}
              >
                Yeni Şirket
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şirket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Kullanıcılar</TableHead>
                  <TableHead>Kayıtlar</TableHead>
                  <TableHead>Oluşturulma</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyQuery.data?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt={company.name}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            company.name?.charAt(0).toUpperCase() ?? '?'
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-xs text-muted-foreground">{company.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={company.is_active ?? true}
                          onCheckedChange={(checked) =>
                            toggleCompanyActiveMutation.mutate({ id: company.id, isActive: checked })
                          }
                        />
                        <Badge variant={company.is_active ? 'default' : 'secondary'}>
                          {company.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{company.userCount}</TableCell>
                    <TableCell>{company.transactionCount}</TableCell>
                    <TableCell>{formatDate(company.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditCompanyDialog({ open: true, company, name: company.name })
                          }
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCompanyForPermissions(company.id)}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Users Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Kullanıcı Yönetimi
                </CardTitle>
                <CardDescription>Tüm kullanıcıları görüntüleyin ve yönetin</CardDescription>
              </div>
              <CreateUserDialog />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Şirket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileQuery.data?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || 'İsimsiz'}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(role: 'admin' | 'user' | 'superadmin') =>
                          updateUserRoleMutation.mutate({ id: user.id, role })
                        }
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Kullanıcı</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.company_id || 'none'}
                        onValueChange={(value) =>
                          updateUserCompanyMutation.mutate({
                            id: user.id,
                            companyId: value === 'none' ? null : value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Şirket Yok —</SelectItem>
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
                            toggleUserBlockedMutation.mutate({ id: user.id, isBlocked: !checked })
                          }
                        />
                        {user.is_blocked ? (
                          <Badge variant="destructive">
                            <Ban className="mr-1 h-3 w-3" />
                            Engelli
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Aktif
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResetPasswordDialog({ open: true, user, newPassword: '' })
                          }
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteUserDialog({ open: true, user })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Son Aktiviteler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityQuery.data?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                >
                  <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p>{log.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actor?.full_name || log.actor?.email || 'Sistem'} •{' '}
                      {formatDate(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permission Matrix Dialog */}
      {selectedCompanyForPermissions && (
        <Dialog
          open={!!selectedCompanyForPermissions}
          onOpenChange={() => setSelectedCompanyForPermissions(null)}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>İzin Yönetimi</DialogTitle>
              <DialogDescription>
                Şirket için rol bazlı modül izinlerini yapılandırın
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
          !open && setEditCompanyDialog({ open: false, company: null, name: '' })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şirket Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Şirket Adı</Label>
              <Input
                value={editCompanyDialog.name}
                onChange={(e) =>
                  setEditCompanyDialog((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            {editCompanyDialog.company && (
              <div>
                <Label>Logo</Label>
                <CompanyLogoUpload
                  companyId={editCompanyDialog.company.id}
                  currentLogoUrl={editCompanyDialog.company.logo_url}
                  onUploadSuccess={(url) =>
                    updateCompanyMutation.mutate({
                      id: editCompanyDialog.company!.id,
                      name: editCompanyDialog.name,
                      logoUrl: url,
                    })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCompanyDialog({ open: false, company: null, name: '' })}
            >
              İptal
            </Button>
            <Button
              onClick={() =>
                editCompanyDialog.company &&
                updateCompanyMutation.mutate({
                  id: editCompanyDialog.company.id,
                  name: editCompanyDialog.name,
                })
              }
            >
              Kaydet
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
            <DialogTitle>Kullanıcıyı Sil</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Kullanıcı kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            <strong>{deleteUserDialog.user?.full_name || deleteUserDialog.user?.email}</strong>{' '}
            kullanıcısını silmek istediğinizden emin misiniz?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteUserDialog({ open: false, user: null })}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteUserDialog.user && deleteUserMutation.mutate(deleteUserDialog.user.id)
              }
            >
              Sil
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
            <DialogTitle>Şifre Sıfırla</DialogTitle>
            <DialogDescription>
              Kullanıcı için yeni bir şifre belirleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kullanıcı</Label>
              <Input
                value={resetPasswordDialog.user?.full_name || resetPasswordDialog.user?.email || ''}
                disabled
              />
            </div>
            <div>
              <Label>Yeni Şifre</Label>
              <Input
                type="password"
                value={resetPasswordDialog.newPassword}
                onChange={(e) =>
                  setResetPasswordDialog((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                placeholder="Minimum 6 karakter"
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
              İptal
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
              Şifreyi Sıfırla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SystemAdminLayout>
  )
}
