import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { CustomerForm } from '../components/forms/CustomerForm'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { toast } from '../components/ui/use-toast'
import {
  useCustomers,
  useDeleteCustomer,
  useDeleteCustomerCascade,
  useConvertLeadToCustomer,
  useConvertCustomerToLead,
} from '../hooks/useSupabaseQuery'
import type { Database } from '../types/database'
import { Building2, ChevronRight, Pencil, Plus, RefreshCw, Search, Trash2, User, UserCheck } from 'lucide-react'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQuota } from '../hooks/useQuota'

type CustomerRow = Database['public']['Tables']['customers']['Row']

export function CustomersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRow | null>(null)
  const [cascadeDeletingCustomer, setCascadeDeletingCustomer] = useState<CustomerRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'customer' | 'lead'>('customer')
  const customersQuery = useCustomers()
  const deleteCustomer = useDeleteCustomer()
  const deleteCustomerCascade = useDeleteCustomerCascade()
  const convertLead = useConvertLeadToCustomer()
  const convertCustomerToLead = useConvertCustomerToLead()
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewCustomers = canViewModule('customers')
  const canEditCustomers = canEditModule('customers')
  const customerQuota = useQuota('customers')

  const showEditDenied = useCallback(() => {
    toast({
      title: t('errors.unauthorized'),
      description: t('customers.noPermission'),
      variant: 'destructive',
    })
  }, [t])

  const ensureCanEdit = useCallback(() => {
    if (!canEditCustomers) {
      showEditDenied()
      return false
    }
    if (!customerQuota.canAdd) {
      toast({
        title: t('customers.limitExceeded'),
        description: customerQuota.message || t('customers.customerLimitReached'),
        variant: 'destructive',
      })
      return false
    }
    return true
  }, [canEditCustomers, showEditDenied, customerQuota])

  const customers = customersQuery.data ?? []

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let filtered = customers.filter((c) => (c.customer_status || 'customer') === activeTab)
    
    if (q) {
      filtered = filtered.filter((c) => {
        const name = String(c.name ?? '').toLowerCase()
        const email = String(c.email ?? '').toLowerCase()
        const phone = String(c.phone ?? '').toLowerCase()
        return name.includes(q) || email.includes(q) || phone.includes(q)
      })
    }
    
    return filtered
  }, [customers, searchQuery, activeTab])

  const handleConvertLead = async (customer: CustomerRow) => {
    try {
      await convertLead.mutateAsync({ id: customer.id, name: customer.name })
      toast({ title: t('customers.leadConverted') })
    } catch (e: any) {
      toast({
        title: t('customers.conversionFailed'),
        description: e?.message || t('admin.unknownError'),
        variant: 'destructive',
      })
    }
  }

  const handleConvertToLead = async (customer: CustomerRow) => {
    try {
      await convertCustomerToLead.mutateAsync({ id: customer.id, name: customer.name })
      toast({ title: t('customers.leadReverted') })
    } catch (e: any) {
      toast({
        title: t('customers.leadRevertFailed'),
        description: e?.message || t('admin.unknownError'),
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    const state = (location.state ?? {}) as any
    if (state?.openNew) {
      if (!canEditCustomers) {
        showEditDenied()
        navigate(location.pathname, { replace: true, state: null })
        return
      }
      setEditingCustomer(null)
      setOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, canEditCustomers, showEditDenied])

  if (permissionsLoading) {
    return (
      <AppLayout title={t('nav.customers')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewCustomers) {
    return (
      <AppLayout title={t('nav.customers')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('customers.noAccess')}</div>
          <p className="max-w-md text-muted-foreground">
            {t('customers.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('nav.customers')}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold">{t('nav.customers')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('customers.manageCustomers')}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'customer' | 'lead')}>
          <TabsList className="mb-4 w-full sm:w-auto flex">
            <TabsTrigger value="customer" className="flex-1 sm:flex-none">{t('nav.customers')}</TabsTrigger>
            <TabsTrigger value="lead" className="flex-1 sm:flex-none">{t('customers.leads')}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4">
                <CardTitle className="whitespace-nowrap">{t('customers.customerList')}</CardTitle>
                
                {/* Search & Add Button Group */}
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-[250px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('customers.searchPlaceholder')}
                      className="pl-9 w-full"
                    />
                  </div>

                  <Dialog
                    open={open}
                    onOpenChange={(v) => {
                      setOpen(v)
                      if (!v) setEditingCustomer(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        className="w-full sm:w-auto"
                        disabled={!canEditCustomers}
                        onClick={() => {
                          if (!ensureCanEdit()) return
                          setEditingCustomer(null)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {activeTab === 'lead' ? t('customers.addLead') : t('customers.addCustomer')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingCustomer ? t('customers.editCustomer') : t('customers.newCustomer')}</DialogTitle>
                      </DialogHeader>
                      <CustomerForm
                        initialCustomer={editingCustomer ?? undefined}
                        defaultCustomerStatus={activeTab}
                        onSuccess={() => {
                          setOpen(false)
                          toast({
                            title: editingCustomer ? t('customers.customerUpdated') : (activeTab === 'lead' ? t('customers.leadCreated') : t('customers.customerCreated')),
                          })
                          setEditingCustomer(null)
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {customersQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : customersQuery.isError ? (
                  <p className="text-sm text-destructive">
                    {(customersQuery.error as any)?.message || t('customers.loadFailed')}
                  </p>
                ) : (
                  // Table Mobile Fix: overflow-x-auto & min-width
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('common.name')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('common.phone')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('common.email')}
                          </th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                            {t('table.actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="h-32 text-center">
                              <p className="text-sm text-muted-foreground">
                                {t('customers.emptyList')}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <tr key={customer.id} className="border-b">
                              <td className="p-4">
                                <button
                                  type="button"
                                  className="group flex items-center gap-3 p-2 -ml-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
                                  onClick={() => navigate(`/customers/${customer.id}`)}
                                >
                                  <div
                                    className={
                                      customer.type === 'corporate'
                                        ? 'h-8 w-8 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 flex items-center justify-center'
                                        : 'h-8 w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center'
                                    }
                                  >
                                    {customer.type === 'corporate' ? (
                                      <Building2 className="h-4 w-4" />
                                    ) : (
                                      <User className="h-4 w-4" />
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="font-medium text-gray-900 dark:text-gray-100 text-left truncate">
                                      {customer.name}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                                  </div>
                                </button>
                              </td>
                              <td className="p-4">{customer.phone || '-'}</td>
                              <td className="p-4">{customer.email || '-'}</td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {activeTab === 'lead' ? (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        handleConvertLead(customer)
                                      }}
                                      disabled={!canEditCustomers || convertLead.isPending}
                                    >
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      {t('customers.convertToCustomer')}
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        handleConvertToLead(customer)
                                      }}
                                      disabled={!canEditCustomers || convertCustomerToLead.isPending}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      {t('customers.convertToLead')}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!canEditCustomers}
                                    onClick={() => {
                                      if (!ensureCanEdit()) return
                                      setEditingCustomer(customer)
                                      setOpen(true)
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {t('common.edit')}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={!canEditCustomers}
                                    onClick={() => {
                                      if (!ensureCanEdit()) return
                                      setDeletingCustomer(customer)
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t('common.delete')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog
          open={Boolean(deletingCustomer)}
          onOpenChange={(v) => {
            if (!v) setDeletingCustomer(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingCustomer(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteCustomer.isPending || !deletingCustomer}
                onClick={async () => {
                  if (!deletingCustomer) return
                  try {
                    await deleteCustomer.mutateAsync({
                      id: deletingCustomer.id,
                      itemName: deletingCustomer.name,
                    })
                    toast({ title: 'Müşteri silindi' })
                  } catch (e: any) {
                    const code = e?.code as string | undefined
                    const message = (e?.message as string | undefined) ?? ''
                    const details = (e?.details as string | undefined) ?? ''
                    const hint = (e?.hint as string | undefined) ?? ''
                    const isFkViolation =
                      code === '23503' ||
                      message.toLowerCase().includes('foreign key constraint') ||
                      details.toLowerCase().includes('foreign key')

                    if (isFkViolation) {
                      setCascadeDeletingCustomer(deletingCustomer)
                      setDeletingCustomer(null)
                      return
                    }

                    toast({
                      title: 'Silme işlemi başarısız',
                      description: hint || details || message || 'Bilinmeyen hata',
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingCustomer(null)
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(cascadeDeletingCustomer)}
          onOpenChange={(v) => {
            if (!v) setCascadeDeletingCustomer(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu müşteriye ait faturalar olduğu için doğrudan silinemiyor. Faturalarla birlikte bu müşteriyi
                silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setCascadeDeletingCustomer(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                disabled={deleteCustomerCascade.isPending || !cascadeDeletingCustomer}
                onClick={async () => {
                  if (!cascadeDeletingCustomer) return
                  try {
                    await deleteCustomerCascade.mutateAsync({
                      id: cascadeDeletingCustomer.id,
                      itemName: cascadeDeletingCustomer.name,
                    })
                    toast({ title: 'Müşteri ve faturaları silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.hint || e?.details || e?.message || 'Bilinmeyen hata',
                      variant: 'destructive',
                    })
                  } finally {
                    setCascadeDeletingCustomer(null)
                  }
                }}
              >
                Sil
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}