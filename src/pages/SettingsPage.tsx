import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { AppLayout } from '../components/layout/AppLayout'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { toast } from '../components/ui/use-toast'
import { useTheme } from '../components/theme-provider'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useCategories, useCreateCategory, useDeleteCategory } from '../hooks/useSupabaseQuery'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { LogOut, Pencil, Plus, Trash2, Upload } from 'lucide-react'

type CategoryRow = Database['public']['Tables']['categories']['Row']

type CompanyProfileRow = Database['public']['Tables']['company_profiles']['Row']

export function SettingsPage() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { permissions } = usePermissions()
  
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [notifications, setNotifications] = useState(true)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [newIncomeCategory, setNewIncomeCategory] = useState('')
  const [newExpenseCategory, setNewExpenseCategory] = useState('')

  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false)

  const incomeCategoriesQuery = useCategories('income')
  const expenseCategoriesQuery = useCategories('expense')
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()

  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileInitialized, setProfileInitialized] = useState(false)

  const companyProfileQuery = useQuery<CompanyProfileRow | null>({
    queryKey: ['company_profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const userId = user?.id
      if (!userId) return null

      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<CompanyProfileRow>()

      if (error) {
        const errorCode = (error as PostgrestError | null)?.code
        if (errorCode === 'PGRST116') {
          return null
        }
        throw error
      }

      return data ?? null
    },
  })

  const getErrorMessage = useCallback(
    (error: unknown) => {
      if (error instanceof Error) {
        return error.message
      }
      if (typeof error === 'string') {
        return error
      }
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message
        if (typeof message === 'string') {
          return message
        }
      }
      return t('common.unexpectedError')
    },
    [t]
  )

  const {
    data: companyProfile,
    isLoading: isProfileLoading,
    isFetching: isProfileFetching,
    isError: isProfileError,
  } = companyProfileQuery

  useEffect(() => {
    if (profileInitialized) return

    if (isProfileLoading || isProfileFetching || isProfileError) return

    const profile = companyProfile
    if (!user) return

    setFullName(profile?.contact_name ?? '')
    setCompanyName(profile?.company_name ?? '')
    setContactEmail(profile?.contact_email ?? user.email ?? '')
    setPhone(profile?.contact_phone ?? '')
    setAddress(profile?.address ?? '')
    setWebsite(profile?.website ?? '')
    setLogoUrl(profile?.logo_url ?? '')

    setProfileInitialized(true)
  }, [companyProfile, isProfileError, isProfileFetching, isProfileLoading, profileInitialized, user])

  const canSaveCategoryEdit = useMemo(() => {
    return Boolean(editingCategory) && editingName.trim().length > 0 && !isUpdatingCategory
  }, [editingCategory, editingName, isUpdatingCategory])

  const handleUpdateCategory = async () => {
    if (!canEditSettings || !editingCategory) return
    const name = editingName.trim()
    if (!name) return

    try {
      setIsUpdatingCategory(true)
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', editingCategory.id)

      if (error) throw error

      toast({ title: t('settings.categoryUpdated') })
      setEditingCategory(null)
      setEditingName('')

      await Promise.all([incomeCategoriesQuery.refetch(), expenseCategoriesQuery.refetch()])
    } catch (error) {
      toast({
        title: t('settings.categoryUpdateFailed'),
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingCategory(false)
    }
  }

  const isDark = resolvedTheme === 'dark'
  const canEditSettings = permissions.settings?.edit ?? false

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      setIsSavingProfile(true)

      const payload: CompanyProfileRow = {
        user_id: user.id,
        company_name: companyName.trim() || null,
        logo_url: logoUrl.trim() || null,
        contact_name: fullName.trim() || null,
        contact_email: contactEmail.trim() || user.email || null,
        contact_phone: phone.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
      }

      const { error } = await supabase.from('company_profiles').upsert(payload, { onConflict: 'user_id' })
      if (error) throw error

      toast({ title: t('settings.companyProfileSaved') })
      setProfileInitialized(false)
      await companyProfileQuery.refetch()
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    if (!user) return
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
      const publicUrl = data.publicUrl
      setLogoUrl(publicUrl)

      toast({ title: t('settings.logoUploaded') })
    } catch (error) {
      toast({
        title: t('settings.logoUploadFailed'),
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleUpdatePassword = async () => {
    const password = newPassword
    const confirm = confirmPassword

    if (!password || !confirm) {
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: t('auth.pleaseFillAllFields'),
        variant: 'destructive',
      })
      return
    }

    if (password !== confirm) {
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: t('auth.passwordsDoNotMatch'),
        variant: 'destructive',
      })
      return
    }

    try {
      setIsUpdatingPassword(true)
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast({ title: t('auth.passwordUpdatedSuccessfully') })
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast({
        title: t('auth.passwordUpdateFailed'),
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <AppLayout title={t('nav.settings')}>
      <div className="space-y-6 max-w-4xl">
        {/* Profile & Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.profile.title')}</CardTitle>
            <CardDescription>{t('settings.profile.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full border border-border overflow-hidden bg-muted flex items-center justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt={t('settings.profile.logoLabel')} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xs text-muted-foreground">{t('settings.profile.logoLabel')}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t('settings.profile.logoLabel')}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.profile.logoHelper')}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    void handleLogoUpload(f)
                    e.currentTarget.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!user || !canEditSettings}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {t(logoUrl ? 'settings.profile.changeLogo' : 'settings.profile.uploadLogo')}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('forms.fullName')}</Label>
                <Input
                  id="fullName"
                  placeholder={t('forms.fullNamePlaceholder')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!canEditSettings}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">{t('forms.companyName')}</Label>
                <Input
                  id="companyName"
                  placeholder={t('forms.companyNamePlaceholder')}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!canEditSettings}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">{t('settings.profile.contactEmail')}</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder={t('settings.profile.contactEmailPlaceholder')}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!canEditSettings}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('common.phone')}</Label>
                <Input
                  id="phone"
                  placeholder={t('settings.profile.phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canEditSettings}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">{t('settings.profile.website')}</Label>
                <Input
                  id="website"
                  placeholder={t('settings.profile.websitePlaceholder')}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={!canEditSettings}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t('common.address')}</Label>
              <textarea
                id="address"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t('settings.profile.addressPlaceholder')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canEditSettings}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={!canEditSettings || isSavingProfile || companyProfileQuery.isFetching}>
                {t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>{t('settings.categories.title')}</CardTitle>
            <CardDescription>{t('settings.categories.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="income" className="w-full">
              <TabsList className="w-full rounded-xl bg-muted/60 p-1">
                <TabsTrigger className="flex-1 rounded-lg" value="income">
                  {t('settings.categories.incomeTab')}
                </TabsTrigger>
                <TabsTrigger className="flex-1 rounded-lg" value="expense">
                  {t('settings.categories.expenseTab')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="income" className="mt-4 transition-all duration-200">
                <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
                  <div className="flex items-center gap-2 border-b border-border/50 p-4">
                    <Input
                      placeholder={t('settings.categories.newIncomePlaceholder')}
                      value={newIncomeCategory}
                      onChange={(e) => setNewIncomeCategory(e.target.value)}
                      className="bg-muted/60 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={!canEditSettings}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!user || !canEditSettings || createCategory.isPending}
                      onClick={async () => {
                        const name = newIncomeCategory.trim()
                        if (!user || !canEditSettings || !name) return
                        try {
                          await createCategory.mutateAsync({
                            user_id: user.id,
                            name,
                            type: 'income',
                          })
                          setNewIncomeCategory('')
                          toast({ title: t('settings.categoryAdded') })
                        } catch (e) {
                          toast({
                            title: t('settings.categoryAddFailed'),
                            description: getErrorMessage(e),
                            variant: 'destructive',
                          })
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t('settings.categories.addButton')}
                    </Button>
                  </div>

                  {(incomeCategoriesQuery.data ?? []).length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">{t('settings.categories.empty')}</div>
                  ) : (
                    <div>
                      {(incomeCategoriesQuery.data ?? []).map((c, idx, arr) => (
                        <div
                          key={c.id}
                          className={
                            'flex items-center justify-between p-4' +
                            (idx !== arr.length - 1 ? ' border-b border-border/50' : '')
                          }
                        >
                          <span className="text-sm font-medium">{c.name}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={!canEditSettings || deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                              onClick={() => {
                                if (!canEditSettings) return
                                setEditingCategory(c)
                                setEditingName(c.name ?? '')
                              }}
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={!canEditSettings || deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={async () => {
                                if (!canEditSettings) return
                                try {
                                  await deleteCategory.mutateAsync({ id: c.id, itemName: c.name })
                                  toast({ title: t('settings.categoryDeleted') })
                                } catch (e) {
                                  toast({
                                    title: t('settings.categoryDeleteFailed'),
                                    description: getErrorMessage(e),
                                    variant: 'destructive',
                                  })
                                }
                              }}
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="expense" className="mt-4 transition-all duration-200">
                <div className="overflow-hidden rounded-2xl border border-border/50 bg-background">
                  <div className="flex items-center gap-2 border-b border-border/50 p-4">
                    <Input
                      placeholder={t('settings.categories.newExpensePlaceholder')}
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value)}
                      className="bg-muted/60 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={!canEditSettings}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!user || !canEditSettings || createCategory.isPending}
                      onClick={async () => {
                        const name = newExpenseCategory.trim()
                        if (!user || !canEditSettings || !name) return
                        try {
                          await createCategory.mutateAsync({
                            user_id: user.id,
                            name,
                            type: 'expense',
                          })
                          setNewExpenseCategory('')
                          toast({ title: t('settings.categoryAdded') })
                        } catch (e) {
                          toast({
                            title: t('settings.categoryAddFailed'),
                            description: getErrorMessage(e),
                            variant: 'destructive',
                          })
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t('settings.categories.addButton')}
                    </Button>
                  </div>

                  {(expenseCategoriesQuery.data ?? []).length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">{t('settings.categories.empty')}</div>
                  ) : (
                    <div>
                      {(expenseCategoriesQuery.data ?? []).map((c, idx, arr) => (
                        <div
                          key={c.id}
                          className={
                            'flex items-center justify-between p-4' +
                            (idx !== arr.length - 1 ? ' border-b border-border/50' : '')
                          }
                        >
                          <span className="text-sm font-medium">{c.name}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-600"
                              onClick={() => {
                                setEditingCategory(c)
                                setEditingName(c.name ?? '')
                              }}
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={deleteCategory.isPending || isUpdatingCategory}
                              className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={async () => {
                                try {
                                  await deleteCategory.mutateAsync({ id: c.id, itemName: c.name })
                                  toast({ title: t('settings.categoryDeleted') })
                                } catch (e) {
                                  toast({
                                    title: t('settings.categoryDeleteFailed'),
                                    description: getErrorMessage(e),
                                    variant: 'destructive',
                                  })
                                }
                              }}
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Dialog
              open={Boolean(editingCategory)}
              onOpenChange={(v) => {
                if (!v) {
                  setEditingCategory(null)
                  setEditingName('')
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('settings.categories.editDialogTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="editCategoryName">{t('settings.categories.nameLabel')}</Label>
                  <Input
                    id="editCategoryName"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder={t('settings.categories.namePlaceholder')}
                    disabled={!canEditSettings || isUpdatingCategory}
                  />
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(null)
                      setEditingName('')
                    }}
                    disabled={isUpdatingCategory}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateCategory}
                    disabled={!canEditSettings || !canSaveCategoryEdit}
                  >
                    {t('common.save')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.app.title')}</CardTitle>
            <CardDescription>{t('settings.app.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="darkMode">{t('settings.app.darkModeLabel')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.app.darkModeNote')}</p>
              </div>
              <button
                id="darkMode"
                role="switch"
                aria-checked={isDark}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isDark ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">{t('settings.app.notificationsLabel')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.app.notificationsNote')}</p>
              </div>
              <button
                id="notifications"
                role="switch"
                aria-checked={notifications}
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.security.title')}</CardTitle>
            <CardDescription>{t('settings.security.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('settings.security.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder={t('settings.security.newPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('settings.security.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('settings.security.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isUpdatingPassword}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
                {t('settings.security.updatePassword')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">{t('settings.session.title')}</CardTitle>
            <CardDescription>{t('settings.session.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              className="w-full sm:w-auto"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('settings.session.logoutButton')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
