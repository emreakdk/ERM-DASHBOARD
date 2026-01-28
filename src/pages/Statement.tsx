import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '../components/ui/button'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatShortDate } from '../lib/format'
import type { Database } from '../types/database'

type CompanyProfileRow = Database['public']['Tables']['company_profiles']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type PaymentRow = Pick<Database['public']['Tables']['payments']['Row'], 'id' | 'amount' | 'payment_date' | 'payment_method' | 'notes'>
type InvoiceRow = Pick<Database['public']['Tables']['invoices']['Row'], 'id' | 'invoice_number' | 'invoice_date' | 'total_amount'> & {
  payments: PaymentRow[] | null
}

type LedgerLine = {
  id: string
  date: string
  description: string
  debit: number
  credit: number
  sortKey: string
}

type LedgerLineWithBalance = LedgerLine & { balance: number }

export function Statement() {
  const navigate = useNavigate()
  const { id } = useParams()
  const customerId = id ?? ''

  const companyProfileQuery = useQuery<CompanyProfileRow | null>({
    queryKey: ['statement', 'company_profile'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) return null

      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<CompanyProfileRow>()

      if (error) return null
      return data ?? null
    },
  })

  const customerQuery = useQuery<CustomerRow | null>({
    queryKey: ['statement', 'customer', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle<CustomerRow>()
      if (error) throw error
      return data ?? null
    },
  })

  const invoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ['statement', 'invoices', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, total_amount, payments(id, amount, payment_date, payment_method, notes)')
        .eq('customer_id', customerId)
        .order('invoice_date', { ascending: true })
        .returns<InvoiceRow[]>()

      if (error) throw error
      const invoices = (data ?? []) as InvoiceRow[]
      return invoices.map((invoice) => ({
        ...invoice,
        payments: invoice.payments ?? [],
      }))
    },
  })

  const { lines, totalBalance } = useMemo(() => {
    const invoices = invoicesQuery.data ?? []

    const rows: LedgerLine[] = []
    for (const inv of invoices) {
      rows.push({
        id: `inv:${inv.id}`,
        date: inv.invoice_date,
        description: `Fatura • ${inv.invoice_number}`,
        debit: Number(inv.total_amount ?? 0),
        credit: 0,
        sortKey: `${inv.invoice_date}-0-${inv.id}`,
      })

      for (const payment of inv.payments ?? []) {
        const method = payment.payment_method ? ` • ${payment.payment_method}` : ''
        rows.push({
          id: `pay:${payment.id}`,
          date: payment.payment_date,
          description: `Tahsilat${method} • ${inv.invoice_number}`,
          debit: 0,
          credit: Number(payment.amount ?? 0),
          sortKey: `${payment.payment_date}-1-${payment.id}`,
        })
      }
    }

    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    let balance = 0
    const withBalance = rows.map<LedgerLineWithBalance>((row) => {
      balance += Number(row.debit ?? 0) - Number(row.credit ?? 0)
      return { ...row, balance }
    })

    return {
      lines: withBalance,
      totalBalance: balance,
    }
  }, [invoicesQuery.data])

  const customer = customerQuery.data
  const companyProfile = companyProfileQuery.data
  const companyName = companyProfile?.company_name || 'Şirket'

  const loading = customerQuery.isLoading || invoicesQuery.isLoading
  const errorMessage = [customerQuery.error, invoicesQuery.error].reduce<string | undefined>((acc, current) => {
    if (acc) return acc
    if (!current) return undefined
    if (current instanceof Error) {
      return current.message
    }
    if (typeof current === 'string') {
      return current
    }
    if (typeof current === 'object' && 'message' in current) {
      const message = (current as { message?: unknown }).message
      return typeof message === 'string' ? message : undefined
    }
    return undefined
  }, undefined)

  return (
    <div className="min-h-screen bg-muted/30 p-6 print:bg-transparent print:p-0">
      <div className="mx-auto w-full max-w-[210mm]">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Geri
          </Button>
          <Button onClick={() => window.print()}>Yazdır / PDF İndir</Button>
        </div>

        <div className="bg-white text-slate-900 shadow-sm border print:shadow-none print:border-none">
          <div className="p-10" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <div className="flex items-start justify-between gap-6 border-b pb-4 mb-6">
              <div className="flex flex-col items-start">
                {companyProfile?.logo_url ? (
                  <img
                    src={companyProfile.logo_url}
                    alt="Logo"
                    className="h-12 w-auto max-w-[200px] object-contain mb-3"
                  />
                ) : null}
                <div className="text-left">
                  <div className="text-lg font-bold uppercase tracking-tight">{companyName}</div>
                  <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                    {companyProfile?.address ? <div>{companyProfile.address}</div> : null}
                    {companyProfile?.contact_email ? <div>{companyProfile.contact_email}</div> : null}
                    {companyProfile?.contact_phone ? <div>{companyProfile.contact_phone}</div> : null}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs tracking-wider text-slate-500 uppercase">Cari Hesap Ekstresi</div>
                <div className="mt-1 text-base font-semibold">{customer?.name || '-'}</div>
                <div className="mt-1 text-xs text-slate-600">
                  <div>Tarih: {formatShortDate(new Date().toISOString())}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="rounded-md border p-4">
                <div className="text-xs font-medium text-slate-500">Müşteri Bilgileri</div>
                <div className="mt-2 text-sm font-semibold">{customer?.name || '-'}</div>
                {customer?.address ? <div className="mt-2 text-sm text-slate-700">{customer.address}</div> : null}
                {customer?.email ? <div className="mt-2 text-sm text-slate-700">{customer.email}</div> : null}
                {customer?.phone ? <div className="text-sm text-slate-700">{customer.phone}</div> : null}
                {customer?.tax_number ? (
                  <div className="mt-2 text-sm text-slate-700">
                    Vergi No: {customer.tax_number}
                    {customer.tax_office ? ` • Vergi Dairesi: ${customer.tax_office}` : ''}
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border p-4">
                <div className="text-xs font-medium text-slate-500">Özet</div>
                <div className="mt-2 text-sm text-slate-700">Toplam Bakiye</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totalBalance)}</div>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-sm text-muted-foreground">Yükleniyor...</div>
            ) : errorMessage ? (
              <div className="py-10 text-sm text-destructive">{errorMessage}</div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-medium text-slate-600">
                      <th className="px-4 py-3">Tarih</th>
                      <th className="px-4 py-3">İşlem</th>
                      <th className="px-4 py-3 text-right">Borç</th>
                      <th className="px-4 py-3 text-right">Alacak</th>
                      <th className="px-4 py-3 text-right">Bakiye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                          Kayıt bulunamadı
                        </td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.id} className="border-t text-sm">
                          <td className="px-4 py-3">{formatShortDate(line.date)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{line.description}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{line.debit ? formatCurrency(line.debit) : '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{line.credit ? formatCurrency(line.credit) : '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(line.balance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-10 flex justify-end">
              <div className="w-full max-w-sm space-y-2">
                <div className="mt-2 flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-semibold">Genel Toplam Bakiye</span>
                  <span className="text-lg font-semibold tabular-nums">{formatCurrency(totalBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
