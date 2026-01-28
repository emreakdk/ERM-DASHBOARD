import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatShortDate } from '../../lib/format'
import type { Database } from '../../types/database'

type Tables = Database['public']['Tables']

type InvoiceRow = Tables['invoices']['Row']
type InvoiceItemRow = Tables['invoice_items']['Row']
type CustomerRow = Tables['customers']['Row']
type ProfileRow = Tables['profiles']['Row']

type CompanyProfileRow = {
  user_id: string
  company_name: string | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  website: string | null
}

export function InvoicePrintView({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation()
  const invoiceQuery = useQuery<InvoiceRow | null>({
    queryKey: ['invoice_print', 'invoice', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
      if (error) throw error
      return data ?? null
    },
  })

  const companyProfileQuery = useQuery<CompanyProfileRow | null>({
    queryKey: ['invoice_print', 'company_profile'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) return null

      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) return null
      return (data ?? null) as any
    },
  })

  const itemsQuery = useQuery<InvoiceItemRow[]>({
    queryKey: ['invoice_print', 'items', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })

  const customerQuery = useQuery<CustomerRow | null>({
    queryKey: ['invoice_print', 'customer', invoiceId, invoiceQuery.data?.customer_id],
    enabled: Boolean(invoiceQuery.data?.customer_id),
    queryFn: async () => {
      const customerId = invoiceQuery.data?.customer_id
      if (!customerId) return null

      const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).single()
      if (error) throw error
      return data ?? null
    },
  })

  const profileQuery = useQuery<ProfileRow | null>({
    queryKey: ['invoice_print', 'profile'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) return null

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) return null
      return data ?? null
    },
  })

  const invoice = invoiceQuery.data
  const items = itemsQuery.data ?? []
  const customer = customerQuery.data
  const profile = profileQuery.data
  const companyProfile = companyProfileQuery.data

  const totals = useMemo(() => {
    const subtotal = Number(invoice?.subtotal ?? 0)
    const tax = Number(invoice?.tax_amount ?? 0)
    const total = Number(invoice?.total_amount ?? subtotal + tax)
    return { subtotal, tax, total }
  }, [invoice?.subtotal, invoice?.tax_amount, invoice?.total_amount])

  if (invoiceQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">{t('common.loading')}</div>
    )
  }

  if (invoiceQuery.isError) {
    return (
      <div className="py-10 text-sm text-destructive">{(invoiceQuery.error as any)?.message || t('invoices.loadFailed')}</div>
    )
  }

  if (!invoice) {
    return <div className="py-10 text-sm text-muted-foreground">{t('invoices.invoiceNotFound')}</div>
  }

  const companyName = companyProfile?.company_name || profile?.company_name || t('invoices.pdf.companyName')
  const senderEmail = companyProfile?.contact_email || profile?.email || ''
  const senderPhone = companyProfile?.contact_phone || ''
  const senderAddress = companyProfile?.address || ''
  const senderWebsite = companyProfile?.website || ''
  const logoUrl = companyProfile?.logo_url || ''

  return (
    <div className="flex justify-center bg-muted/30 p-6 print:items-start print:justify-start print:min-h-0 print:h-auto print:p-0 print:m-0 print:bg-transparent">
      <div
        id="invoice-content"
        className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-sm border print:block print:w-full print:max-w-none print:min-h-0 print:shadow-none print:border-none"
      >
        <div className="p-10" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
          <div className="flex items-start justify-between border-b pb-4 mb-6">
            <div className="flex flex-col items-start">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-14 w-auto max-w-[200px] object-contain mb-3"
                />
              ) : null}
              <div className="text-left">
                <div className="text-lg font-bold uppercase tracking-tight">{companyName}</div>
                <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                  {senderAddress && <div>{senderAddress}</div>}
                  {senderEmail && <div>{senderEmail}</div>}
                  {senderPhone && <div>{senderPhone}</div>}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs tracking-wider text-slate-500 uppercase">{t('invoices.pdf.invoice')}</div>
              <div className="mt-1 text-base font-semibold">{invoice.invoice_number}</div>
              <div className="mt-1 text-xs text-slate-600">
                <div>{t('invoices.pdf.date')}: {formatShortDate(invoice.invoice_date)}</div>
                <div>{t('invoices.pdf.dueDate')}: {formatShortDate(invoice.due_date)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="rounded-md border p-4">
              <div className="text-xs font-medium text-slate-500">{t('invoices.pdf.to')}:</div>
              <div className="mt-2 text-sm font-semibold">{customer?.name ?? '-'}</div>
              {customer?.contact_person ? (
                <div className="text-sm text-slate-700">{customer.contact_person}</div>
              ) : null}
              {customer?.address ? <div className="mt-2 text-sm text-slate-700">{customer.address}</div> : null}
              <div className="mt-2 text-sm text-slate-700">{customer?.email ?? ''}</div>
              <div className="text-sm text-slate-700">{customer?.phone ?? ''}</div>
              {customer?.tax_number ? (
                <div className="mt-2 text-sm text-slate-700">
                  {t('invoices.pdf.taxNumber')}: {customer.tax_number}
                  {customer.tax_office ? ` • ${t('invoices.pdf.taxOffice')}: ${customer.tax_office}` : ''}
                </div>
              ) : null}
            </div>

            <div className="rounded-md border p-4">
              <div className="text-xs font-medium text-slate-500">{t('invoices.pdf.from')}:</div>
              <div className="mt-2 text-sm font-semibold">{companyName}</div>
              {senderAddress ? <div className="mt-2 text-sm text-slate-700">{senderAddress}</div> : null}
              {senderPhone ? <div className="text-sm text-slate-700">{senderPhone}</div> : null}
              {senderEmail ? <div className="text-sm text-slate-700">{senderEmail}</div> : null}
              {senderWebsite ? <div className="text-sm text-slate-700">{senderWebsite}</div> : null}
              <div className="mt-4 text-xs font-medium text-slate-500">{t('invoices.pdf.bankIban')}</div>
              <div className="mt-1 text-sm text-slate-700">TR00 0000 0000 0000 0000 0000 00</div>
            </div>
          </div>

          <div className="mt-10">
            <div className="overflow-hidden rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-600">
                    <th className="px-4 py-3">{t('invoices.pdf.description')}</th>
                    <th className="px-4 py-3 text-right">{t('invoices.pdf.quantity')}</th>
                    <th className="px-4 py-3 text-right">{t('invoices.pdf.unitPrice')}</th>
                    <th className="px-4 py-3 text-right">{t('invoices.pdf.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        {t('invoices.pdf.noItems')}
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="border-t text-sm">
                        <td className="px-4 py-3">
                          <div className="font-medium">{it.description}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{Number(it.quantity).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(it.unit_price))}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(Number(it.amount))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10 flex justify-end">
            <div className="w-full max-w-sm space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>{t('invoices.pdf.subtotal')}</span>
                <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span>{t('invoices.pdf.vat')}</span>
                <span className="tabular-nums">{formatCurrency(totals.tax)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-3">
                <span className="text-sm font-semibold">{t('invoices.pdf.total')}</span>
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes ? (
            <div className="mt-10 rounded-md border p-4">
              <div className="text-xs font-medium text-slate-500">{t('invoices.pdf.note')}</div>
              <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
