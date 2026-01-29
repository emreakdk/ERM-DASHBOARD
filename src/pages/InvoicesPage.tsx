import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { CreateInvoiceForm } from '../components/forms/CreateInvoiceForm'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { InvoicePrintView } from '../components/invoices/InvoicePrintView'
import {
  useCreatePayment,
  useCustomers,
  useDeleteInvoice,
  useDeletePayment,
  useInvoiceItems,
  useInvoicePayments,
  useInvoicesByDateRange,
  useUpdateInvoiceStatus,
} from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar } from '../components/ui/calendar'
import { cn } from '../lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
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
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQuota } from '../hooks/useQuota'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

const statusVariants: Record<InvoiceRow['status'], 'secondary' | 'default' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  pending: 'secondary',
  paid: 'default',
  cancelled: 'destructive',
}

const statusBadgeClasses: Record<InvoiceRow['status'], string> = {
  draft: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  sent: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  pending: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/20',
  paid: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  cancelled: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
}

const paymentStatusVariants: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  partial: 'default',
  paid: 'default',
}

const paymentStatusBadgeClasses: Record<string, string> = {
  pending: 'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/20',
  partial: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  paid: statusBadgeClasses.paid,
}

function getInvoicePaymentStatus(inv: any, t: (key: string) => string) {
  const baseStatus = String(inv?.status ?? '')
  if (baseStatus === 'cancelled') return { key: 'cancelled', label: t('invoices.cancelled') }
  if (baseStatus === 'draft') return { key: 'draft', label: t('invoices.draft') }
  if (baseStatus === 'paid') return { key: 'paid', label: t('invoices.paid') }

  const total = Number(inv?.total_amount ?? 0)
  const paidAmount = Array.isArray(inv?.payments)
    ? (inv.payments as any[]).reduce((acc, p) => acc + Number(p?.amount ?? 0), 0)
    : 0

  if (paidAmount <= 0) return { key: 'pending', label: t('invoices.pending') }
  if (paidAmount < total) return { key: 'partial', label: t('invoices.partial') }
  return { key: 'paid', label: t('invoices.paid') }
}

