import { useEffect, useMemo, useState } from 'react'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
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
} from '../hooks/useSupabaseQuery'
import { INVOICE_STATUS_LABELS } from '../lib/constants'
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
import { tr } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  Printer,
  Search,
  Share2,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

const statusVariants: Record<InvoiceRow['status'], 'secondary' | 'default' | 'destructive'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'default',
  cancelled: 'destructive',
}

const statusBadgeClasses: Record<InvoiceRow['status'], string> = {
  draft: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  sent: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
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

function getInvoicePaymentStatus(inv: any) {
  const baseStatus = String(inv?.status ?? '')
  if (baseStatus === 'cancelled') return { key: 'cancelled', label: INVOICE_STATUS_LABELS.cancelled }
  if (baseStatus === 'draft') return { key: 'draft', label: INVOICE_STATUS_LABELS.draft }
  if (baseStatus === 'paid') return { key: 'paid', label: 'Ödendi' }

  const total = Number(inv?.total_amount ?? 0)
  const paidAmount = Array.isArray(inv?.payments)
    ? (inv.payments as any[]).reduce((acc, p) => acc + Number(p?.amount ?? 0), 0)
    : 0

  if (paidAmount <= 0) return { key: 'pending', label: 'Bekliyor' }
  if (paidAmount < total) return { key: 'partial', label: 'Kısmi Ödeme' }
  return { key: 'paid', label: 'Ödendi' }
}

export function InvoicesPage() {
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const openInvoiceId = searchParams.get('open')
  const [autoOpenAttempts, setAutoOpenAttempts] = useState(0)

  const [open, setOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null)
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceRow | null>(null)
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [paymentMethod, setPaymentMethod] = useState<string>('Banka')
  const [paymentNotes, setPaymentNotes] = useState('')

  const [quickPaymentAmount, setQuickPaymentAmount] = useState('')
  const [quickPaymentDate, setQuickPaymentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<string>('Banka')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const dateFromStr = useMemo(() => {
    return dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange?.from])

  const dateToStr = useMemo(() => {
    return dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange?.to])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Tarih Aralığı'
    const from = format(dateRange.from, 'd MMM', { locale: tr })
    const to = format(dateRange.to, 'd MMM', { locale: tr })
    return `${from} - ${to}`
  }, [dateRange?.from, dateRange?.to])

  const invoicesQuery = useInvoicesByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const deleteInvoice = useDeleteInvoice()

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

  useEffect(() => {
    if (!openInvoiceId) return

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
  }, [autoOpenAttempts, invoicesQuery, openInvoiceId, setSearchParams])

  return (
    <AppLayout title="Faturalar">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Faturalar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Faturalarınızı oluşturun ve yönetin
            </p>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">Fatura Listesi</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Fatura, müşteri veya hizmet ara..."
                  className="pl-9"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-9 bg-white dark:bg-background justify-start text-left font-normal border-border/50 shadow-sm',
                      !dateRange?.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-3">
                  <div className="flex flex-wrap gap-2 pb-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: now, to: now })}
                    >
                      Bugün
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDateRange({
                          from: startOfWeek(now, { weekStartsOn: 1 }),
                          to: endOfWeek(now, { weekStartsOn: 1 }),
                        })
                      }
                    >
                      Bu Hafta
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
                    >
                      Bu Ay
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const prev = subMonths(now, 1)
                        setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) })
                      }}
                    >
                      Geçen Ay
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
                    >
                      Bu Yıl
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                      Temizle
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">Başlangıç</div>
                      <Calendar
                        selected={dateRange?.from}
                        locale={tr}
                        onSelect={(d) => {
                          if (!d) return
                          setDateRange((prev) => {
                            const to = prev?.to
                            if (to && d > to) {
                              return { from: to, to: d }
                            }
                            return { from: d, to: to ?? d }
                          })
                        }}
                      />
                    </div>
                    <div>
                      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">Bitiş</div>
                      <Calendar
                        selected={dateRange?.to}
                        locale={tr}
                        onSelect={(d) => {
                          if (!d) return
                          setDateRange((prev) => {
                            const from = prev?.from
                            if (from && d < from) {
                              return { from: d, to: from }
                            }
                            return { from: from ?? d, to: d }
                          })
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Sheet
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingInvoice(null)
                }}
              >
                <SheetTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingInvoice(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Fatura
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[800px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>{editingInvoice ? 'Faturayı Düzenle' : 'Fatura Oluştur'}</SheetTitle>
                  </SheetHeader>
                  <div className="px-6 pb-6">
                    <CreateInvoiceForm
                      initialInvoice={editingInvoice ?? undefined}
                      initialItems={invoiceItemsQuery.data ?? undefined}
                      onSuccess={() => {
                        setOpen(false)
                        toast({
                          title: editingInvoice ? 'Fatura güncellendi' : 'Fatura oluşturuldu',
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
                            <div className="text-sm font-semibold">Ödemeler</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatCurrency(editingInvoiceTotals.paidAmount)} / {formatCurrency(editingInvoiceTotals.total)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              setPaymentAmount('')
                              setPaymentNotes('')
                              setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
                              setPaymentMethod('Banka')
                              setPaymentDialogOpen(true)
                            }}
                            disabled={createPayment.isPending || !editingInvoice?.id}
                          >
                            Ödeme Ekle
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
                          <div className="mt-4 text-sm text-muted-foreground">Yükleniyor...</div>
                        ) : paymentsQuery.isError ? (
                          <div className="mt-4 text-sm text-destructive">
                            {(paymentsQuery.error as any)?.message || 'Ödemeler yüklenemedi'}
                          </div>
                        ) : (paymentsQuery.data ?? []).length === 0 ? (
                          <div className="mt-4 text-sm text-muted-foreground">Henüz ödeme eklenmedi.</div>
                        ) : (
                          <div className="mt-4 overflow-hidden rounded-md border">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground">Tarih</th>
                                  <th className="h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground">Yöntem</th>
                                  <th className="h-10 px-3 text-right align-middle text-xs font-medium text-muted-foreground">Tutar</th>
                                  <th className="h-10 px-3 text-right align-middle text-xs font-medium text-muted-foreground">İşlem</th>
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
                                        disabled={deletePayment.isPending}
                                        onClick={async () => {
                                          if (!editingInvoice?.id) return
                                          try {
                                            await deletePayment.mutateAsync({ id: p.id, invoice_id: editingInvoice.id })
                                            toast({ title: 'Ödeme silindi' })
                                          } catch (e: any) {
                                            toast({ title: 'Silinemedi', description: e?.message, variant: 'destructive' })
                                          }
                                        }}
                                      >
                                        Sil
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
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            {invoicesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : invoicesQuery.isError ? (
              <p className="text-sm text-destructive">
                {(invoicesQuery.error as any)?.message || 'Faturalar yüklenemedi'}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Fatura No
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Tarih
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Müşteri
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Hizmet/Ürün
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                        Durum
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        Toplam
                      </th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">
                            Henüz fatura oluşturulmadı.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const customer = (inv as any)?.customer ?? customersById.get(inv.customer_id)
                        const items = ((inv as any)?.invoice_items ?? []) as Array<{ description?: string | null }>
                        const first = items[0]?.description ?? ''
                        const itemsLabel =
                          items.length === 0
                            ? '-'
                            : items.length === 1
                              ? String(first)
                              : `${String(first)} (+${items.length - 1} kalem)`

                        const displayStatus = getInvoicePaymentStatus(inv)
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
                                {displayStatus.key === 'draft' || displayStatus.key === 'cancelled'
                                  ? INVOICE_STATUS_LABELS[inv.status]
                                  : displayStatus.label}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-medium">
                              {formatCurrency(Number(inv.total_amount))}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setPrintingInvoice(inv)}
                                  title="Yazdır"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>

                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      title={inv.token ? 'Paylaş' : 'Paylaşmak için token gerekli'}
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
                                            toast({ title: 'Link kopyalandı' })
                                          } catch (e: any) {
                                            toast({
                                              title: 'Kopyalama başarısız',
                                              description: e?.message || 'Bilinmeyen hata',
                                              variant: 'destructive',
                                            })
                                          }
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                        Bağlantıyı Kopyala
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
                                        Önizle / Yazdır
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingInvoice(inv)
                                    setOpen(true)
                                  }}
                                  title="Düzenle"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedInvoiceForPayment(inv)
                                    setQuickPaymentAmount('')
                                    setQuickPaymentDate(format(new Date(), 'yyyy-MM-dd'))
                                    setQuickPaymentMethod('Banka')
                                  }}
                                  title="Hızlı Ödeme"
                                >
                                  <Wallet className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingInvoice(inv)}
                                  title="Sil"
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
              <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
              <AlertDialogDescription>
                Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingInvoice(null)}>
                Vazgeç
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
                    toast({ title: 'Fatura silindi' })
                  } catch (e: any) {
                    toast({
                      title: 'Silme işlemi başarısız',
                      description: e?.message,
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingInvoice(null)
                  }
                }}
              >
                Sil
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
              Hızlı Ödeme • {selectedInvoiceForPayment?.invoice_number}
              {selectedInvoiceForPayment
                ? ` • ${(selectedInvoiceForPayment as any)?.customer?.name ??
                    customersById.get(selectedInvoiceForPayment.customer_id)?.name ??
                    '-'}`
                : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="rounded-lg border bg-white dark:bg-background p-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Toplam</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatCurrency(quickInvoiceTotals.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Ödenen</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatCurrency(quickInvoiceTotals.paidAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Kalan</div>
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
              <div className="text-sm font-semibold">Ödeme Ekle</div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Tutar (₺)</div>
                  <Input
                    type="number"
                    step="0.01"
                    value={quickPaymentAmount}
                    onChange={(e) => setQuickPaymentAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Tarih</div>
                  <Input type="date" value={quickPaymentDate} onChange={(e) => setQuickPaymentDate(e.target.value)} />
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Yöntem</div>
                  <Select value={quickPaymentMethod} onValueChange={setQuickPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Banka">Banka</SelectItem>
                      <SelectItem value="Nakit">Nakit</SelectItem>
                      <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                      <SelectItem value="Diğer">Diğer</SelectItem>
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
                        title: 'Geçersiz tutar',
                        description: 'Lütfen geçerli bir ödeme tutarı girin.',
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
                      toast({ title: 'Ödeme eklendi' })
                      setSelectedInvoiceForPayment(null)
                    } catch (e: any) {
                      toast({ title: 'Ödeme eklenemedi', description: e?.message, variant: 'destructive' })
                    }
                  }}
                >
                  Kaydet
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm font-semibold">Ödeme Geçmişi</div>

              {quickPaymentsQuery.isLoading ? (
                <div className="mt-3 text-sm text-muted-foreground">Yükleniyor...</div>
              ) : quickPaymentsQuery.isError ? (
                <div className="mt-3 text-sm text-destructive">
                  {(quickPaymentsQuery.error as any)?.message || 'Ödemeler yüklenemedi'}
                </div>
              ) : (quickPaymentsQuery.data ?? []).length === 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">Henüz ödeme yok.</div>
              ) : (
                <div className="mt-3 overflow-hidden rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground">Tarih</th>
                        <th className="h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground">Yöntem</th>
                        <th className="h-9 px-3 text-right align-middle text-xs font-medium text-muted-foreground">Tutar</th>
                        <th className="h-9 px-3 text-right align-middle text-xs font-medium text-muted-foreground"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(quickPaymentsQuery.data ?? []).map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="p-3 text-sm">{formatShortDate(p.payment_date)}</td>
                          <td className="p-3 text-sm">{p.payment_method || '-'}</td>
                          <td className="p-3 text-right text-sm tabular-nums font-medium">{formatCurrency(Number(p.amount ?? 0))}</td>
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
                                  toast({ title: 'Ödeme silindi' })
                                } catch (e: any) {
                                  toast({ title: 'Silinemedi', description: e?.message, variant: 'destructive' })
                                }
                              }}
                            >
                              Sil
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
              Kapat
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
            <DialogTitle>Fatura Önizleme</DialogTitle>
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
              Yazdır / PDF İndir
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
            <DialogTitle>Ödeme Ekle</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Tutar (₺)</div>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Tarih</div>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Ödeme Yöntemi</div>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Banka">Banka</SelectItem>
                  <SelectItem value="Nakit">Nakit</SelectItem>
                  <SelectItem value="Kredi Kartı">Kredi Kartı</SelectItem>
                  <SelectItem value="Diğer">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Not</div>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="İsteğe bağlı" />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={createPayment.isPending}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={createPayment.isPending || !editingInvoice?.id}
              onClick={async () => {
                if (!editingInvoice?.id) return
                const amount = Number(paymentAmount)
                if (!amount || amount <= 0) {
                  toast({ title: 'Geçersiz tutar', description: 'Lütfen geçerli bir ödeme tutarı girin.', variant: 'destructive' })
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
                  toast({ title: 'Ödeme eklendi' })
                  setPaymentDialogOpen(false)
                } catch (e: any) {
                  toast({ title: 'Ödeme eklenemedi', description: e?.message, variant: 'destructive' })
                }
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
