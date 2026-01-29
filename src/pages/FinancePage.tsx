import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../components/layout/AppLayout'
import { TransactionForm } from '../components/forms/TransactionForm'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Calendar } from '../components/ui/calendar'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { useAccounts, useCustomers, useDeleteTransaction, useTransactionsByDateRange } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { Database } from '../types/database'
import { usePermissions } from '../contexts/PermissionsContext'
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { Calendar as CalendarIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type TransactionRow = Database['public']['Tables']['transactions']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

export function FinancePage() {
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const editIdParam = searchParams.get('editId')
  const [open, setOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewFinance = canViewModule('finance')
  const canEditFinance = canEditModule('finance')
  const { t, i18n } = useTranslation()

  const dateLocale = useMemo(() => (i18n.language?.startsWith('tr') ? tr : enUS), [i18n.language])
  const numberLocale = useMemo(() => (i18n.language?.startsWith('tr') ? 'tr-TR' : 'en-US'), [i18n.language])

  const showEditDenied = useCallback(() => {
    toast({
      title: t('finance.permissionDeniedTitle'),
      description: t('finance.permissionDeniedDescription'),
      variant: 'destructive',
    })
  }, [t])

  const ensureCanEdit = useCallback(() => {
    if (!canEditFinance) {
      showEditDenied()
      return false
    }
    return true
  }, [canEditFinance, showEditDenied])

  const dateFromStr = useMemo(() => {
    return dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange?.from])

  const dateToStr = useMemo(() => {
    return dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange?.to])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return t('finance.dateRange.label')
    const from = format(dateRange.from, 'd MMM', { locale: dateLocale })
    const to = format(dateRange.to, 'd MMM', { locale: dateLocale })
    return `${from} - ${to}`
  }, [dateLocale, dateRange?.from, dateRange?.to, t])

  const transactionsQuery = useTransactionsByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const accountsQuery = useAccounts()
  const deleteTransaction = useDeleteTransaction()

  const transactions = transactionsQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const accountsById = useMemo(() => {
    return new Map((accountsQuery.data ?? []).map((a) => [a.id, a]))
  }, [accountsQuery.data])

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return transactions

    return transactions.filter((t) => {
      const customer = t.customer_id ? customersById.get(t.customer_id) : undefined
      const account = t.bank_account ? accountsById.get(t.bank_account) : undefined

      const descriptionText = String((t as any)?.description ?? '').toLowerCase()
      const categoryText = String(t.category ?? '').toLowerCase()
      const accountText = String(account?.name ?? '').toLowerCase()
      const customerText = String(customer?.name ?? '').toLowerCase()

      return (
        descriptionText.includes(q) ||
        categoryText.includes(q) ||
        accountText.includes(q) ||
        customerText.includes(q)
      )
    })
  }, [accountsById, customersById, searchQuery, transactions])

  useEffect(() => {
    if (!editIdParam) return
    if (open && editingTransaction?.id === editIdParam) return

    if (!canEditFinance) {
      showEditDenied()
      const next = new URLSearchParams(searchParams)
      next.delete('editId')
      setSearchParams(next, { replace: true })
      return
    }

    const match = transactions.find((t) => t.id === editIdParam)
    if (match) {
      setEditingTransaction(match)
      setOpen(true)
      return
    }

    if (!transactionsQuery.isLoading && !transactionsQuery.isFetching) {
      toast({
        title: t('finance.transactionNotFoundTitle'),
        description: t('finance.transactionNotFoundDescription'),
        variant: 'destructive',
      })
      const next = new URLSearchParams(searchParams)
      next.delete('editId')
      setSearchParams(next, { replace: true })
    }
  }, [editIdParam, editingTransaction?.id, open, searchParams, setSearchParams, transactions, transactionsQuery.isFetching, transactionsQuery.isLoading, canEditFinance, showEditDenied])

  if (permissionsLoading) {
    return (
      <AppLayout title={t('finance.pageTitle')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('finance.loadingPermissions')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewFinance) {
    return (
      <AppLayout title={t('finance.pageTitle')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('finance.noAccessTitle')}</div>
          <p className="max-w-md text-muted-foreground">{t('finance.noAccessDescription')}</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('finance.pageTitle')}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold">{t('finance.pageTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('finance.pageDescription')}</p>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="p-4 space-y-4">
            
            {/* SATIR 1: Başlık (Sol) ve Tarih Seçici (Sağ) - Tam istediğin gibi karşılıklı */}
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="whitespace-nowrap text-lg">{t('finance.transactions')}</CardTitle>
              
              {/* Tarih Seçici */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-9 w-[160px] sm:w-auto bg-white dark:bg-background justify-start text-left font-normal border-border/50 shadow-sm',
                      !dateRange?.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {dateRange?.from && dateRange?.to 
                        ? `${format(dateRange.from, 'd MMM', { locale: dateLocale })} - ${format(dateRange.to, 'd MMM', { locale: dateLocale })}`
                        : t('finance.dateRange.label')}
                    </span>
                  </Button>
                </PopoverTrigger>
                {/* Popover Fix: sideOffset ile biraz mesafe bıraktık, z-index sorunu olmasın diye portal kullanıyor zaten */}
                <PopoverContent align="end" sideOffset={8} className="w-[95vw] sm:w-auto p-0">
                  <div className="h-[450px] sm:h-auto overflow-y-auto p-3">
                    <div className="grid grid-cols-3 gap-2 pb-4 border-b mb-4">
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setDateRange({ from: now, to: now })}>
                        {t('finance.dateRange.today')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() =>
                          setDateRange({
                            from: startOfWeek(now, { weekStartsOn: 1 }),
                            to: endOfWeek(now, { weekStartsOn: 1 }),
                          })
                        }
                      >
                        {t('finance.dateRange.thisWeek')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
                      >
                        {t('finance.dateRange.thisMonth')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          const prev = subMonths(now, 1)
                          setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) })
                        }}
                      >
                        {t('finance.dateRange.lastMonth')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
                      >
                        {t('finance.dateRange.thisYear')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setDateRange(undefined)}>
                        {t('finance.dateRange.clear')}
                      </Button>
                    </div>

                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div>
                        <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{t('finance.dateRange.start')}</div>
                        <div className="sm:scale-100 scale-95 origin-top-left">
                          <Calendar
                            mode="single"
                            selected={dateRange?.from}
                            locale={dateLocale}
                            className="pointer-events-auto border rounded-md"
                            onSelect={(d) => {
                              if (!d) return
                              setDateRange((prev) => {
                                const to = prev?.to
                                if (to && d > to) return { from: to, to: d }
                                return { from: d, to: to ?? d }
                              })
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{t('finance.dateRange.end')}</div>
                        <div className="sm:scale-100 scale-95 origin-top-left">
                          <Calendar
                            mode="single"
                            selected={dateRange?.to}
                            locale={dateLocale}
                            className="pointer-events-auto border rounded-md"
                            onSelect={(d) => {
                              if (!d) return
                              setDateRange((prev) => {
                                const from = prev?.from
                                if (from && d < from) return { from: d, to: from }
                                return { from: from ?? d, to: d }
                              })
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* SATIR 2: Arama (Sol) ve Yeni İşlem Butonu (Sağ/Alt) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('finance.searchPlaceholder')}
                  className="pl-9 w-full"
                />
              </div>

              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) {
                    setEditingTransaction(null)
                    if (searchParams.get('editId')) {
                      const next = new URLSearchParams(searchParams)
                      next.delete('editId')
                      setSearchParams(next, { replace: true })
                    }
                  }
                }}
              >
                <Button
                  className="w-full sm:w-auto whitespace-nowrap"
                  disabled={!canEditFinance}
                  onClick={() => {
                    if (!ensureCanEdit()) return
                    setEditingTransaction(null)
                    setOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('finance.addTransaction')}
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingTransaction ? t('finance.editTransaction') : t('finance.newTransaction')}
                    </DialogTitle>
                  </DialogHeader>
                  <TransactionForm
                    initialTransaction={editingTransaction ?? undefined}
                    onSuccess={() => {
                      setOpen(false)
                      toast({
                        title: editingTransaction ? t('finance.transactionUpdated') : t('finance.transactionCreated'),
                      })
                      setEditingTransaction(null)
                      if (searchParams.get('editId')) {
                        const next = new URLSearchParams(searchParams)
                        next.delete('editId')
                        setSearchParams(next, { replace: true })
                      }
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>

          </CardHeader>
          <CardContent>
            {transactionsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : transactionsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(transactionsQuery.error as any)?.message || t('finance.loadFailed')}
              </p>
            ) : (
              // Tablo Mobil Düzeltmesi: overflow-x-auto ve min-width korundu
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('finance.table.date')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('finance.table.type')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('finance.table.category')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('finance.table.account')}
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        {t('finance.table.customer')}
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        {t('finance.table.amount')}
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        {t('finance.table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">{t('finance.emptyState')}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((txn) => {
                        const customer = txn.customer_id ? customersById.get(txn.customer_id) : undefined
                        const account = txn.bank_account ? accountsById.get(txn.bank_account) : undefined
                        return (
                          <tr key={txn.id} className="border-b">
                            <td className="p-4">{formatShortDate(txn.transaction_date)}</td>
                            <td className="p-4">
                              <Badge
                                variant={txn.type === 'expense' ? 'destructive' : 'default'}
                                className={txn.type === 'income' ? 'bg-emerald-500 hover:bg-emerald-500/90 text-white border-transparent' : undefined}
                              >
                                {txn.type === 'income' ? t('finance.income') : t('finance.expense')}
                              </Badge>
                            </td>
                            <td className="p-4">{txn.category}</td>
                            <td className="p-4">{account?.name || '-'}</td>
                            <td className="p-4">{customer?.name || '-'}</td>
                            <td className="p-4 text-right font-medium">{formatCurrency(Number(txn.amount))}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!canEditFinance}
                                  onClick={() => {
                                    if (!ensureCanEdit()) return
                                    setEditingTransaction(txn)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={!canEditFinance}
                                  onClick={() => {
                                    if (!ensureCanEdit()) return
                                    setDeletingTransaction(txn)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('common.delete')}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deletingTransaction)}
          onOpenChange={(v) => {
            if (!v) setDeletingTransaction(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.deleteConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>{t('common.deleteWarning')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingTransaction(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteTransaction.isPending || !deletingTransaction}
                onClick={async () => {
                  if (!deletingTransaction) return
                  try {
                    await deleteTransaction.mutateAsync({
                      id: deletingTransaction.id,
                      itemName: `${deletingTransaction.category} (${Number(deletingTransaction.amount).toLocaleString(numberLocale)} TRY)`,
                    })
                    toast({ title: t('finance.transactionDeleted') })
                  } catch (e: any) {
                    toast({
                      title: t('finance.transactionDeleteFailed'),
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingTransaction(null)
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