export function InvoicesPage() {
  const { t, i18n } = useTranslation()
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const openInvoiceId = searchParams.get('open')
  const activeTab = searchParams.get('tab') === 'paid' ? 'paid' : 'unpaid'
  const [autoOpenAttempts, setAutoOpenAttempts] = useState(0)

  const [open, setOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null)
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceRow | null>(null)
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [paymentMethod, setPaymentMethod] = useState<string>('bank')
  const [paymentNotes, setPaymentNotes] = useState('')

  const [quickPaymentAmount, setQuickPaymentAmount] = useState('')
  const [quickPaymentDate, setQuickPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<string>('bank')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewInvoices = canViewModule('invoices')
  const canEditInvoices = canEditModule('invoices')
  const invoiceQuota = useQuota('invoices')
  const dateLocale = useMemo(() => (i18n.language?.startsWith('en') ? enUS : tr), [i18n.language])

  const showEditDenied = useCallback(() => {
    toast({
      title: t('errors.unauthorized'),
      description: t('invoices.noPermission'),
      variant: 'destructive',
    })
  }, [t])

  const ensureCanEdit = useCallback(() => {
    if (!canEditInvoices) {
      showEditDenied()
      return false
    }
    if (!invoiceQuota.canAdd) {
      toast({
        title: t('invoices.limitExceeded'),
        description: invoiceQuota.message || t('invoices.invoiceLimitReached'),
        variant: 'destructive',
      })
      return false
    }
    return true
  }, [canEditInvoices, showEditDenied, invoiceQuota])

  const dateFromStr = useMemo(() => {
    return dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange?.from])

  const dateToStr = useMemo(() => {
    return dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange?.to])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return t('dashboard.dateRange')
    const from = format(dateRange.from, 'd MMM', { locale: dateLocale })
    const to = format(dateRange.to, 'd MMM', { locale: dateLocale })
    return `${from} - ${to}`
  }, [dateLocale, dateRange?.from, dateRange?.to, t])

  const invoicesQuery = useInvoicesByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const deleteInvoice = useDeleteInvoice()
  const updateInvoiceStatus = useUpdateInvoiceStatus()

  const paymentsQuery = useInvoicePayments(editingInvoice?.id)
  const quickPaymentsQuery = useInvoicePayments(selectedInvoiceForPayment?.id)
  const createPayment = useCreatePayment()
  const deletePayment = useDeletePayment()

  const invoiceItemsQuery = useInvoiceItems(editingInvoice?.id)

  const invoices = invoicesQuery.data ?? []

  const editingInvoiceTotals = useMemo(() => {
    const total = Number(editingInvoice?.total_amount ?? 0)
    const paidAmount = (paymentsQuery.data ?? []).reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
    const percent = total <= 0 ? 0 : Math.min(100, (paidAmount / total) * 100)
    return { total, paidAmount, percent }
  }, [editingInvoice?.total_amount, paymentsQuery.data])

  const quickInvoiceTotals = useMemo(() => {
    const total = Number(selectedInvoiceForPayment?.total_amount ?? 0)
    const paidAmount = (quickPaymentsQuery.data ?? []).reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
    const remaining = Math.max(0, total - paidAmount)
    const percent = total <= 0 ? 0 : Math.min(100, (paidAmount / total) * 100)
    return { total, paidAmount, remaining, percent }
  }, [quickPaymentsQuery.data, selectedInvoiceForPayment?.total_amount])
  const currencySymbol = '₺'

  const getPaymentMethodLabel = useCallback(
    (method?: string | null) => {
      if (!method) return '-'
      const normalized = method.toString().toLowerCase().trim()
      if (normalized.includes('banka') || normalized === 'bank') return t('invoices.bank')
      if (normalized.includes('nakit') || normalized === 'cash') return t('invoices.cash')
      if (normalized.includes('kredi') || normalized.includes('card')) return t('invoices.creditCard')
      if (normalized.includes('diğer') || normalized.includes('diger') || normalized === 'other') {
        return t('invoices.other')
      }
      return method
    },
    [t]
  )

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return invoices

    return invoices.filter((inv) => {
      const invNo = String(inv.invoice_number ?? '').toLowerCase()
      const customerName = String(
        (inv as any)?.customer?.name ?? customersById.get(inv.customer_id)?.name ?? ''
      ).toLowerCase()
      const items = ((inv as any)?.invoice_items ?? []) as Array<{ description?: string | null }>
      const itemsText = items
        .map((it) => String(it.description ?? ''))
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return invNo.includes(q) || customerName.includes(q) || itemsText.includes(q)
    })
  }, [customersById, invoices, searchQuery])

  const unpaidInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
  }, [filteredInvoices])

  const paidInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => inv.status === 'paid')
  }, [filteredInvoices])

  useEffect(() => {
    if (!openInvoiceId) return

    if (!canEditInvoices) {
      showEditDenied()
      setSearchParams({}, { replace: true })
      return
    }

    const invoices = invoicesQuery.data ?? []
    const match = invoices.find((inv) => inv.id === openInvoiceId)

    if (match) {
      setEditingInvoice(match)
      setOpen(true)
      setSearchParams({}, { replace: true })
      return
    }

    if (!invoicesQuery.isFetching && autoOpenAttempts < 2) {
      setAutoOpenAttempts((n) => n + 1)
      invoicesQuery.refetch()
    }
  }, [autoOpenAttempts, canEditInvoices, invoicesQuery, openInvoiceId, setSearchParams, showEditDenied])

  if (permissionsLoading) {
    return (
      <AppLayout title={t('nav.invoices')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewInvoices) {
    return (
      <AppLayout title={t('nav.invoices')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('invoices.noAccess')}</div>
          <p className="max-w-md text-muted-foreground">
            {t('invoices.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('nav.invoices')}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold">{t('nav.invoices')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('invoices.manageInvoices')}
          </p>
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader className="p-4 space-y-4">
            
            {/* SATIR 1: Başlık (Sol) ve Tarih Seçici (Sağ) */}
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="whitespace-nowrap text-lg">{t('invoices.invoiceList')}</CardTitle>
              
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
                        : t('dashboard.dateRange')}
                    </span>
                  </Button>
                </PopoverTrigger>
                {/* Mobile Friendly Popover Content */}
                <PopoverContent align="end" sideOffset={8} className="w-[95vw] sm:w-auto p-0">
                  <div className="h-[450px] sm:h-auto overflow-y-auto p-3">
                    <div className="grid grid-cols-3 gap-2 pb-4 border-b mb-4">
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setDateRange({ from: now, to: now })}>
                        {t('invoices.dateFilter.today')}
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
                        {t('invoices.dateFilter.thisWeek')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
                      >
                        {t('invoices.dateFilter.thisMonth')}
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
                        {t('invoices.dateFilter.lastMonth')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
                      >
                        {t('invoices.dateFilter.thisYear')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={() => setDateRange(undefined)}>
                        {t('invoices.dateFilter.clear')}
                      </Button>
                    </div>

                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div>
                        <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
                          {t('invoices.dateFilter.start')}
                        </div>
                        <div className="sm:scale-100 scale-95 origin-top-left">
                          <Calendar
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
                        <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
                          {t('invoices.dateFilter.end')}
                        </div>
                        <div className="sm:scale-100 scale-95 origin-top-left">
                          <Calendar
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

            {/* SATIR 2: Arama (Sol) ve Yeni Fatura Butonu (Sağ) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('invoices.searchPlaceholder')}
                  className="pl-9 w-full"
                />
              </div>

              <Sheet
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingInvoice(null)
                }}
              >
                <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[800px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>
                      {editingInvoice ? t('invoices.editInvoice') : t('invoices.newInvoice')}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="px-6 pb-6">
                    <CreateInvoiceForm
                      initialInvoice={editingInvoice ?? undefined}
                      initialItems={invoiceItemsQuery.data ?? undefined}
                      onSuccess={() => {
                        setOpen(false)
                        toast({
                          title: editingInvoice ? t('invoices.invoiceUpdated') : t('invoices.invoiceCreated'),
                        })
                        setEditingInvoice(null)
                      }}
                    />
                  </div>

                  {editingInvoice?.id ? (
                    <div className="px-6 pb-6">
                      <div className="mt-8 rounded-lg border bg-white dark:bg-background p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{t('invoices.payments.title')}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t('invoices.payments.progressLabel', {
                                paid: formatCurrency(editingInvoiceTotals.paidAmount),
                                total: formatCurrency(editingInvoiceTotals.total),
                              })}
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              if (!ensureCanEdit()) return
                              setPaymentAmount('')
                              setPaymentNotes('')
                              setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
                              setPaymentMethod('Banka')
                              setPaymentDialogOpen(true)
                            }}
                            disabled={createPayment.isPending || !editingInvoice?.id}
                          >
                            {t('invoices.payments.add')}
                          </Button>
                        </div>

                        <div className="mt-4">
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-green-600"
                              style={{ width: `${editingInvoiceTotals.percent}%` }}
                            />
                          </div>
                        </div>

                        {paymentsQuery.isLoading ? (
                          <div className="mt-4 text-sm text-muted-foreground">{t('invoices.payments.loading')}</div>
                        ) : paymentsQuery.isError ? (
                          <div className="mt-4 text-sm text-destructive">
                            {(paymentsQuery.error as any)?.message || t('invoices.payments.error')}
                          </div>
                        ) : (paymentsQuery.data ?? []).length === 0 ? (
                          <div className="mt-4 text-sm text-muted-foreground">{t('invoices.payments.empty')}</div>
                        ) : (
                          <div className="mt-4 overflow-hidden rounded-md border overflow-x-auto">
                            <table className="w-full min-w-[400px]">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground">
                                    {t('invoices.payments.table.date')}
                                  </th>
                                  <th className="h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground">
                                    {t('invoices.payments.table.method')}
                                  </th>
                                  <th className="h-10 px-3 text-right align-middle text-xs font-medium text-muted-foreground">
                                    {t('invoices.payments.table.amount')}
                                  </th>
                                  <th className="h-10 px-3 text-right align-middle text-xs font-medium text-muted-foreground">
                                    {t('invoices.payments.table.actions')}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(paymentsQuery.data ?? []).map((p) => (
                                  <tr key={p.id} className="border-b last:border-b-0">
                                    <td className="p-3 text-sm">{formatShortDate(p.payment_date)}</td>
                                    <td className="p-3 text-sm">{p.payment_method || '-'}</td>
                                    <td className="p-3 text-right text-sm tabular-nums font-medium">{formatCurrency(Number(p.amount ?? 0))}</td>
                                    <td className="p-3 text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={!canEditInvoices || deletePayment.isPending}
                                        onClick={async () => {
                                          if (!editingInvoice?.id || !ensureCanEdit()) return
                                          try {
                                            await deletePayment.mutateAsync({ id: p.id, invoice_id: editingInvoice.id })
                                            toast({ title: t('invoices.paymentDeleted') })
                                          } catch (e: any) {
                                            toast({ title: t('common.deleteFailed'), description: e?.message, variant: 'destructive' })
                                          }
                                        }}
                                      >
                                        {t('invoices.actions.delete')}
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </SheetContent>
                
                {/* Trigger Button - Moved here to ensure correct scope */}
                <Button
                  className="w-full sm:w-auto whitespace-nowrap"
                  onClick={() => {
                    if (!ensureCanEdit()) return
                    setEditingInvoice(null)
                    setOpen(true)
                  }}
                  disabled={!canEditInvoices}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('invoices.newInvoice')}
                </Button>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                if (v !== 'paid' && v !== 'unpaid') return
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('tab', v)
                  return next
                })
              }}
            >
              <TabsList className="mb-4 w-full sm:w-auto flex">
                <TabsTrigger value="unpaid" className="flex-1 sm:flex-none">
                  {t('invoices.unpaid')} ({unpaidInvoices.length})
                </TabsTrigger>
                <TabsTrigger value="paid" className="flex-1 sm:flex-none">
                  {t('invoices.paid')} ({paidInvoices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="unpaid" className="mt-0">
                {invoicesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : invoicesQuery.isError ? (
                  <p className="text-sm text-destructive">
                    {(invoicesQuery.error as any)?.message || t('invoices.loadFailed')}
                  </p>
                ) : (
                  // Table Mobile Fix: overflow-x-auto & min-width
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.invoiceNo')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.date')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.customer')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.serviceOrProduct')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.status')}
                          </th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                            {t('invoices.table.total')}
                          </th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                            {t('invoices.table.actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaidInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="h-32 text-center">
                              <p className="text-sm text-muted-foreground">{t('invoices.noUnpaidInvoices')}</p>
                            </td>
                          </tr>
                        ) : (
                          unpaidInvoices.map((inv) => {
                            const customer = (inv as any)?.customer ?? customersById.get(inv.customer_id)
                            const items = ((inv as any)?.invoice_items ?? []) as Array<{ description?: string | null }>
                            const first = items[0]?.description ?? ''
                            const itemsLabel =
                              items.length === 0
                                ? '-'
                                : items.length === 1
                                  ? String(first)
                                  : `${String(first)} (+${items.length - 1} ${t('invoices.items')})`

                            const displayStatus = getInvoicePaymentStatus(inv, t)
                            const badgeVariant =
                              displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                                ? statusVariants[inv.status]
                                : paymentStatusVariants[displayStatus.key] ?? 'secondary'
                            const badgeClassName =
                              displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                                ? statusBadgeClasses[inv.status]
                                : paymentStatusBadgeClasses[displayStatus.key] ?? ''

                            return (
                              <tr key={inv.id} className="border-b">
                                <td className="p-4 font-medium">{inv.invoice_number}</td>
                                <td className="p-4">{formatShortDate(inv.invoice_date)}</td>
                                <td className="p-4">{customer?.name || '-'}</td>
                                <td className="p-4 max-w-[320px]">
                                  <div className="truncate" title={itemsLabel}>
                                    {itemsLabel}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Badge variant={badgeVariant} className={badgeClassName}>
                                    {displayStatus.label}
                                  </Badge>
                                </td>
                                <td className="p-4 text-right font-medium">{formatCurrency(Number(inv.total_amount))}</td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => setPrintingInvoice(inv)}
                                      title={t('invoices.actions.print')}
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>

                                    <DropdownMenu.Root>
                                      <DropdownMenu.Trigger asChild>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          title={inv.token ? t('invoices.actions.share') : t('invoices.shareTokenMissing')}
                                          disabled={!inv.token}
                                        >
                                          <Share2 className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenu.Trigger>
                                      <DropdownMenu.Portal>
                                        <DropdownMenu.Content
                                          align="end"
                                          sideOffset={6}
                                          className="z-50 min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                        >
                                          <DropdownMenu.Item
                                            className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                            onSelect={async () => {
                                              try {
                                                const token = inv.token
                                                if (!token) return
                                                const fullUrl = `${window.location.origin}/p/invoice/${token}`
                                                await navigator.clipboard.writeText(fullUrl)
                                                toast({ title: t('invoices.share.copySuccess') })
                                              } catch (e: any) {
                                                toast({
                                                  title: t('invoices.share.copyFailed'),
                                                  description: e?.message || t('common.errorOccurred'),
                                                  variant: 'destructive',
                                                })
                                              }
                                            }}
                                          >
                                            <Copy className="h-4 w-4" />
                                            {t('invoices.share.copyLink')}
                                          </DropdownMenu.Item>

                                          <DropdownMenu.Item
                                            className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                            onSelect={() => {
                                              const token = inv.token
                                              if (!token) return
                                              const fullUrl = `${window.location.origin}/p/invoice/${token}`
                                              window.open(fullUrl, '_blank', 'noopener,noreferrer')
                                            }}
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                            {t('invoices.share.preview')}
                                          </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                      </DropdownMenu.Portal>
                                    </DropdownMenu.Root>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canEditInvoices || updateInvoiceStatus.isPending}
                                      onClick={async () => {
                                        if (!ensureCanEdit()) return
                                        try {
                                          await updateInvoiceStatus.mutateAsync({ id: inv.id, status: 'paid' })
                                          toast({ title: t('invoices.notifications.markPaid') })
                                        } catch (e: any) {
                                          toast({ title: t('common.updateFailed'), description: e?.message, variant: 'destructive' })
                                        }
                                      }}
                                      title={t('invoices.actions.markPaid')}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canEditInvoices}
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        setEditingInvoice(inv)
                                        setOpen(true)
                                      }}
                                      title={t('invoices.actions.edit')}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        setSelectedInvoiceForPayment(inv)
                                        setQuickPaymentAmount('')
                                        setQuickPaymentDate(format(new Date(), 'yyyy-MM-dd'))
                                        setQuickPaymentMethod('Banka')
                                      }}
                                      disabled={!canEditInvoices}
                                      title={t('invoices.actions.quickPayment')}
                                    >
                                      <Wallet className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={!canEditInvoices}
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        setDeletingInvoice(inv)
                                      }}
                                      title={t('invoices.actions.delete')}
                                    >
                                      <Trash2 className="h-4 w-4" />
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
              </TabsContent>

              <TabsContent value="paid" className="mt-0">
                {invoicesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : invoicesQuery.isError ? (
                  <p className="text-sm text-destructive">
                    {(invoicesQuery.error as any)?.message || t('invoices.loadFailed')}
                  </p>
                ) : (
                  // Table Mobile Fix: overflow-x-auto & min-width
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.invoiceNo')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.date')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.customer')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.serviceOrProduct')}
                          </th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                            {t('invoices.table.status')}
                          </th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                            {t('invoices.table.total')}
                          </th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                            {t('invoices.table.actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="h-32 text-center">
                              <p className="text-sm text-muted-foreground">{t('invoices.noPaidInvoices')}</p>
                            </td>
                          </tr>
                        ) : (
                          paidInvoices.map((inv) => {
                            const customer = (inv as any)?.customer ?? customersById.get(inv.customer_id)
                            const items = ((inv as any)?.invoice_items ?? []) as Array<{ description?: string | null }>
                            const first = items[0]?.description ?? ''
                            const itemsLabel =
                              items.length === 0
                                ? '-'
                                : items.length === 1
                                  ? String(first)
                                  : `${String(first)} (+${items.length - 1} ${t('invoices.items')})`

                            const displayStatus = getInvoicePaymentStatus(inv, t)
                            const badgeVariant =
                              displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                                ? statusVariants[inv.status]
                                : paymentStatusVariants[displayStatus.key] ?? 'secondary'
                            const badgeClassName =
                              displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                                ? statusBadgeClasses[inv.status]
                                : paymentStatusBadgeClasses[displayStatus.key] ?? ''

                            return (
                              <tr key={inv.id} className="border-b">
                                <td className="p-4 font-medium">{inv.invoice_number}</td>
                                <td className="p-4">{formatShortDate(inv.invoice_date)}</td>
                                <td className="p-4">{customer?.name || '-'}</td>
                                <td className="p-4 max-w-[320px]">
                                  <div className="truncate" title={itemsLabel}>
                                    {itemsLabel}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Badge variant={badgeVariant} className={badgeClassName}>
                                    {displayStatus.label}
                                  </Badge>
                                </td>
                                <td className="p-4 text-right font-medium">{formatCurrency(Number(inv.total_amount))}</td>
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => setPrintingInvoice(inv)}
                                      title={t('invoices.actions.print')}
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>

                                    <DropdownMenu.Root>
                                      <DropdownMenu.Trigger asChild>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          title={inv.token ? t('invoices.actions.share') : t('invoices.shareTokenMissing')}
                                          disabled={!inv.token}
                                        >
                                          <Share2 className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenu.Trigger>
                                      <DropdownMenu.Portal>
                                        <DropdownMenu.Content
                                          align="end"
                                          sideOffset={6}
                                          className="z-50 min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                        >
                                          <DropdownMenu.Item
                                            className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                            onSelect={async () => {
                                              try {
                                                const token = inv.token
                                                if (!token) return
                                                const fullUrl = `${window.location.origin}/p/invoice/${token}`
                                                await navigator.clipboard.writeText(fullUrl)
                                                toast({ title: t('invoices.share.copySuccess') })
                                              } catch (e: any) {
                                                toast({
                                                  title: t('invoices.share.copyFailed'),
                                                  description: e?.message || t('common.errorOccurred'),
                                                  variant: 'destructive',
                                                })
                                              }
                                            }}
                                          >
                                            <Copy className="h-4 w-4" />
                                            {t('invoices.share.copyLink')}
                                          </DropdownMenu.Item>

                                          <DropdownMenu.Item
                                            className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                            onSelect={() => {
                                              const token = inv.token
                                              if (!token) return
                                              const fullUrl = `${window.location.origin}/p/invoice/${token}`
                                              window.open(fullUrl, '_blank', 'noopener,noreferrer')
                                            }}
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                            {t('invoices.share.preview')}
                                          </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                      </DropdownMenu.Portal>
                                    </DropdownMenu.Root>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canEditInvoices || updateInvoiceStatus.isPending}
                                      onClick={async () => {
                                        if (!ensureCanEdit()) return
                                        try {
                                          await updateInvoiceStatus.mutateAsync({ id: inv.id, status: 'pending' })
                                          toast({ title: t('invoices.notifications.markUnpaid') })
                                        } catch (e: any) {
                                          toast({ title: t('common.updateFailed'), description: e?.message, variant: 'destructive' })
                                        }
                                      }}
                                      title={t('invoices.actions.markUnpaid')}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!canEditInvoices}
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        setEditingInvoice(inv)
                                        setOpen(true)
                                      }}
                                      title={t('invoices.actions.edit')}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={!canEditInvoices}
                                      onClick={() => {
                                        if (!ensureCanEdit()) return
                                        setDeletingInvoice(inv)
                                      }}
                                      title={t('invoices.actions.delete')}
                                    >
                                      <Trash2 className="h-4 w-4" />
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deletingInvoice)}
          onOpenChange={(v) => {
            if (!v) setDeletingInvoice(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('invoices.deleteConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>{t('invoices.deleteWarning')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingInvoice(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteInvoice.isPending || !deletingInvoice}
                onClick={async () => {
                  if (!deletingInvoice) return
                  try {
                    await deleteInvoice.mutateAsync({
                      id: deletingInvoice.id,
                      itemName: deletingInvoice.invoice_number,
                    })
                    toast({ title: t('invoices.invoiceDeleted') })
                  } catch (e: any) {
                    toast({
                      title: t('common.deleteFailed'),
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingInvoice(null)
                  }
                }}
              >
                {t('common.delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog
        open={Boolean(selectedInvoiceForPayment)}
        onOpenChange={(v) => {
          if (!v) setSelectedInvoiceForPayment(null)
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {selectedInvoiceForPayment
                ? t('invoices.quickPayment.titleWithContext', {
                    invoice: selectedInvoiceForPayment.invoice_number,
                    customer:
                      (selectedInvoiceForPayment as any)?.customer?.name ??
                      customersById.get(selectedInvoiceForPayment.customer_id)?.name ??
                      '-',
                  })
                : t('invoices.quickPayment.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border bg-white dark:bg-background p-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t('invoices.quickPayment.total')}</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatCurrency(quickInvoiceTotals.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('invoices.quickPayment.paid')}</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatCurrency(quickInvoiceTotals.paidAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('invoices.quickPayment.remaining')}</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatCurrency(quickInvoiceTotals.remaining)}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-600"
                    style={{ width: `${quickInvoiceTotals.percent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div className="text-sm font-semibold">{t('invoices.payments.add')}</div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('invoices.quickPayment.amountLabel', { currency: currencySymbol })}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={quickPaymentAmount}
                    onChange={(e) => setQuickPaymentAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">{t('invoices.quickPayment.dateLabel')}</div>
                  <Input type="date" value={quickPaymentDate} onChange={(e) => setQuickPaymentDate(e.target.value)} />
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">{t('invoices.quickPayment.methodLabel')}</div>
                  <Select value={quickPaymentMethod} onValueChange={setQuickPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Banka">{t('invoices.bank')}</SelectItem>
                      <SelectItem value="Nakit">{t('invoices.cash')}</SelectItem>
                      <SelectItem value="Kredi Kartı">{t('invoices.creditCard')}</SelectItem>
                      <SelectItem value="Diğer">{t('invoices.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={createPayment.isPending || !selectedInvoiceForPayment?.id}
                  onClick={async () => {
                    if (!selectedInvoiceForPayment?.id) return
                    const amount = Number(quickPaymentAmount)
                    if (!amount || amount <= 0) {
                      toast({
                        title: t('invoices.quickPayment.invalidAmount'),
                        description: t('invoices.quickPayment.invalidAmountDescription'),
                        variant: 'destructive',
                      })
                      return
                    }

                    try {
                      await createPayment.mutateAsync({
                        invoice_id: selectedInvoiceForPayment.id,
                        amount,
                        payment_date: quickPaymentDate,
                        payment_method: quickPaymentMethod || null,
                      })
                      toast({ title: t('invoices.paymentAdded') })
                      setSelectedInvoiceForPayment(null)
                    } catch (e: any) {
                      toast({ title: t('invoices.paymentAddFailed'), description: e?.message, variant: 'destructive' })
                    }
                  }}
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold">{t('invoices.quickPayment.history')}</div>

              {quickPaymentsQuery.isLoading ? (
                <div className="mt-3 text-sm text-muted-foreground">{t('common.loading')}</div>
              ) : quickPaymentsQuery.isError ? (
                <div className="mt-3 text-sm text-destructive">
                  {(quickPaymentsQuery.error as any)?.message || t('invoices.payments.error')}
                </div>
              ) : (quickPaymentsQuery.data ?? []).length === 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">{t('invoices.quickPayment.historyEmpty')}</div>
              ) : (
                <div className="mt-3 overflow-hidden rounded-md border overflow-x-auto">
                  <table className="w-full min-w-[400px]">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground">
                          {t('invoices.payments.table.date')}
                        </th>
                        <th className="h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground">
                          {t('invoices.payments.table.method')}
                        </th>
                        <th className="h-9 px-3 text-right align-middle text-xs font-medium text-muted-foreground">
                          {t('invoices.payments.table.amount')}
                        </th>
                        <th className="h-9 px-3 text-right align-middle text-xs font-medium text-muted-foreground">
                          {t('invoices.payments.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quickPaymentsQuery.data ?? []).map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="p-3 text-sm">{formatShortDate(p.payment_date)}</td>
                          <td className="p-3 text-sm">{getPaymentMethodLabel(p.payment_method)}</td>
                          <td className="p-3 text-right text-sm tabular-nums font-medium">
                            {formatCurrency(Number(p.amount ?? 0))}
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletePayment.isPending}
                              onClick={async () => {
                                if (!selectedInvoiceForPayment?.id) return
                                try {
                                  await deletePayment.mutateAsync({ id: p.id, invoice_id: selectedInvoiceForPayment.id })
                                  toast({ title: t('invoices.paymentDeleted') })
                                } catch (e: any) {
                                  toast({
                                    title: t('invoices.paymentDeleteFailed'),
                                    description: e?.message,
                                    variant: 'destructive',
                                  })
                                }
                              }}
                            >
                              {t('common.delete')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedInvoiceForPayment(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(printingInvoice)}
        onOpenChange={(v) => {
          if (!v) setPrintingInvoice(null)
        }}
      >
        <DialogContent className="max-w-[980px] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{t('invoices.printDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[80vh] overflow-y-auto">
            {printingInvoice ? <InvoicePrintView invoiceId={printingInvoice.id} /> : null}
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              type="button"
              onClick={() => {
                window.print()
              }}
              disabled={!printingInvoice}
            >
              {t('invoices.printDialog.button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(v) => {
          setPaymentDialogOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('invoices.paymentDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">
                {t('invoices.paymentDialog.amountLabel', { currency: currencySymbol })}
              </div>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">{t('invoices.paymentDialog.dateLabel')}</div>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">{t('invoices.paymentDialog.methodLabel')}</div>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Banka">{t('invoices.bank')}</SelectItem>
                  <SelectItem value="Nakit">{t('invoices.cash')}</SelectItem>
                  <SelectItem value="Kredi Kartı">{t('invoices.creditCard')}</SelectItem>
                  <SelectItem value="Diğer">{t('invoices.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">{t('invoices.paymentDialog.notesLabel')}</div>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={t('invoices.paymentDialog.notesPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={createPayment.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={createPayment.isPending || !editingInvoice?.id}
              onClick={async () => {
                if (!editingInvoice?.id) return
                const amount = Number(paymentAmount)
                if (!amount || amount <= 0) {
                  toast({
                    title: t('invoices.quickPayment.invalidAmount'),
                    description: t('invoices.quickPayment.invalidAmountDescription'),
                    variant: 'destructive',
                  })
                  return
                }

                try {
                  await createPayment.mutateAsync({
                    invoice_id: editingInvoice.id,
                    amount,
                    payment_date: paymentDate,
                    payment_method: paymentMethod || null,
                    notes: paymentNotes.trim() || null,
                  })
                  toast({ title: t('invoices.paymentAdded') })
                  setPaymentDialogOpen(false)
                } catch (e: any) {
                  toast({ title: t('invoices.paymentAddFailed'), description: e?.message, variant: 'destructive' })
                }
              }}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}