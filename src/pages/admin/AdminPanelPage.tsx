import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Clock3,
  Factory,
  Globe2,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  Users2,
} from 'lucide-react'
import { SystemAdminLayout } from '../../components/layout/SystemAdminLayout'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { useToast } from '../../components/ui/use-toast'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { cn } from '../../lib/utils'
import {
  fetchAdminCompanies,
  fetchAdminProfiles,
  fetchSystemActivityLogs,
  fetchSystemUptimeSeconds,
} from './adminQueries'
import type { AdminActivityLog, AdminCompanyRecord, AdminProfileRow } from './adminQueries'
import { supabase } from '../../lib/supabase'

function formatDate(value?: string | null) {
  if (!value) return '-'
  try {
    return format(new Date(value), 'dd.MM.yyyy HH:mm')
  } catch {
    return value
  }
}

function formatRelativeTime(value?: string | null) {
  if (!value) return '—'
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: tr })
  } catch {
    return value ?? '—'
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

type StatCardProps = {
  label: string
  value: string | number | React.ReactNode
  subLabel?: string
  icon: LucideIcon
  accent: string
}

function StatCard({ label, value, subLabel, icon: Icon, accent }: StatCardProps) {
  return (
    <Card className="border-white/10 bg-white/[0.02] text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.3em] text-white/60">
          {label}
        </CardDescription>
        <div
          className={cn(
            'rounded-2xl border border-white/20 bg-gradient-to-br p-2 text-white',
            accent
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {subLabel && <p className="mt-2 text-sm text-white/60">{subLabel}</p>}
      </CardContent>
    </Card>
  )
}

type ActivityPanelProps = {
  logs: AdminActivityLog[]
  loading: boolean
  error?: unknown
}

function SystemActivityPanel({ logs, loading, error }: ActivityPanelProps) {
  return (
    <section
      id="system-logs"
      className="rounded-3xl border border-white/10 bg-white/[0.015] p-6 text-white"
    >
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">System Logs</p>
          <h3 className="mt-2 text-2xl font-semibold">Son Merkezi İşlemler</h3>
          <p className="text-sm text-white/60">
            Supabase platformu genelindeki kritik değişiklikler gerçek zamanlı olarak akıyor.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit bg-white/10 text-white">
          <Activity className="mr-2 h-3.5 w-3.5" />
          Canlı İzleme
        </Badge>
      </div>
      <div className="space-y-3">
        {error ? (
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 text-red-100">
            <AlertTitle>Aktivite kayıtları yüklenemedi</AlertTitle>
            <AlertDescription>{getErrorMessage(error)}</AlertDescription>
          </Alert>
        ) : loading ? (
          [...Array(5)].map((_, index) => (
            <div
              key={`log-skeleton-${index}`}
              className="h-16 animate-pulse rounded-2xl bg-white/5"
            />
          ))
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            Kayıt bulunamadı. Aktivite oluştuğunda burada göreceksiniz.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium">{log.message}</p>
                <p className="text-sm text-white/60">
                  {log.actor?.full_name ?? 'Bilinmeyen Kullanıcı'} · {log.actor?.email ?? 'E-posta yok'}
                </p>
              </div>
              <div className="text-xs text-white/50">{formatRelativeTime(log.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

type FormState = {
  name: string
  logoUrl: string
}

function AdminCompaniesSection() {
  const { toast } = useToast()
  const companyQuery = useQuery({
    queryKey: ['admin_companies'],
    queryFn: fetchAdminCompanies,
  })

  const [createForm, setCreateForm] = useState<FormState>({ name: '', logoUrl: '' })
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<FormState>({ name: '', logoUrl: '' })
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const resetEditing = () => {
    setEditingCompanyId(null)
    setEditingForm({ name: '', logoUrl: '' })
  }

  const handleCreate = async () => {
    const payload = {
      name: createForm.name.trim(),
      logo_url: createForm.logoUrl.trim() || null,
    }
    if (!payload.name) {
      toast({ title: 'Şirket adı zorunlu', variant: 'destructive' })
      return
    }

    try {
      setLoadingAction('create')
      const { error } = await supabase.from('companies').insert(payload)
      if (error) throw error
      toast({ title: 'Yeni şirket eklendi' })
      setCreateForm({ name: '', logoUrl: '' })
      await companyQuery.refetch()
    } catch (error) {
      toast({
        title: 'Şirket oluşturulamadı',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleEditStart = (company: AdminCompanyRecord) => {
    setEditingCompanyId(company.id)
    setEditingForm({ name: company.name ?? '', logoUrl: company.logo_url ?? '' })
  }

  const handleUpdate = async () => {
    if (!editingCompanyId) return
    const payload = {
      name: editingForm.name.trim(),
      logo_url: editingForm.logoUrl.trim() || null,
    }
    if (!payload.name) {
      toast({ title: 'Şirket adı zorunlu', variant: 'destructive' })
      return
    }

    try {
      setLoadingAction(`update:${editingCompanyId}`)
      const { error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', editingCompanyId)
      if (error) throw error
      toast({ title: 'Şirket bilgileri güncellendi' })
      resetEditing()
      await companyQuery.refetch()
    } catch (error) {
      toast({
        title: 'Şirket güncellenemedi',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleToggleActive = async (company: AdminCompanyRecord, nextState: boolean) => {
    try {
      setLoadingAction(`toggle:${company.id}`)
      const { error } = await supabase
        .from('companies')
        .update({ is_active: nextState })
        .eq('id', company.id)
      if (error) throw error
      toast({
        title: nextState ? 'Şirket yeniden aktif' : 'Şirket erişimi kapatıldı',
        description: company.name ?? company.id,
      })
      await companyQuery.refetch()
    } catch (error) {
      toast({
        title: 'Durum değiştirilemedi',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoadingAction(null)
    }
  }

  const isBusy = (key: string) => loadingAction === key

  return (
    <section id="companies" className="space-y-6">
      <div className="rounded-3xl border border-white/15 bg-white/[0.02] p-6 text-white">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-white/40">Company Factory</p>
            <h3 className="text-3xl font-semibold">Tenant kayıtları fabrikan</h3>
            <p className="text-sm text-white/60">
              Yeni şirketler aç, logoları düzenle, tek tıkla erişimi kes. Kullanıcı ve işlem hacmi anında
              görünür.
            </p>
          </div>
          <div className="grid w-full gap-3 md:grid-cols-2 lg:max-w-lg">
            <Input
              placeholder="Şirket adı"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              className="bg-white/5 text-white placeholder:text-white/40"
            />
            <Input
              placeholder="Logo URL (opsiyonel)"
              value={createForm.logoUrl}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
              className="bg-white/5 text-white placeholder:text-white/40"
            />
            <Button
              className="md:col-span-2"
              onClick={handleCreate}
              disabled={!createForm.name.trim() || isBusy('create')}
            >
              {isBusy('create') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Şirket Ekle
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/70">Şirket</TableHead>
                <TableHead className="text-white/70">Durum</TableHead>
                <TableHead className="text-white/70">Hacim</TableHead>
                <TableHead className="text-white/70">Oluşturulma</TableHead>
                <TableHead className="text-white/70">Güncelleme</TableHead>
                <TableHead className="text-right text-white/70">Kontrol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyQuery.error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-200">
                    {getErrorMessage(companyQuery.error)}
                  </TableCell>
                </TableRow>
              ) : companyQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-white/60">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : (companyQuery.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-white/60">
                    Henüz kayıtlı şirket yok
                  </TableCell>
                </TableRow>
              ) : (
                (companyQuery.data ?? []).map((company) => {
                  const editing = editingCompanyId === company.id
                  const active = company.is_active ?? true
                  return (
                    <TableRow
                      key={company.id}
                      className={cn('border-white/5 transition', !active && 'opacity-60')}
                    >
                      <TableCell className="text-white">
                        {editing ? (
                          <div className="space-y-2">
                            <Input
                              value={editingForm.name}
                              onChange={(e) =>
                                setEditingForm((prev) => ({ ...prev, name: e.target.value }))
                              }
                              className="bg-white/5 text-white placeholder:text-white/40"
                            />
                            <Input
                              value={editingForm.logoUrl}
                              onChange={(e) =>
                                setEditingForm((prev) => ({ ...prev, logoUrl: e.target.value }))
                              }
                              placeholder="Logo URL"
                              className="bg-white/5 text-white placeholder:text-white/40"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-indigo-500/10 text-lg font-semibold text-white">
                              {company.logo_url ? (
                                <img
                                  src={company.logo_url}
                                  alt={company.name}
                                  className="h-full w-full rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    if (e.currentTarget.nextSibling) {
                                      (e.currentTarget.nextSibling as HTMLElement).style.display = 'flex'
                                    }
                                  }}
                                />
                              ) : null}
                              <span
                                className="flex h-full w-full items-center justify-center"
                                style={{ display: company.logo_url ? 'none' : 'flex' }}
                              >
                                {company.name?.charAt(0).toUpperCase() ?? '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold">{company.name}</p>
                              <p className="text-xs text-white/50">{company.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Badge variant={active ? 'secondary' : 'destructive'}>
                            {active ? 'Aktif' : 'Devre Dışı'}
                          </Badge>
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <span>Kapalı</span>
                            <Switch
                              checked={active}
                              onCheckedChange={(checked) => handleToggleActive(company, checked)}
                              disabled={isBusy(`toggle:${company.id}`)}
                            />
                            <span>Açık</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-white/80">
                        <p className="text-sm font-semibold">{company.userCount} kullanıcı</p>
                        <p className="text-xs text-white/60">{company.transactionCount} kayıt</p>
                      </TableCell>
                      <TableCell className="text-white/70">{formatDate(company.created_at)}</TableCell>
                      <TableCell className="text-white/70">{formatDate(company.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetEditing}
                              disabled={isBusy(`update:${company.id}`)}
                            >
                              İptal
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleUpdate}
                              disabled={!editingForm.name.trim() || isBusy(`update:${company.id}`)}
                            >
                              Kaydet
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleEditStart(company)}>
                            Düzenle
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

function AdminUsersSection() {
  const { toast } = useToast()
  const profileQuery = useQuery({
    queryKey: ['admin_profiles'],
    queryFn: fetchAdminProfiles,
  })
  const companiesQuery = useQuery({
    queryKey: ['admin_companies_for_users'],
    queryFn: fetchAdminCompanies,
  })

  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const companyOptions = useMemo(() => {
    return (companiesQuery.data ?? [])
      .filter((company) => typeof company.id === 'string' && company.id.length > 0)
      .map((company) => ({
        value: company.id,
        label: company.name || company.id,
      }))
  }, [companiesQuery.data])

  const updateUser = useCallback(
    async (id: string, payload: Partial<AdminProfileRow>, pendingMarker: string = id) => {
      try {
        setPendingKey(pendingMarker)
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', id)
        if (error) throw error
        toast({ title: 'Kullanıcı güncellendi' })
        await profileQuery.refetch()
      } catch (error) {
        toast({
          title: 'Kullanıcı güncellenemedi',
          description: getErrorMessage(error),
          variant: 'destructive',
        })
      } finally {
        setPendingKey(null)
      }
    },
    [profileQuery, toast]
  )

  const handlePasswordReset = useCallback(
    async (email: string) => {
      try {
        setPendingKey(`password:${email}`)
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        })
        if (error) throw error
        toast({ title: 'Parola sıfırlama e-postası gönderildi' })
      } catch (error) {
        toast({
          title: 'Parola sıfırlanamadı',
          description: getErrorMessage(error),
          variant: 'destructive',
        })
      } finally {
        setPendingKey(null)
      }
    },
    [toast]
  )

  const isPending = (key: string) => pendingKey === key

  return (
    <section id="users" className="space-y-6">
      <div className="rounded-3xl border border-white/15 bg-white/[0.02] p-6 text-white">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">Global User Authority</p>
          <h3 className="text-3xl font-semibold">God Mode erişim matrisi</h3>
          <p className="text-sm text-white/60">
            Rol atayın, şirket değiştirin, parola sıfırlayın ve tek tıkla hesap engelleyin.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/70">Kullanıcı</TableHead>
                <TableHead className="text-white/70">Rol</TableHead>
                <TableHead className="text-white/70">Şirket</TableHead>
                <TableHead className="text-white/70">Erişim</TableHead>
                <TableHead className="text-right text-white/70">Kontroller</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profileQuery.error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-red-200">
                    {getErrorMessage(profileQuery.error)}
                  </TableCell>
                </TableRow>
              ) : profileQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-white/60">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : (profileQuery.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-white/60">
                    Kullanıcı bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                (profileQuery.data ?? []).map((profile) => (
                  <TableRow key={profile.id} className="border-white/5">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{profile.full_name ?? 'İsimsiz Kullanıcı'}</p>
                          <Badge variant="outline" className="text-xs uppercase">
                            {profile.role ?? 'user'}
                          </Badge>
                          {profile.is_blocked && (
                            <Badge variant="destructive" className="text-xs uppercase">
                              Bloklu
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/60">{profile.email}</p>
                        <p className="text-xs text-white/50">
                          {formatRelativeTime(profile.created_at)} giriş yaptı
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={profile.role ?? 'user'}
                        onValueChange={(value) =>
                          updateUser(profile.id, { role: value as AdminProfileRow['role'] })
                        }
                        disabled={isPending(profile.id)}
                      >
                        <SelectTrigger className="w-[160px] bg-white/5 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">Süper Admin</SelectItem>
                          <SelectItem value="admin">Yönetici</SelectItem>
                          <SelectItem value="user">Kullanıcı</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const normalizedCompanyId =
                          profile.company_id && profile.company_id.trim().length > 0
                            ? profile.company_id
                            : undefined
                        return (
                          <Select
                            value={normalizedCompanyId}
                            onValueChange={(value) =>
                              updateUser(
                                profile.id,
                                { company_id: value === 'none' ? null : value },
                                `company:${profile.id}`
                              )
                            }
                            disabled={isPending(`company:${profile.id}`)}
                          >
                            <SelectTrigger className="w-[220px] bg-white/5 text-white">
                              <SelectValue placeholder="Şirket seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Şirket Yok —</SelectItem>
                              {companyOptions.map((company) => {
                                if (!company.value) return null
                                return (
                                  <SelectItem key={company.value} value={company.value}>
                                    {company.label}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={!profile.is_blocked}
                          onCheckedChange={(checked) =>
                            updateUser(
                              profile.id,
                              { is_blocked: !checked },
                              `block:${profile.id}`
                            )
                          }
                          disabled={isPending(`block:${profile.id}`)}
                        />
                        <span className="text-xs text-white/60">
                          {profile.is_blocked ? 'Erişim kapalı' : 'Erişim açık'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePasswordReset(profile.email)}
                        disabled={isPending(`password:${profile.email}`)}
                      >
                        {isPending(`password:${profile.email}`) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="mr-2 h-4 w-4" />
                        )}
                        Parola Sıfırla
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

export function AdminPanelPage() {
  const companyQuery = useQuery({
    queryKey: ['admin_companies_dashboard'],
    queryFn: fetchAdminCompanies,
  })
  const profileQuery = useQuery({
    queryKey: ['admin_profiles_dashboard'],
    queryFn: fetchAdminProfiles,
  })
  const uptimeQuery = useQuery({
    queryKey: ['system_uptime_seconds'],
    queryFn: fetchSystemUptimeSeconds,
    staleTime: 30_000,
  })
  const activityQuery = useQuery({
    queryKey: ['system_activity_logs'],
    queryFn: () => fetchSystemActivityLogs(12),
    staleTime: 60_000,
  })

  const stats = useMemo(() => {
    const companies = companyQuery.data ?? []
    const users = profileQuery.data ?? []
    const totalTransactions = companies.reduce((sum, company) => sum + company.transactionCount, 0)
    const activeCompanies = companies.filter((company) => company.is_active !== false).length
    const superAdmins = users.filter((user) => user.role === 'superadmin').length
    const blockedUsers = users.filter((user) => user.is_blocked).length

    return {
      activeCompanies,
      totalCompanies: companies.length,
      userCount: users.length,
      superAdminCount: superAdmins,
      transactionCount: totalTransactions,
      blockedUsers,
    }
  }, [companyQuery.data, profileQuery.data])

  const uptimeLabel = uptimeQuery.isLoading ? 'Hesaplanıyor' : formatUptime(uptimeQuery.data)
  const latestLogTime = activityQuery.data?.[0]?.created_at

  const errorSources = [
    { id: 'companies', label: 'Şirket verileri', error: companyQuery.error },
    { id: 'profiles', label: 'Kullanıcı verileri', error: profileQuery.error },
    { id: 'uptime', label: 'Uptime ölçümü', error: uptimeQuery.error },
    { id: 'activity', label: 'Aktivite kayıtları', error: activityQuery.error },
  ]
  const hasErrors = errorSources.some((item) => Boolean(item.error))

  return (
    <SystemAdminLayout
      title="Master Brain Panel"
      description="Supabase SaaS platformundaki tüm tenantlar, kullanıcılar ve işlemler için sistem seviyesinde kontrol odası."
    >
      {hasErrors && (
        <div className="mb-6 space-y-3">
          {errorSources.map((source) =>
            source.error ? (
              <Alert
                key={source.id}
                variant="destructive"
                className="border-red-500/50 bg-red-500/10 text-red-100"
              >
                <AlertTitle>{source.label} yüklenemedi</AlertTitle>
                <AlertDescription>{getErrorMessage(source.error)}</AlertDescription>
              </Alert>
            ) : null
          )}
        </div>
      )}
      <section id="overview" className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/70 p-8 text-white shadow-[0_0_60px_rgba(79,70,229,0.25)]">
          <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">System Oversight</p>
              <h2 className="text-4xl font-semibold leading-tight">
                Master Brain · Superset Command Deck
              </h2>
              <p className="text-base text-white/70">
                Finansal grafikler yerine gerçek sistem telemetrisi: platformu oluşturan her tenantın
                sağlık durumunu, kullanıcı erişimlerini ve kritik olayları tek bakışta görün.
              </p>
              <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Globe2 className="h-4 w-4 text-emerald-300" />
                  Küresel tenant kayıtları ve durum bilgisi
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <ShieldAlert className="h-4 w-4 text-amber-300" />
                  Kritik log akışı ve kesintisiz uptime takibi
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">System Uptime</p>
              <p className="mt-4 text-4xl font-semibold">{uptimeLabel}</p>
              <p className="mt-2 text-sm text-white/70">
                Son sistem olayı {latestLogTime ? formatRelativeTime(latestLogTime) : 'henüz kayıt yok'}
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white/80">
                <Clock3 className="h-4 w-4" />
                Platform istikrarı her 60 saniyede bir tekrar ölçülür.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard
            label="Aktif Şirket"
            value={companyQuery.isLoading ? '—' : stats.activeCompanies}
            subLabel={
              companyQuery.isLoading ? 'Yükleniyor' : `${stats.totalCompanies} kayıtlı tenant`
            }
            icon={Factory}
            accent="from-indigo-500/40 to-indigo-500/10"
          />
          <StatCard
            label="Toplam Kullanıcı"
            value={profileQuery.isLoading ? '—' : stats.userCount}
            subLabel={
              profileQuery.isLoading
                ? 'Yükleniyor'
                : `${stats.superAdminCount} süper admin · ${stats.blockedUsers} bloklu`
            }
            icon={Users2}
            accent="from-emerald-500/40 to-emerald-500/10"
          />
          <StatCard
            label="Sistem Uptime"
            value={uptimeLabel}
            subLabel="Master Brain gözleminden bu yana"
            icon={Clock3}
            accent="from-amber-500/40 to-amber-500/10"
          />
          <StatCard
            label="Global İşlem"
            value={companyQuery.isLoading ? '—' : stats.transactionCount}
            subLabel="Invoice + transaction kayıtları"
            icon={Activity}
            accent="from-fuchsia-500/40 to-fuchsia-500/10"
          />
        </div>
      </section>

      <SystemActivityPanel
        logs={activityQuery.data ?? []}
        loading={activityQuery.isLoading}
        error={activityQuery.error}
      />

      <AdminCompaniesSection />
      <AdminUsersSection />
    </SystemAdminLayout>
  )
}
