import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from '../components/layout/AppLayout'
import { CreateQuoteForm } from '../components/forms/CreateQuoteForm'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Skeleton } from '../components/ui/skeleton'
import { toast } from '../components/ui/use-toast'
import { Calendar } from '../components/ui/calendar'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { useCustomers, useDeleteQuote, useQuotesByDateRange, useConvertQuoteToInvoice } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { Database } from '../types/database'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQuota } from '../hooks/useQuota'
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
import { ArrowRightLeft, Calendar as CalendarIcon, Copy, ExternalLink, MessageCircle, Pencil, Plus, Search, Share2, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

type QuoteRow = Database['public']['Tables']['quotes']['Row']

type DateRange = {
  from?: Date
  to?: Date
}

const getQuoteStatusLabels = (t: (key: string) => string): Record<QuoteRow['status'], string> => ({
  draft: t('quotes.draft'),
  sent: t('quotes.sent'),
  accepted: t('quotes.accepted'),
  rejected: t('quotes.rejected'),
  converted: t('quotes.converted'),
})

const quoteBadgeVariants: Record<QuoteRow['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: {
    variant: 'secondary',
    className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/20',
  },
  sent: {
    variant: 'outline',
    className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400 dark:border-yellow-500/20',
  },
  accepted: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
  rejected: {
    variant: 'destructive',
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  },
  converted: {
    variant: 'outline',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/20',
  },
}

