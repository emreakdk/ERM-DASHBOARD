import { AppLayout } from '../components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Calendar } from '../components/ui/calendar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Users,
  Briefcase,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  LabelList,
} from 'recharts'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  startOfDay,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { useAccounts, useCustomers, useDeals } from '../hooks/useSupabaseQuery'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

type DateRange = {
  from?: Date
  to?: Date
}

type TransactionRow = Database['public']['Tables']['transactions']['Row']
type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type DealRow = Database['public']['Tables']['deals']['Row']

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const now = new Date()
  const dateLocale = useMemo(() => (i18n.language?.startsWith('en') ? enUS : tr), [i18n.language])

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [accountFilterOpen, setAccountFilterOpen] = useState(false)
  const [accountFilterQuery, setAccountFilterQuery] = useState('')
  const [financialMode, setFinancialMode] = useState<'income' | 'expense'>('expense')
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: startOfMonth(now),
    to: endOfMonth(now),
  }))

  const accountsQuery = useAccounts()
  const customersQuery = useCustomers()
  const dealsQuery = useDeals()
  const accounts = accountsQuery.data ?? []
  const customers = customersQuery.data ?? []
  const deals = dealsQuery.data ?? []

  const dateFromStr = useMemo(() => {
    return dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined
  }, [dateRange.from])

  const dateToStr = useMemo(() => {
    return dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
  }, [dateRange.to])

  const selectedAccountKey = useMemo(() => {
    if (selectedAccountIds.length === 0) return 'all'
    return selectedAccountIds.slice().sort().join(',')
  }, [selectedAccountIds])

  const transactionsQuery = useQuery<TransactionRow[]>({
    queryKey: ['dashboard_transactions', selectedAccountKey, dateFromStr, dateToStr],
    enabled: Boolean(dateFromStr && dateToStr),
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })

      if (selectedAccountIds.length > 0) {
        q = q.in('bank_account', selectedAccountIds)
      }

      if (dateFromStr) {
        q = q.gte('transaction_date', dateFromStr)
      }

      if (dateToStr) {
        q = q.lte('transaction_date', dateToStr)
      }

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const invoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ['dashboard_invoices', dateFromStr, dateToStr],
    enabled: Boolean(dateFromStr && dateToStr),
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false })

      if (dateFromStr) {
        q = q.gte('invoice_date', dateFromStr)
      }

      if (dateToStr) {
        q = q.lte('invoice_date', dateToStr)
      }

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  const transactions = transactionsQuery.data ?? []
  const invoices = invoicesQuery.data ?? []

  const actionInvoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ['dashboard_action_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .neq('status', 'paid')
        .order('due_date', { ascending: true })
        .limit(25)

      if (error) throw error
      return data ?? []
    },
  })

  const accountsById = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]))
  }, [accounts])

  const customersById = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c]))
  }, [customers])

  const stageLabels: Record<DealRow['stage'], string> = {
    new: t('dashboard.newOpportunity'),
    meeting: t('dashboard.meeting'),
    proposal: t('dashboard.proposal'),
    negotiation: t('dashboard.negotiation'),
    won: t('dashboard.won'),
    lost: t('dashboard.lost'),
  }

  const activeStages: DealRow['stage'][] = ['new', 'meeting', 'proposal', 'negotiation']

  const pipelineSummary = useMemo(() => {
    const map = new Map<DealRow['stage'], { stage: DealRow['stage']; count: number; total: number }>()
    for (const s of activeStages) {
      map.set(s, { stage: s, count: 0, total: 0 })
    }

    for (const d of deals) {
      if (!activeStages.includes(d.stage)) continue
      const curr = map.get(d.stage) ?? { stage: d.stage, count: 0, total: 0 }
      curr.count += 1
      curr.total += Number(d.value ?? 0)
      map.set(d.stage, curr)
    }

    const rows = activeStages.map((s) => map.get(s)!).filter(Boolean)
    const pipelineTotal = rows.reduce((acc, r) => acc + r.total, 0)
    const maxStageTotal = Math.max(1, ...rows.map((r) => r.total))
    return { rows, pipelineTotal, maxStageTotal }
  }, [deals])

  const actionInvoices = actionInvoicesQuery.data ?? []
  const { overdueInvoices, upcomingInvoices } = useMemo(() => {
    const today = startOfDay(new Date())
    const upcomingLimit = addDays(today, 7)

    const overdue: InvoiceRow[] = []
    const upcoming: InvoiceRow[] = []

    for (const inv of actionInvoices) {
      if (inv.status === 'paid') continue
      const due = parseISO(inv.due_date)
      if (due < today) overdue.push(inv)
      else if (due <= upcomingLimit) upcoming.push(inv)
    }

    return {
      overdueInvoices: overdue.slice(0, 8),
      upcomingInvoices: upcoming.slice(0, 8),
    }
  }, [actionInvoices])

  const filteredAccounts = useMemo(() => {
    const q = accountFilterQuery.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => a.name.toLowerCase().includes(q))
  }, [accountFilterQuery, accounts])

  const fallbackLabel = t('dashboard.notSpecified')

  const accountFilterLabel = useMemo(() => {
    if (selectedAccountIds.length === 0) return t('dashboard.allAccounts')
    if (selectedAccountIds.length === 1) {
      const id = selectedAccountIds[0]
      return accountsById.get(id)?.name ?? t('dashboard.oneAccountSelected')
    }
    return t('dashboard.accountsSelected', { count: selectedAccountIds.length })
  }, [accountsById, selectedAccountIds, t])

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return t('dashboard.dateRange')
    const from = format(dateRange.from, 'd MMM', { locale: dateLocale })
    const to = format(dateRange.to, 'd MMM', { locale: dateLocale })
    return `${from} - ${to}`
  }, [dateLocale, dateRange.from, dateRange.to, t])

  const headerRight = (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:flex-nowrap">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2 lg:flex-nowrap">
        <div className="w-full sm:w-56">
          <Popover open={accountFilterOpen} onOpenChange={setAccountFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={accountFilterOpen}
                disabled={accountsQuery.isLoading || accountsQuery.isError}
                className={cn('h-10 w-full bg-white dark:bg-background justify-between border-border/50 shadow-sm', selectedAccountIds.length === 0 && 'text-muted-foreground')}
              >
                <span className="truncate">{accountsQuery.isLoading ? t('common.loading') : accountFilterLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
              <Command value={accountFilterQuery} onValueChange={setAccountFilterQuery}>
                <CommandInput placeholder={t('dashboard.searchAccount')} />
                <CommandList>
                  {filteredAccounts.length === 0 ? (
                    <CommandEmpty>{t('common.noData')}</CommandEmpty>
                  ) : null}
                  <CommandGroup>
                    <CommandItem
                      selected={selectedAccountIds.length === 0}
                      onClick={() => setSelectedAccountIds([])}
                      className="flex items-center gap-2"
                    >
                      <Check className={cn('h-4 w-4', selectedAccountIds.length === 0 ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{t('dashboard.allAccounts')}</span>
                    </CommandItem>

                    {filteredAccounts.map((a) => {
                      const isSelected = selectedAccountIds.includes(a.id)
                      return (
                        <CommandItem
                          key={a.id}
                          selected={isSelected}
                          onClick={() =>
                            setSelectedAccountIds((prev) =>
                              prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                            )
                          }
                          className="flex items-center gap-2"
                        >
                          <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{a.name}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-10 w-full bg-white dark:bg-background justify-between text-left font-normal border-border/50 shadow-sm sm:w-auto sm:justify-start',
                !dateRange.from && 'text-muted-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateRangeLabel}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto max-w-[90vw] p-3">
            <div className="flex flex-wrap gap-2 pb-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDateRange({ from: now, to: now })}>
                {t('dashboard.today')}
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
                {t('dashboard.thisWeek')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
              >
                {t('dashboard.thisMonth')}
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
                {t('dashboard.lastMonth')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
              >
                {t('dashboard.thisYear')}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{t('dashboard.dateRangeStart')}</div>
                <Calendar
                  selected={dateRange.from}
                  locale={dateLocale}
                  onSelect={(d) => {
                    if (!d) return
                    setDateRange((prev) => {
                      const to = prev.to
                      if (to && d > to) {
                        return { from: to, to: d }
                      }
                      return { from: d, to: to ?? d }
                    })
                  }}
                />
              </div>
              <div>
                <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{t('dashboard.dateRangeEnd')}</div>
                <Calendar
                  selected={dateRange.to}
                  locale={dateLocale}
                  onSelect={(d) => {
                    if (!d) return
                    setDateRange((prev) => {
                      const from = prev.from
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
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t('dashboard.quickInvoice')}
          aria-label={t('dashboard.quickInvoice')}
          onClick={() => navigate('/invoices/new')}
          className="h-10 w-10"
        >
          <FileText className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t('customers.addCustomer')}
          aria-label={t('customers.addCustomer')}
          onClick={() => navigate('/musteriler', { state: { openNew: true } })}
          className="h-10 w-10"
        >
          <Users className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t('dashboard.addOpportunity')}
          aria-label={t('dashboard.addOpportunity')}
          onClick={() => navigate('/firsatlar', { state: { openNew: true } })}
          className="h-10 w-10"
        >
          <Briefcase className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const { totalIncome, totalExpense, netProfit } = useMemo(() => {
    let income = 0
    let expense = 0

    for (const txn of transactions) {
      const amount = Number(txn.amount ?? 0)
      if (txn.type === 'income') income += amount
      if (txn.type === 'expense') expense += amount
    }

    return {
      totalIncome: income,
      totalExpense: expense,
      netProfit: income - expense,
    }
  }, [transactions])

  const pendingDebt = useMemo(() => {
    return invoices
      .filter((inv) => inv.status !== 'paid')
      .reduce((acc, inv) => acc + Number(inv.total_amount ?? 0), 0)
  }, [invoices])

  const incomeExpenseData = useMemo(() => {
    const byMonth = new Map<string, { income: number; expense: number }>()

    for (const txn of transactions) {
      const d = new Date(txn.transaction_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const prev = byMonth.get(key) ?? { income: 0, expense: 0 }
      const amount = Number(txn.amount ?? 0)
      if (txn.type === 'income') prev.income += amount
      if (txn.type === 'expense') prev.expense += amount
      byMonth.set(key, prev)
    }

    const anchor = startOfMonth(new Date())
    const padded: Array<{ name: string; income: number; expense: number }> = []

    for (let i = 5; i >= 0; i -= 1) {
      const d = startOfMonth(subMonths(anchor, i))
      const key = format(d, 'yyyy-MM')
      const v = byMonth.get(key) ?? { income: 0, expense: 0 }
      padded.push({ name: key, income: v.income, expense: v.expense })
    }

    return padded
  }, [transactions])

  const financialCategoryData = useMemo(() => {
    const totals = new Map<string, number>()
    const otherLabel = t('dashboard.other')

    for (const txn of transactions) {
      if (txn.type !== financialMode) continue
      const key = txn.category || otherLabel
      totals.set(key, (totals.get(key) ?? 0) + Number(txn.amount ?? 0))
    }

    const palette =
      financialMode === 'income'
        ? ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#22c55e', '#14b8a6', '#0ea5e9', '#64748b']
        : ['#ef4444', '#f97316', '#eab308', '#fb7185', '#f43f5e', '#f59e0b', '#64748b', '#a855f7', '#0ea5e9']

    return Array.from(totals.entries())
      .map(([name, value], idx) => ({ name, value, color: palette[idx % palette.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [financialMode, t, transactions])

  const financialCounterpartyData = useMemo(() => {
    const totals = new Map<string, number>()

    for (const txn of transactions) {
      if (txn.type !== financialMode) continue
      const customerName = txn.customer_id ? customersById.get(txn.customer_id)?.name : undefined
      const payee = String(txn.payee ?? '').trim()
      const key =
        financialMode === 'income'
          ? (customerName ?? payee ?? '').trim() || fallbackLabel
          : payee || customerName || fallbackLabel

      totals.set(key, (totals.get(key) ?? 0) + Number(txn.amount ?? 0))
    }

    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [customersById, fallbackLabel, financialMode, t, transactions])

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 10)
  }, [transactions])

  function FinancialBreakdownCard() {
    const isIncome = financialMode === 'income'
    const accent = isIncome ? '#10b981' : '#ef4444'
    const segmentedBase = isIncome ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'
    const segmentedActive = isIncome ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'

    return (
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t('dashboard.financialDistribution')}</CardTitle>

          <div className="flex items-center rounded-lg bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setFinancialMode('income')}
              className={cn(
                'h-8 px-3 rounded-md text-sm font-medium transition-colors',
                financialMode === 'income' ? segmentedActive : segmentedBase
              )}
            >
              {t('dashboard.revenue')}
            </button>
            <button
              type="button"
              onClick={() => setFinancialMode('expense')}
              className={cn(
                'h-8 px-3 rounded-md text-sm font-medium transition-colors',
                financialMode === 'expense' ? segmentedActive : segmentedBase
              )}
            >
              {t('dashboard.expense')}
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="categories" className="w-full">
            <TabsList className="flex w-full flex-wrap gap-2 sm:w-auto">
              <TabsTrigger value="categories">{t('dashboard.categoriesTab')}</TabsTrigger>
              <TabsTrigger value="payees">{t('dashboard.counterpartiesTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="mt-4">
              {financialCategoryData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">{t('dashboard.noDataToDisplay')}</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={financialCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        strokeWidth={0}
                      >
                        {financialCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="mt-4 space-y-2">
                    {financialCategoryData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground truncate">{item.name}</span>
                        </div>
                        <span className="font-medium tabular-nums">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="payees" className="mt-4">
              {financialCounterpartyData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">{t('dashboard.noDataToDisplay')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={financialCounterpartyData} layout="vertical" margin={{ left: 8, right: 36 }}>
                    <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" axisLine={false} tickLine={false} className="text-xs" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      width={140}
                      className="text-xs"
                      tickFormatter={(v) => {
                        const s = String(v)
                        return s.length > 20 ? `${s.slice(0, 20)}…` : s
                      }}
                    />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="value" fill={accent} barSize={20} radius={[0, 4, 4, 0]}>
                      <LabelList
                        dataKey="value"
                        position="right"
                        className="fill-foreground"
                        formatter={(v: any) => formatCurrency(Number(v))}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    )
  }

  return (
    <AppLayout title={t('dashboard.title')} headerRight={headerRight}>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('dashboard.totalRevenue')}
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('common.total')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('dashboard.totalExpense')}
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalExpense)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('common.total')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('dashboard.netProfit')}
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(netProfit)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('common.total')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('dashboard.pendingReceivables')}
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pendingDebt)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('common.total')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Income vs Expense Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('dashboard.revenueVsExpense')}</CardTitle>
            </CardHeader>
            <CardContent>
              {incomeExpenseData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">{t('dashboard.noDataToDisplay')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={incomeExpenseData}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-xs" />
                    <YAxis axisLine={false} tickLine={false} className="text-xs" />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />

                    <Area
                      type="monotone"
                      dataKey="income"
                      name={t('dashboard.revenue')}
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#incomeGradient)"
                      fillOpacity={1}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name={t('dashboard.expense')}
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#expenseGradient)"
                      fillOpacity={1}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Sales Pipeline Summary */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('dashboard.salesPipeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {dealsQuery.isLoading ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">{t('common.loading')}</p>
                </div>
              ) : pipelineSummary.rows.every((r) => r.count === 0) ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <p className="text-sm">{t('dashboard.noActiveDeals')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">{t('dashboard.pipelineTotal')}</div>
                    <div className="mt-1 text-lg font-semibold tabular-nums">
                      {formatCurrency(pipelineSummary.pipelineTotal)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {pipelineSummary.rows.map((r) => {
                      const barPct = Math.round((r.total / pipelineSummary.maxStageTotal) * 100)
                      return (
                        <div key={r.stage} className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {stageLabels[r.stage]}
                                <span className="text-xs text-muted-foreground">
                                  {' '}
                                  • {t('dashboard.opportunityCount', { count: r.count })}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {formatCurrency(r.total)}
                              </div>
                            </div>
                            <div className="w-24 shrink-0">
                              <div className="h-2 w-full rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-primary/70"
                                  style={{ width: `${Math.max(4, barPct)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <FinancialBreakdownCard />

          <Tabs defaultValue="transactions" className="w-full">
            <Card className="h-full">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="whitespace-nowrap">{t('dashboard.activityCardTitle')}</CardTitle>
                <TabsList className="flex h-9 w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                  <TabsTrigger value="transactions" className="h-8 flex-1 sm:flex-none">
                    {t('dashboard.recentTransactionsTab')}
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="h-8 flex-1 sm:flex-none">
                    {t('dashboard.collectionAlertsTab')}
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="transactions" className="mt-0">
                  {recentTransactions.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm">{t('dashboard.noTransactions')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentTransactions.map((txn) => {
                        const accountName = txn.bank_account ? accountsById.get(txn.bank_account)?.name : undefined
                        const amount = Number(txn.amount ?? 0)
                        const isIncome = txn.type === 'income'

                        return (
                          <div
                            key={txn.id}
                            className="group flex items-center justify-between gap-3 rounded-md border-b border-border pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/30"
                            onClick={() => navigate(`/finans?editId=${txn.id}`)}
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {txn.category}
                                {accountName ? ` • ${accountName}` : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatShortDate(txn.transaction_date)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  'text-sm font-semibold tabular-nums',
                                  isIncome ? 'text-green-600' : 'text-red-600'
                                )}
                              >
                                {isIncome ? '+' : '-'} {formatCurrency(amount)}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-0">
                  {actionInvoicesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm">{t('common.loading')}</p>
                    </div>
                  ) : overdueInvoices.length === 0 && upcomingInvoices.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p className="text-sm">{t('dashboard.noCollectionAlerts')}</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {overdueInvoices.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-medium text-red-600">{t('dashboard.overdue')}</div>
                          {overdueInvoices.map((inv) => {
                            const customerName = customersById.get(inv.customer_id)?.name ?? t('dashboard.customer')
                            const due = parseISO(inv.due_date)
                            const days = Math.max(1, differenceInCalendarDays(startOfDay(new Date()), due))
                            return (
                              <div
                                key={inv.id}
                                className="group flex items-center justify-between gap-3 rounded-md px-2 py-1 cursor-pointer hover:bg-muted/30"
                                onClick={() => navigate(`/faturalar?open=${inv.id}`)}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{customerName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {t('dashboard.overdueDescription', {
                                      date: formatShortDate(inv.due_date),
                                      days,
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold tabular-nums text-red-600">
                                    {formatCurrency(Number(inv.total_amount ?? 0))}
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}

                      {upcomingInvoices.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-medium text-orange-600">{t('dashboard.upcoming')}</div>
                          {upcomingInvoices.map((inv) => {
                            const customerName = customersById.get(inv.customer_id)?.name ?? t('dashboard.customer')
                            const due = parseISO(inv.due_date)
                            const daysLeft = Math.max(0, differenceInCalendarDays(due, startOfDay(new Date())))
                            return (
                              <div
                                key={inv.id}
                                className="group flex items-center justify-between gap-3 rounded-md px-2 py-1 cursor-pointer hover:bg-muted/30"
                                onClick={() => navigate(`/faturalar?open=${inv.id}`)}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{customerName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {t('dashboard.upcomingDescription', {
                                      date: formatShortDate(inv.due_date),
                                      days: daysLeft,
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold tabular-nums text-orange-600">
                                    {formatCurrency(Number(inv.total_amount ?? 0))}
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  )
}
