import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { AccountForm } from '../components/forms/AccountForm'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useAccounts, useDeleteAccount } from '../hooks/useSupabaseQuery'
import type { Database } from '../types/database'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { usePermissions } from '../contexts/PermissionsContext'

type AccountRow = Database['public']['Tables']['accounts']['Row']

const getTypeLabels = (t: (key: string) => string): Record<AccountRow['type'], string> => ({
  bank: t('accounts.bank'),
  cash: t('accounts.cash'),
  credit_card: t('accounts.creditCard'),
})

const currencySymbols: Record<AccountRow['currency'], string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
}

export function AccountsPage() {
  const { t, i18n } = useTranslation()
  const typeLabels = useMemo(() => getTypeLabels(t), [t])
  const [open, setOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<AccountRow | null>(null)
  const accountsQuery = useAccounts()
  const deleteAccount = useDeleteAccount()
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewAccounts = canViewModule('accounts')
  const canEditAccounts = canEditModule('accounts')
  const numberLocale = useMemo(() => (i18n.language?.startsWith('tr') ? 'tr-TR' : 'en-US'), [i18n.language])

  const showEditDenied = useCallback(() => {
    toast({
      title: t('errors.unauthorized'),
      description: t('accounts.noPermission'),
      variant: 'destructive',
    })
  }, [t])

  const ensureCanEdit = useCallback(() => {
    if (!canEditAccounts) {
      showEditDenied()
      return false
    }
    return true
  }, [canEditAccounts, showEditDenied])

  const accounts = accountsQuery.data ?? []

  const totalsByCurrency = useMemo(() => {
    return accounts.reduce(
      (acc, a) => {
        acc[a.currency] += Number(a.balance ?? 0)
        return acc
      },
      { TRY: 0, USD: 0, EUR: 0 } as Record<AccountRow['currency'], number>
    )
  }, [accounts])

  if (permissionsLoading) {
    return (
      <AppLayout title={t('nav.accounts')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewAccounts) {
    return (
      <AppLayout title={t('nav.accounts')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('accounts.noAccess')}</div>
          <p className="max-w-md text-muted-foreground">
            {t('accounts.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('accounts.pageTitle')}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t('accounts.pageTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('accounts.pageDescription')}</p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setEditingAccount(null)
            }}
          >
            <DialogTrigger asChild>
              <Button
                disabled={!canEditAccounts}
                onClick={() => {
                  if (!ensureCanEdit()) return
                  setEditingAccount(null)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('accounts.newAccount')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? t('accounts.editAccount') : t('accounts.newAccount')}</DialogTitle>
              </DialogHeader>
              <AccountForm
                initialAccount={editingAccount ?? undefined}
                onSuccess={() => {
                  setOpen(false)
                  setEditingAccount(null)
                  toast({
                    title: editingAccount ? t('accounts.accountUpdated') : t('accounts.accountCreated'),
                  })
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          {(['TRY', 'USD', 'EUR'] as const).map((currency) => (
            <Card key={currency}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('accounts.totals.title', { currency })}</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbols[currency]}
                  {totalsByCurrency[currency].toLocaleString(numberLocale, { maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('accounts.totals.subtitle')}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="pt-2">
          <h2 className="text-xl font-semibold mb-4 mt-2">{t('accounts.accountList')}</h2>
          <Separator />
        </div>

        {accountsQuery.isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {accountsQuery.isError && (
          <Card className="border-destructive/50">
            <CardContent className="py-10">
              <p className="text-sm text-destructive">
                {(accountsQuery.error as any)?.message || t('accounts.loadingError')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Accounts Grid */}
        {!accountsQuery.isLoading && !accountsQuery.isError && accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('accounts.emptyStateTitle')}</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
                {t('accounts.emptyStateDescription')}
              </p>
              <Button
                disabled={!canEditAccounts}
                onClick={() => {
                  if (!ensureCanEdit()) return
                  setOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('accounts.emptyStateAction')}
              </Button>
            </CardContent>
          </Card>
        ) : !accountsQuery.isLoading && !accountsQuery.isError ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {account.name}
                  </CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currencySymbols[account.currency]}
                    {Number(account.balance ?? 0).toLocaleString(numberLocale, { maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {typeLabels[account.type]}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={!canEditAccounts}
                      onClick={() => {
                        if (!ensureCanEdit()) return
                        setEditingAccount(account)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!canEditAccounts}
                      size="sm"
                      onClick={() => {
                        if (!ensureCanEdit()) return
                        setDeletingAccount(account)
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        <AlertDialog
          open={Boolean(deletingAccount)}
          onOpenChange={(v) => {
            if (!v) setDeletingAccount(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.deleteConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>{t('common.deleteWarning')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingAccount(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteAccount.isPending || !deletingAccount}
                onClick={async () => {
                  if (!deletingAccount) return
                  try {
                    await deleteAccount.mutateAsync({
                      id: deletingAccount.id,
                      itemName: deletingAccount.name,
                    })
                    toast({ title: t('accounts.accountDeleted') })
                  } catch (e: any) {
                    toast({
                      title: t('accounts.deleteFailed'),
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingAccount(null)
                  }
                }}
              >
                {t('common.delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