export function QuotesPage() {
  const { t } = useTranslation()
  const quoteStatusLabels = useMemo(() => getQuoteStatusLabels(t), [t])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = new Date()

  const [open, setOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState<QuoteRow | null>(null)
  const [deletingQuote, setDeletingQuote] = useState<QuoteRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const { loading: permissionsLoading, canViewModule, canEditModule } = usePermissions()
  const canViewQuotes = canViewModule('quotes')
  const canEditQuotes = canEditModule('quotes')
  const quoteQuota = useQuota('quotes')

  const showEditDenied = useCallback(() => {
    toast({
      title: t('errors.unauthorized'),
      description: t('quotes.noPermission'),
      variant: 'destructive',
    })
  }, [])

  const ensureCanEdit = useCallback(() => {
    if (!canEditQuotes) {
      showEditDenied()
      return false
    }
    if (!quoteQuota.canAdd) {
      toast({
        title: t('quotes.limitExceeded'),
        description: quoteQuota.message || t('quotes.quoteLimitReached'),
        variant: 'destructive',
      })
      return false
    }
    return true
  }, [canEditQuotes, showEditDenied, quoteQuota])

  const dateFromStr = useMemo(() => {
    return dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange?.from])

  const dateToStr = useMemo(() => {
    return dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange?.to])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return t('dashboard.dateRange')
    const from = format(dateRange.from, 'd MMM', { locale: tr })
    const to = format(dateRange.to, 'd MMM', { locale: tr })
    return `${from} - ${to}`
  }, [dateRange?.from, dateRange?.to, t])

  const quotesQuery = useQuotesByDateRange({ from: dateFromStr, to: dateToStr })
  const customersQuery = useCustomers()
  const deleteQuote = useDeleteQuote()
  const convertToInvoice = useConvertQuoteToInvoice()

  const quotes = quotesQuery.data ?? []

  const customersById = useMemo(() => {
    return new Map((customersQuery.data ?? []).map((c) => [c.id, c]))
  }, [customersQuery.data])

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return quotes

    return quotes.filter((row) => {
      const quoteNo = String(row.quote_number ?? '').toLowerCase()
      const customerName = String(customersById.get(row.customer_id)?.name ?? '').toLowerCase()
      return quoteNo.includes(q) || customerName.includes(q)
    })
  }, [customersById, quotes, searchQuery])

  if (permissionsLoading) {
    return (
      <AppLayout title={t('nav.quotes')}>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewQuotes) {
    return (
      <AppLayout title={t('nav.quotes')}>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <div className="text-2xl font-semibold">{t('quotes.noAccess')}</div>
          <p className="max-w-md text-muted-foreground">
            {t('quotes.noAccessDescription')}
          </p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={t('nav.quotes')}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t('quotes.pageTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('quotes.pageDescription')}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="whitespace-nowrap">{t('quotes.quoteList')}</CardTitle>
            <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
              <div className="relative w-full max-w-sm min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('quotes.searchPlaceholder')}
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange({ from: now, to: now })}>
                      {t('common.today')}
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
                      {t('quotes.thisWeek')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
                    >
                      {t('quotes.thisMonth')}
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
                      {t('quotes.lastMonth')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
                    >
                      {t('quotes.thisYear')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                      {t('quotes.clear')}
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{t('quotes.start')}</div>
                      <Calendar
                        selected={dateRange?.from}
                        locale={tr}
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
                    <div>
                      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{t('quotes.end')}</div>
                      <Calendar
                        selected={dateRange?.to}
                        locale={tr}
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
                </PopoverContent>
              </Popover>

              <Sheet
                open={open}
                onOpenChange={(v) => {
                  setOpen(v)
                  if (!v) setEditingQuote(null)
                }}
              >
                <SheetTrigger asChild>
                  <Button
                    disabled={!canEditQuotes}
                    onClick={() => {
                      if (!ensureCanEdit()) return
                      setEditingQuote(null)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('quotes.newQuote')}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[540px] lg:w-[900px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>{editingQuote ? t('quotes.editQuote') : t('quotes.newQuote')}</SheetTitle>
                  </SheetHeader>
                  <div className="px-6 pb-6">
                    {editingQuote ? (
                      <div className="mb-6 rounded-lg border p-4">
                        <div className="text-sm font-medium">{t('quotes.customerLink')}</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            readOnly
                            value={
                              editingQuote.token
                                ? `${window.location.origin}/p/quote/${editingQuote.token}`
                                : t('quotes.linkNotCreated')
                            }
                          />
                          {editingQuote.token ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      `${window.location.origin}/p/quote/${editingQuote.token}`
                                    )
                                    toast({ title: t('quotes.linkCopied') })
                                  } catch (e: any) {
                                    toast({
                                      title: t('quotes.copyFailed'),
                                      description: e?.message || t('common.errorOccurred'),
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              >
                                {t('quotes.copy')}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => window.open(`/p/quote/${editingQuote.token}`, '_blank', 'noopener,noreferrer')}
                              >
                                {t('quotes.preview')}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const newToken = crypto.randomUUID()
                                  const { error } = await supabase
                                    .from('quotes')
                                    .update({ token: newToken })
                                    .eq('id', editingQuote.id)
                                  if (error) throw error

                                  setEditingQuote({ ...editingQuote, token: newToken })
                                  queryClient.invalidateQueries({ queryKey: ['quotes'] })
                                  toast({ title: t('quotes.linkCreated') })
                                } catch (e: any) {
                                  toast({
                                    title: t('quotes.linkCreateFailed'),
                                    description: e?.message || t('common.errorOccurred'),
                                    variant: 'destructive',
                                  })
                                }
                              }}
                            >
                              {t('quotes.createLink')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <CreateQuoteForm
                      initialQuote={editingQuote ?? undefined}
                      onSuccess={() => {
                        setOpen(false)
                        toast({
                          title: editingQuote ? t('quotes.quoteUpdated') : t('quotes.quoteCreated'),
                        })
                        setEditingQuote(null)
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            {quotesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : quotesQuery.isError ? (
              <p className="text-sm text-destructive">
                {(quotesQuery.error as any)?.message || t('quotes.loadFailed')}
              </p>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('quotes.quoteNumber')}</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('quotes.customer')}</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('quotes.date')}</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t('quotes.status')}</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('quotes.total')}</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t('quotes.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-32 text-center">
                          <p className="text-sm text-muted-foreground">{t('quotes.emptyList')}</p>
                        </td>
                      </tr>
                    ) : (
                      filteredQuotes.map((q) => {
                        const customerName = customersById.get(q.customer_id)?.name ?? '-'
                        const badge = quoteBadgeVariants[q.status]

                        return (
                          <tr key={q.id} className="border-b">
                            <td className="p-4 font-medium">{q.quote_number}</td>
                            <td className="p-4">{customerName}</td>
                            <td className="p-4">{formatShortDate(q.issue_date)}</td>
                            <td className="p-4">
                              <Badge variant={badge.variant} className={badge.className}>
                                {quoteStatusLabels[q.status]}
                              </Badge>
                            </td>
                            <td className="p-4 text-right tabular-nums">{formatCurrency(Number(q.total_amount ?? 0))}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      title={q.token ? t('quotes.shareTooltip') : t('quotes.shareTooltipNoLink')}
                                      disabled={!q.token}
                                    >
                                      <Share2 className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                      align="end"
                                      sideOffset={6}
                                      className="z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                                    >
                                      <DropdownMenu.Item
                                        className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                        onSelect={async () => {
                                          try {
                                            if (!q.token) return
                                            const fullUrl = `${window.location.origin}/p/quote/${q.token}`
                                            await navigator.clipboard.writeText(fullUrl)
                                            toast({ title: t('quotes.linkCopied') })
                                          } catch (e: any) {
                                            toast({
                                              title: t('quotes.copyFailed'),
                                              description: e?.message || t('common.errorOccurred'),
                                              variant: 'destructive',
                                            })
                                          }
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                        {t('quotes.copyLink')}
                                      </DropdownMenu.Item>

                                      <DropdownMenu.Item
                                        className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                        onSelect={() => {
                                          if (!q.token) return
                                          const fullUrl = `${window.location.origin}/p/quote/${q.token}`
                                          window.open(fullUrl, '_blank', 'noopener,noreferrer')
                                        }}
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                        {t('quotes.preview')}
                                      </DropdownMenu.Item>

                                      <DropdownMenu.Item
                                        className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                        onSelect={() => {
                                          if (!q.token) return
                                          
                                          const customer = customersById.get(q.customer_id)
                                          if (!customer?.phone) {
                                            toast({
                                              title: t('quotes.phoneNotFound'),
                                              description: t('quotes.phoneNotFoundDesc'),
                                              variant: 'destructive',
                                            })
                                            return
                                          }

                                          // Clean phone number (remove spaces, parentheses, dashes)
                                          const rawPhone = String(customer.phone ?? '')
                                          let cleanPhone = rawPhone.replace(/\D/g, '')
                                          while (cleanPhone.startsWith('0')) {
                                            cleanPhone = cleanPhone.substring(1)
                                          }
                                          if (cleanPhone.length === 10) {
                                            cleanPhone = `90${cleanPhone}`
                                          }
                                          if (!cleanPhone) {
                                            toast({
                                              title: t('quotes.phoneError'),
                                              description: t('quotes.phoneMissing'),
                                              variant: 'destructive',
                                            })
                                            return
                                          }
                                          
                                          // Construct WhatsApp message with quote link
                                          const fullUrl = `${window.location.origin}/p/quote/${q.token}`
                                          const message = `Merhaba, teklifinizi aşağıdaki linkten inceleyebilirsiniz: ${fullUrl}`
                                          
                                          // Construct WhatsApp URL
                                          const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
                                          
                                          // Open in new tab
                                          window.open(whatsappUrl, '_blank')
                                        }}
                                      >
                                        <MessageCircle className="h-4 w-4 text-green-600" />
                                        {t('quotes.sendWhatsApp')}
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  title={t('quotes.edit')}
                                  disabled={!canEditQuotes}
                                  onClick={() => {
                                    if (!ensureCanEdit()) return
                                    setEditingQuote(q)
                                    setOpen(true)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  title={t('quotes.convertToInvoiceAction')}
                                  disabled={!canEditQuotes || q.status === 'converted' || convertToInvoice.isPending}
                                  onClick={async () => {
                                    if (!ensureCanEdit()) return
                                    try {
                                      const invoiceId = await convertToInvoice.mutateAsync({ quoteId: q.id })
                                      toast({ title: t('quotes.convertedToInvoice') })
                                      navigate(`/faturalar?open=${invoiceId}`)
                                    } catch (e: any) {
                                      toast({
                                        title: t('quotes.conversionFailed'),
                                        description: e?.message || t('common.errorOccurred'),
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t('quotes.delete')}
                                  className="text-destructive hover:text-destructive"
                                  disabled={!canEditQuotes}
                                  onClick={() => {
                                    if (!ensureCanEdit()) return
                                    setDeletingQuote(q)
                                  }}
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
          open={Boolean(deletingQuote)}
          onOpenChange={(v) => {
            if (!v) setDeletingQuote(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('quotes.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('quotes.deleteConfirmDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setDeletingQuote(null)}>
                {t('quotes.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteQuote.isPending || !deletingQuote}
                onClick={async () => {
                  if (!deletingQuote) return
                  try {
                    await deleteQuote.mutateAsync({ id: deletingQuote.id, itemName: deletingQuote.quote_number })
                    toast({ title: t('quotes.quoteDeleted') })
                  } catch (e: any) {
                    toast({
                      title: t('quotes.deleteFailed'),
                      description: e?.message || t('common.errorOccurred'),
                      variant: 'destructive',
                    })
                  } finally {
                    setDeletingQuote(null)
                  }
                }}
              >
                {t('quotes.delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}
