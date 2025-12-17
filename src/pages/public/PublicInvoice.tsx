import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatShortDate } from '../../lib/format'

type PublicInvoicePayload = {
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string
    due_date: string
    status: 'draft' | 'sent' | 'paid' | 'cancelled'
    subtotal: number
    tax_amount: number
    total_amount: number
    notes: string | null
  }
  customer: {
    name: string
    address: string | null
    phone: string | null
    email: string | null
  }
  company_profile: {
    company_name: string | null
    logo_url: string | null
    contact_phone: string | null
    address: string | null
    website: string | null
  } | null
  items: Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    amount: number
  }>
  payments: Array<{
    id: string
    amount: number
    payment_date: string
    payment_method: string | null
  }>
}

function getPaymentStatus(total: number, paidAmount: number) {
  if (paidAmount <= 0) return { key: 'pending', label: 'Bekliyor', className: 'bg-slate-100 text-slate-800' }
  if (paidAmount < total) return { key: 'partial', label: 'Kısmi Ödeme', className: 'bg-blue-100 text-blue-800' }
  return { key: 'paid', label: 'Ödendi', className: 'bg-green-100 text-green-800' }
}

export function PublicInvoice() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<PublicInvoicePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const invoice = payload?.invoice

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!token) {
        setError('Geçersiz link')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase.rpc('public_invoice_get', { p_token: token })
        if (error) throw error

        if (!data) {
          setError('Fatura bulunamadı')
          return
        }

        if (!cancelled) {
          setPayload(data as any)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Fatura yüklenemedi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [token])

  const totals = useMemo(() => {
    const total = Number(invoice?.total_amount ?? 0)
    const paid = (payload?.payments ?? []).reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
    const remaining = Math.max(0, total - paid)
    return { total, paid, remaining }
  }, [invoice?.total_amount, payload?.payments])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  if (error || !payload || !invoice) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="text-lg font-semibold text-gray-900">Fatura görüntülenemedi</div>
          <div className="mt-2 text-sm text-gray-600">{error || 'Bilinmeyen hata'}</div>
        </div>
      </div>
    )
  }

  const profile = payload.company_profile
  const customer = payload.customer
  const items = payload.items ?? []
  const payments = payload.payments ?? []

  const status = getPaymentStatus(totals.total, totals.paid)
  const docLabel = status.key === 'paid' ? 'MAKBUZ' : 'FATURA'

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl print:max-w-none print:w-[210mm]">
        <div className="mb-4 flex items-center justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 rounded-md bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Yazdır / PDF İndir
          </button>
        </div>

        <div
          id="printable-invoice"
          className="bg-white shadow-xl rounded-lg p-8 md:p-12 print:shadow-none print:rounded-none print:p-10"
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col items-start gap-3">
              {profile?.logo_url ? (
                <img src={profile.logo_url} alt="Logo" className="h-12 w-auto object-contain" />
              ) : null}
              <div>
                <div className="text-lg font-semibold text-gray-900">{profile?.company_name || 'Firma'}</div>
                {profile?.website ? <div className="text-sm text-gray-500">{profile.website}</div> : null}
                {profile?.address ? <div className="mt-1 text-sm text-gray-600">{profile.address}</div> : null}
                {profile?.contact_phone ? <div className="mt-1 text-sm text-gray-600">{profile.contact_phone}</div> : null}
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                {docLabel}
              </div>
              <div className="mt-3 flex justify-end">
                <span className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600">Fatura No</div>
              <div className="text-base font-semibold text-gray-900">{invoice.invoice_number}</div>
              <div className="mt-2 text-sm text-gray-600">Tarih</div>
              <div className="text-sm font-medium text-gray-900">{formatShortDate(invoice.invoice_date)}</div>
            </div>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-500">GÖNDEREN</div>
              <div className="mt-2 text-sm text-gray-900">
                <div className="font-medium">{profile?.company_name || '-'}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-500">ALICI</div>
              <div className="mt-2 text-sm text-gray-900">
                <div className="font-medium">{customer?.name || '-'}</div>
                {customer?.address ? <div className="mt-1 text-gray-600">{customer.address}</div> : null}
                {customer?.phone ? <div className="mt-1 text-gray-600">{customer.phone}</div> : null}
                {customer?.email ? <div className="mt-1 text-gray-600">{customer.email}</div> : null}
              </div>
            </div>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 text-left font-semibold text-gray-700">Kalem</th>
                  <th className="py-3 text-right font-semibold text-gray-700">Adet</th>
                  <th className="py-3 text-right font-semibold text-gray-700">Birim Fiyat</th>
                  <th className="py-3 text-right font-semibold text-gray-700">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="py-4 pr-4 text-gray-900">{it.description}</td>
                    <td className="py-4 text-right tabular-nums text-gray-700">{Number(it.quantity).toLocaleString('tr-TR')}</td>
                    <td className="py-4 text-right tabular-nums text-gray-700">{formatCurrency(Number(it.unit_price || 0))}</td>
                    <td className="py-4 text-right tabular-nums font-medium text-gray-900">{formatCurrency(Number(it.amount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10">
            <div className="text-xs font-semibold tracking-wide text-gray-500">ÖDEME GEÇMİŞİ / TAHSİLATLAR</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 text-left font-semibold text-gray-700">Tarih</th>
                    <th className="py-3 text-left font-semibold text-gray-700">Yöntem</th>
                    <th className="py-3 text-right font-semibold text-gray-700">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-sm text-gray-600">
                        Henüz tahsilat kaydı yok.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-4 text-gray-900">{formatShortDate(p.payment_date)}</td>
                        <td className="py-4 text-gray-700">{p.payment_method || '-'}</td>
                        <td className="py-4 text-right tabular-nums font-medium text-gray-900">{formatCurrency(Number(p.amount || 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-700">
                <span>Ara Toplam</span>
                <span className="font-medium tabular-nums">{formatCurrency(Number(invoice.subtotal || 0))}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700">
                <span>KDV</span>
                <span className="font-medium tabular-nums">{formatCurrency(Number(invoice.tax_amount || 0))}</span>
              </div>
              <div className="flex items-center justify-between text-gray-900">
                <span className="font-semibold">Genel Toplam</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(Number(invoice.total_amount || 0))}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">
                <span className="font-semibold">Ödenen</span>
                <span className="font-bold tabular-nums">{formatCurrency(Number(totals.paid || 0))}</span>
              </div>
              <div
                className={
                  totals.remaining > 0
                    ? 'flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-red-900'
                    : 'flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-slate-900'
                }
              >
                <span className="font-semibold">Kalan Bakiye</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(Number(totals.remaining || 0))}</span>
              </div>
            </div>
          </div>

          {invoice.notes ? (
            <div className="mt-10">
              <div className="text-xs font-semibold tracking-wide text-gray-500">NOTLAR</div>
              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
