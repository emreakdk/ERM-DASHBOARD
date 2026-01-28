import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatShortDate } from '../../lib/format'

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted'

type PublicQuotePayload = {
  quote: {
    id: string
    user_id: string
    customer_id: string
    quote_number: string
    issue_date: string
    expiry_date: string
    status: QuoteStatus
    subtotal: number
    tax_rate: number
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
    amount: number
  }>
}

export function PublicQuote() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [payload, setPayload] = useState<PublicQuotePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quote = payload?.quote

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

        const { data, error } = await supabase.rpc('public_quote_get', { p_token: token })
        if (error) throw error

        if (!data) {
          setError('Teklif bulunamadı')
          return
        }

        if (!cancelled) {
          setPayload(data as PublicQuotePayload)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Teklif yüklenemedi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [token])

  const setStatus = async (next: 'accepted' | 'rejected') => {
    if (!token || !quote) return

    try {
      setSubmitting(true)
      const { error } = await supabase.rpc('public_quote_set_status', {
        p_token: token,
        p_status: next,
      })
      if (error) throw error

      setPayload((prev) => (prev ? { ...prev, quote: { ...prev.quote, status: next } } : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="text-gray-600">Yükleniyor...</div>
      </div>
    )
  }

  if (error || !payload || !quote) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="text-lg font-semibold text-gray-900">Teklif görüntülenemedi</div>
          <div className="mt-2 text-sm text-gray-600">{error || 'Bilinmeyen hata'}</div>
        </div>
      </div>
    )
  }

  const profile = payload.company_profile
  const customer = payload.customer
  const items = payload.items ?? []

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white shadow-xl rounded-lg p-8 md:p-12">
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
                TEKLİF
              </div>
              <div className="mt-3 text-sm text-gray-600">Teklif No</div>
              <div className="text-base font-semibold text-gray-900">{quote.quote_number}</div>
              <div className="mt-2 text-sm text-gray-600">Tarih</div>
              <div className="text-sm font-medium text-gray-900">{formatShortDate(quote.issue_date)}</div>
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

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-700">
                <span>Ara Toplam</span>
                <span className="font-medium tabular-nums">{formatCurrency(Number(quote.subtotal || 0))}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700">
                <span>KDV ({Number(quote.tax_rate || 0)}%)</span>
                <span className="font-medium tabular-nums">{formatCurrency(Number(quote.tax_amount || 0))}</span>
              </div>
              <div className="flex items-center justify-between text-gray-900">
                <span className="font-semibold">Genel Toplam</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(Number(quote.total_amount || 0))}</span>
              </div>
            </div>
          </div>

          {quote.notes ? (
            <div className="mt-10">
              <div className="text-xs font-semibold tracking-wide text-gray-500">NOTLAR</div>
              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</div>
            </div>
          ) : null}

          <div className="mt-10">
            {quote.status === 'accepted' ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                Teşekkürler! Teklif onaylandı, sizinle iletişime geçeceğiz.
              </div>
            ) : quote.status === 'rejected' ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700">Teklifi reddettiniz.</div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStatus('rejected')}
                  disabled={submitting}
                  className="h-11 rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                >
                  Reddet
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('accepted')}
                  disabled={submitting}
                  className="h-11 rounded-md bg-green-600 px-5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                >
                  Teklifi Onayla
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
