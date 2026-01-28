import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { useTenant } from '../contexts/TenantContext'

type Tables = Database['public']['Tables']

type AccountRow = Tables['accounts']['Row']
type TransactionRow = Tables['transactions']['Row']
type CustomerRow = Tables['customers']['Row']
type DealRow = Tables['deals']['Row']
type CategoryRow = Tables['categories']['Row']
type InvoiceRow = Tables['invoices']['Row']
type InvoiceItemRow = Tables['invoice_items']['Row']
type PaymentRow = Tables['payments']['Row']
type ProductRow = Tables['products']['Row']
type ActivityRow = Tables['activities']['Row']
type NoteRow = Tables['notes']['Row']
type CustomerTransactionRow = Tables['customer_transactions']['Row']
type AttachmentRow = Tables['attachments']['Row']
type QuoteRow = Tables['quotes']['Row']
type QuoteItemRow = Tables['quote_items']['Row']

type InvoiceWithRelations = InvoiceRow & {
  customer?: CustomerRow | null
  invoice_items?: InvoiceItemRow[] | null
  payments?: PaymentRow[] | null
}

type QuoteWithItems = QuoteRow & {
  quote_items?: QuoteItemRow[] | null
}

type DeletePayload<T extends Record<string, unknown> = {}> = {
  id: string
  itemName?: string
} & T

export function useQuotesByDateRange(params?: DateRange) {
  const { companyId, tenantLoading } = useCompanyScope()
  const { fromKey, toKey } = rangeKeys(params)

  return useQuery<QuoteRow[]>({
    queryKey: ['quotes', companyId, fromKey, toKey],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      let query = supabase
        .from('quotes')
        .select('*')
        .eq('company_id', cid)
        .order('issue_date', { ascending: false })

      if (params?.from) query = query.gte('issue_date', params.from)
      if (params?.to) query = query.lte('issue_date', params.to)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

export function useConvertCustomerToLead() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; name?: string | null }) => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('customers')
        .update({ customer_status: 'lead' })
        .eq('id', payload.id)
        .eq('company_id', cid)
        .eq('customer_status', 'customer')
        .select()
        .single()
      if (error) throw error

      const customerName = (data as CustomerRow)?.name ?? payload.name ?? 'Müşteri'
      await logActivity(`"${customerName}" tekrar aday müşteriye dönüştürüldü.`)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['customer-with-relations', vars.id] })
    },
  })
}

export function useQuoteItems(quoteId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<QuoteItemRow[]>({
    queryKey: ['quote-items', companyId, quoteId],
    enabled: Boolean(quoteId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId as string)
        .eq('company_id', cid)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateQuote() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: {
      quote: Tables['quotes']['Insert']
      items: Array<Omit<Tables['quote_items']['Insert'], 'quote_id'>>
    }) => {
      const cid = ensureCompanyId(companyId)
      const quotePayload = withCompanyId(payload.quote, cid)
      const { data: quoteRow, error: quoteError } = await supabase.from('quotes').insert(quotePayload).select().single()
      if (quoteError) throw quoteError

      const quoteId = (quoteRow as QuoteRow).id
      const itemsPayload = payload.items.map((item) =>
        withCompanyId(
          {
            ...item,
            quote_id: quoteId,
          },
          cid
        )
      )

      if (itemsPayload.length) {
        const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload)
        if (itemsError) {
          await supabase.from('quotes').delete().eq('id', quoteId).eq('company_id', cid)
          throw itemsError
        }
      }

      await logActivity(`"${(quoteRow as QuoteRow).quote_number}" teklifi oluşturuldu.`)
      return quoteRow
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', (data as QuoteRow).id] })
    },
  })
}

export function useUpdateQuote() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: {
      id: string
      quote: Tables['quotes']['Update']
      items: Array<Omit<Tables['quote_items']['Insert'], 'quote_id'>>
    }) => {
      const cid = ensureCompanyId(companyId)
      const quotePayload = withCompanyId(payload.quote, cid)
      const { data, error } = await supabase
        .from('quotes')
        .update(quotePayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error

      const { error: deleteItemsError } = await supabase.from('quote_items').delete().eq('quote_id', payload.id).eq('company_id', cid)
      if (deleteItemsError) throw deleteItemsError

      const itemsPayload = payload.items.map((item) =>
        withCompanyId(
          {
            ...item,
            quote_id: payload.id,
          },
          cid
        )
      )

      if (itemsPayload.length) {
        const { error: insertItemsError } = await supabase.from('quote_items').insert(itemsPayload)
        if (insertItemsError) throw insertItemsError
      }

      await logActivity(`"${(data as QuoteRow).quote_number}" teklifi güncellendi.`)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['quote-items', vars.id] })
    },
  })
}

export function useDeleteQuote() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)

      const { error: itemsError } = await supabase.from('quote_items').delete().eq('quote_id', payload.id).eq('company_id', cid)
      if (itemsError) throw itemsError

      const { data, error } = await supabase.from('quotes').delete().eq('id', payload.id).eq('company_id', cid).select().single()
      if (error) throw error

      await logActivity(`"${(data as QuoteRow).quote_number}" teklifi silindi.`)
      return payload.id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      queryClient.invalidateQueries({ queryKey: ['quote-items', id] })
    },
  })
}

export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { quoteId: string }) => {
      const cid = ensureCompanyId(companyId)

      const { data: quoteRow, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', payload.quoteId)
        .eq('company_id', cid)
        .maybeSingle()
      if (quoteError) throw quoteError
      if (!quoteRow) throw new Error('Teklif bulunamadı')

      const { data: quoteItems, error: quoteItemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', payload.quoteId)
        .eq('company_id', cid)
      if (quoteItemsError) throw quoteItemsError

      const typedQuote: QuoteWithItems = {
        ...(quoteRow as QuoteRow),
        quote_items: (quoteItems as QuoteItemRow[] | null) ?? [],
      }
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id ?? typedQuote.user_id
      if (!userId) throw new Error('Oturum bulunamadı')

      const invoicePayload = withCompanyId(
        {
          user_id: userId,
          customer_id: typedQuote.customer_id,
          invoice_number: generateInvoiceNumber(),
          invoice_date: typedQuote.issue_date,
          due_date: typedQuote.expiry_date,
          status: 'pending' as Tables['invoices']['Insert']['status'],
          subtotal: typedQuote.subtotal,
          tax_amount: typedQuote.tax_amount,
          total_amount: typedQuote.total_amount,
          notes: typedQuote.notes,
        } satisfies Tables['invoices']['Insert'],
        cid
      )

      const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert(invoicePayload).select().single()
      if (invoiceError) throw invoiceError

      const invoiceId = (invoice as InvoiceRow).id
      const itemsPayload = (typedQuote.quote_items ?? []).map((item) =>
        withCompanyId(
          {
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: 0,
            amount: item.amount,
          } satisfies Tables['invoice_items']['Insert'],
          cid
        )
      )

      if (itemsPayload.length) {
        const { error: insertItemsError } = await supabase.from('invoice_items').insert(itemsPayload)
        if (insertItemsError) throw insertItemsError
      }

      const { error: updateQuoteError } = await supabase
        .from('quotes')
        .update({ status: 'converted' })
        .eq('id', payload.quoteId)
        .eq('company_id', cid)
      if (updateQuoteError) throw updateQuoteError

      await logActivity(`"${typedQuote.quote_number}" teklifi faturaya dönüştürüldü.`)
      return invoiceId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useQuote(quoteId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<QuoteRow | null>({
    queryKey: ['quote', companyId, quoteId],
    enabled: Boolean(quoteId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId as string)
        .eq('company_id', cid)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },
  })
}

type CustomerWithRelations = CustomerRow & {
  deals?: DealRow[] | null
  invoices?: InvoiceRow[] | null
}

type DateRange = {
  from?: string
  to?: string
}

interface CompanyScope {
  companyId: string | null
  tenantLoading: boolean
}

function useCompanyScope(): CompanyScope {
  const { companyId, loading } = useTenant()
  return { companyId, tenantLoading: loading }
}

function ensureCompanyId(companyId: string | null) {
  if (!companyId) {
    throw new Error('Şirket bilgisi bulunamadı')
  }
  return companyId
}

function withCompanyId<T extends Record<string, unknown>>(payload: T, companyId: string): T {
  return {
    ...payload,
    company_id: payload.company_id ?? companyId,
  } as T
}

async function logActivity(message: string) {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) return

  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    message,
  })

  if (error) {
    // Silent error handling
  }
}

function generateInvoiceNumber() {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const timePart = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const randomPart = Math.floor(Math.random() * 900) + 100
  return `INV-${datePart}${timePart}-${randomPart}`
}

function rangeKeys(params?: DateRange) {
  return {
    fromKey: params?.from ?? 'all',
    toKey: params?.to ?? 'all',
  }
}

// Accounts
export function useAccounts() {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<AccountRow[]>({
    queryKey: ['accounts', companyId],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerDeals(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<DealRow[]>({
    queryKey: ['customer-deals', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerInvoices(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<InvoiceRow[]>({
    queryKey: ['customer-invoices', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('invoice_date', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerQuotes(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<QuoteRow[]>({
    queryKey: ['customer-quotes', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('issue_date', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerTransactions(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<CustomerTransactionRow[]>({
    queryKey: ['customer-transactions', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('customer_transactions')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('transaction_date', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateCustomerTransaction() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['customer_transactions']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('customer_transactions').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity(`"${payload.description}" müşteri hareketi eklendi.`)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customer-transactions', cidFromPayload(vars)] })
    },
  })
}

export function useUpdateCustomerTransaction() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['customer_transactions']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('customer_transactions')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      const row = data as CustomerTransactionRow
      queryClient.invalidateQueries({ queryKey: ['customer-transactions', row.customer_id] })
    },
  })
}

export function useDeleteCustomerTransaction() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload<{ customer_id: string }>) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('customer_transactions').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['customer-transactions', payload.customer_id] })
    },
  })
}

function cidFromPayload(payload: Tables['customer_transactions']['Insert']) {
  return payload.customer_id
}

export function useCustomerFiles(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<AttachmentRow[]>({
    queryKey: ['customer-files', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useUploadCustomerFile() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { customer_id: string; file: File }) => {
      const cid = ensureCompanyId(companyId)
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const bucket = import.meta.env.VITE_CUSTOMER_FILES_BUCKET || 'customer-files'
      const fileExt = payload.file.name.split('.').pop()
      const filePath = `${cid}/${payload.customer_id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, payload.file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      const insertPayload = withCompanyId(
        {
          user_id: userId,
          customer_id: payload.customer_id,
          file_name: payload.file.name,
          file_url: publicUrl,
          file_type: payload.file.type,
          file_size: payload.file.size,
        } satisfies Tables['attachments']['Insert'],
        cid
      )

      const { data: attachment, error } = await supabase.from('attachments').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity(`"${payload.file.name}" dosyası yüklendi.`)
      return attachment
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customer-files', vars.customer_id] })
    },
  })
}

export function useDeleteCustomerFile() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { customer_id: string; path: string }) => {
      const cid = ensureCompanyId(companyId)
      const bucket = import.meta.env.VITE_CUSTOMER_FILES_BUCKET || 'customer-files'

      const { error: storageError } = await supabase.storage.from(bucket).remove([payload.path])
      if (storageError) throw storageError

      const { error } = await supabase.from('attachments').delete().eq('file_url', payload.path).eq('company_id', cid)
      if (error) throw error
      return payload
    },
    onSuccess: async (payload) => {
      queryClient.invalidateQueries({ queryKey: ['customer-files', payload.customer_id] })
      await logActivity('Müşteri dosyası silindi.')
    },
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['accounts']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('accounts').insert(insertPayload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['accounts']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('accounts')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('accounts').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

// Transactions
export function useTransactions(params?: DateRange) {
  return useTransactionsByDateRange(params)
}

export function useTransactionsByDateRange(params?: DateRange) {
  const { companyId, tenantLoading } = useCompanyScope()
  const { fromKey, toKey } = rangeKeys(params)

  return useQuery<TransactionRow[]>({
    queryKey: ['transactions', companyId, fromKey, toKey],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', cid)
        .order('transaction_date', { ascending: false })

      if (params?.from) query = query.gte('transaction_date', params.from)
      if (params?.to) query = query.lte('transaction_date', params.to)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['transactions']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('transactions').insert(insertPayload).select().single()
      if (error) throw error

      const amount = Number(payload.amount ?? 0).toLocaleString('tr-TR')
      await logActivity(`${payload.category ?? 'İşlem'} kaydı oluşturuldu (${amount} TL).`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['transactions']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('transactions')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('transactions').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

// Customers
export function useCustomers() {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<CustomerRow[]>({
    queryKey: ['customers', companyId],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomer(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<CustomerRow | null>({
    queryKey: ['customer', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId as string)
        .eq('company_id', cid)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },
  })
}

export function useCustomerWithRelations(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<CustomerWithRelations | null>({
    queryKey: ['customer-with-relations', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('customers')
        .select('*, deals(*), invoices(*)')
        .eq('id', customerId as string)
        .eq('company_id', cid)
        .maybeSingle()

      if (error) throw error
      return (data as CustomerWithRelations | null) ?? null
    },
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['customers']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('customers').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity(`"${(data as CustomerRow).name}" müşterisi oluşturuldu.`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['customers']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('customers')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['customer-with-relations', vars.id] })
    },
  })
}

export function useConvertLeadToCustomer() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; name?: string | null }) => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('customers')
        .update({ customer_status: 'customer' })
        .eq('id', payload.id)
        .eq('company_id', cid)
        .eq('customer_status', 'lead')
        .select()
        .single()
      if (error) throw error

      const customerName = (data as CustomerRow)?.name ?? payload.name ?? 'Aday müşteri'
      await logActivity(`"${customerName}" müşteriye dönüştürüldü.`)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['customer-with-relations', vars.id] })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('customers').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', id] })
      queryClient.invalidateQueries({ queryKey: ['customer-with-relations', id] })
    },
  })
}

export function useDeleteCustomerCascade() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; itemName?: string | null }) => {
      const cid = ensureCompanyId(companyId)

      // Fetch related invoices first so we can delete dependent rows
      const { data: invoiceRows, error: invoiceFetchError } = await supabase
        .from('invoices')
        .select('id')
        .eq('customer_id', payload.id)
        .eq('company_id', cid)
      if (invoiceFetchError) throw invoiceFetchError
      const invoiceIds = (invoiceRows ?? []).map((inv) => inv.id)

      if (invoiceIds.length > 0) {
        const { error: paymentsError } = await supabase
          .from('payments')
          .delete()
          .in('invoice_id', invoiceIds)
          .eq('company_id', cid)
        if (paymentsError) throw paymentsError

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .delete()
          .in('invoice_id', invoiceIds)
          .eq('company_id', cid)
        if (itemsError) throw itemsError

        const { error: invoicesDeleteError } = await supabase
          .from('invoices')
          .delete()
          .in('id', invoiceIds)
          .eq('company_id', cid)
        if (invoicesDeleteError) throw invoicesDeleteError
      }

      const { error } = await supabase.from('customers').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error

      const customerName = payload.itemName ?? 'Müşteri'
      await logActivity(`"${customerName}" ve ilişkili faturaları silindi.`)
      return payload.id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', id] })
      queryClient.invalidateQueries({ queryKey: ['customer-with-relations', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

// Deals
export function useDeals() {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<DealRow[]>({
    queryKey: ['deals', companyId],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateDeal() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['deals']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('deals').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity(`"${(data as DealRow).title}" fırsatı oluşturuldu.`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useUpdateDeal() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['deals']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('deals')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useDeleteDeal() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('deals').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

// Categories
export function useCategories(type?: 'income' | 'expense') {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<CategoryRow[]>({
    queryKey: ['categories', companyId, type ?? 'all'],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      let query = supabase.from('categories').select('*').eq('company_id', cid)
      if (type) query = query.eq('type', type)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['categories']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('categories').insert(insertPayload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['categories']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('categories')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('categories').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

// Invoices
export function useInvoices(params?: DateRange) {
  return useInvoicesByDateRange(params)
}

export function useInvoicesByDateRange(params?: DateRange) {
  const { companyId, tenantLoading } = useCompanyScope()
  const { fromKey, toKey } = rangeKeys(params)

  return useQuery<InvoiceWithRelations[]>({
    queryKey: ['invoices', companyId, fromKey, toKey],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)

      let invoiceQuery = supabase
        .from('invoices')
        .select('*')
        .eq('company_id', cid)
        .order('invoice_date', { ascending: false })

      if (params?.from) invoiceQuery = invoiceQuery.gte('invoice_date', params.from)
      if (params?.to) invoiceQuery = invoiceQuery.lte('invoice_date', params.to)

      const { data: invoices, error: invoiceError } = await invoiceQuery
      if (invoiceError) throw invoiceError

      const invoiceIds = (invoices ?? []).map((inv) => inv.id)
      if (invoiceIds.length === 0) return []

      const customerIds = Array.from(
        new Set(
          (invoices ?? [])
            .map((inv) => inv.customer_id)
            .filter((id): id is string => Boolean(id))
        )
      )

      const [customersRes, itemsRes, paymentsRes] = await Promise.all([
        customerIds.length
          ? supabase.from('customers').select('*').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('invoice_items').select('*').in('invoice_id', invoiceIds).eq('company_id', cid),
        supabase.from('payments').select('*').in('invoice_id', invoiceIds).eq('company_id', cid),
      ])

      if (customersRes.error) throw customersRes.error
      if (itemsRes.error) throw itemsRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const customersById = new Map((customersRes.data ?? []).map((customer) => [customer.id, customer]))
      const itemsByInvoice = new Map<string, InvoiceItemRow[]>()
      for (const rawItem of itemsRes.data ?? []) {
        const item = rawItem as InvoiceItemRow
        const entry = itemsByInvoice.get(item.invoice_id) ?? []
        entry.push(item)
        itemsByInvoice.set(item.invoice_id, entry)
      }

      const paymentsByInvoice = new Map<string, PaymentRow[]>()
      for (const rawPayment of paymentsRes.data ?? []) {
        const payment = rawPayment as PaymentRow
        const entry = paymentsByInvoice.get(payment.invoice_id) ?? []
        entry.push(payment)
        paymentsByInvoice.set(payment.invoice_id, entry)
      }

      return (invoices ?? []).map((invoice) => ({
        ...(invoice as InvoiceRow),
        customer: customersById.get(invoice.customer_id) ?? null,
        invoice_items: itemsByInvoice.get(invoice.id) ?? [],
        payments: paymentsByInvoice.get(invoice.id) ?? [],
      }))
    },
  })
}

export function useInvoice(invoiceId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<InvoiceWithRelations | null>({
    queryKey: ['invoice', companyId, invoiceId],
    enabled: Boolean(invoiceId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data: invoiceRow, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId as string)
        .eq('company_id', cid)
        .maybeSingle()

      if (invoiceError) throw invoiceError
      if (!invoiceRow) return null

      const [customerRes, itemsRes, paymentsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', invoiceRow.customer_id ?? '').maybeSingle(),
        supabase.from('invoice_items').select('*').eq('invoice_id', invoiceRow.id).eq('company_id', cid),
        supabase.from('payments').select('*').eq('invoice_id', invoiceRow.id).eq('company_id', cid),
      ])

      if (customerRes.error) throw customerRes.error
      if (itemsRes.error) throw itemsRes.error
      if (paymentsRes.error) throw paymentsRes.error

      return {
        ...(invoiceRow as InvoiceRow),
        customer: (customerRes.data as CustomerRow | null) ?? null,
        invoice_items: (itemsRes.data as InvoiceItemRow[] | null) ?? [],
        payments: (paymentsRes.data as PaymentRow[] | null) ?? [],
      }
    },
  })
}

export function useInvoiceItems(invoiceId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<InvoiceItemRow[]>({
    queryKey: ['invoice-items', companyId, invoiceId],
    enabled: Boolean(invoiceId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId as string)
        .eq('company_id', cid)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { invoice: Tables['invoices']['Insert']; items: Array<Omit<Tables['invoice_items']['Insert'], 'invoice_id'>> }) => {
      const cid = ensureCompanyId(companyId)
      const invoicePayload = withCompanyId(payload.invoice, cid)
      const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert(invoicePayload).select().single()
      if (invoiceError) throw invoiceError

      const invoiceId = (invoice as InvoiceRow).id
      const itemsPayload = payload.items.map((item) =>
        withCompanyId(
          {
            ...item,
            invoice_id: invoiceId,
          },
          cid
        )
      )

      if (itemsPayload.length) {
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload)
        if (itemsError) {
          await supabase.from('invoices').delete().eq('id', invoiceId).eq('company_id', cid)
          throw itemsError
        }
      }

      await logActivity(`"${(invoice as InvoiceRow).invoice_number}" faturası oluşturuldu.`)
      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; status: Tables['invoices']['Update']['status'] }) => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: payload.status, company_id: cid })
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error

      await logActivity(`"${(data as InvoiceRow).invoice_number}" durumu ${payload.status} olarak güncellendi.`)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', vars.id] })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['invoices']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('invoices')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', vars.id] })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('invoices').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
    },
  })
}

// Payments
export function useInvoicePayments(invoiceId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<PaymentRow[]>({
    queryKey: ['payments', companyId, invoiceId],
    enabled: Boolean(invoiceId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId as string)
        .eq('company_id', cid)
        .order('payment_date', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['payments']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('payments').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity('Yeni ödeme kaydedildi.')
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payments', vars.invoice_id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', vars.invoice_id] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload<{ invoice_id: string }>) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('payments').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['payments', payload.invoice_id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', payload.invoice_id] })
    },
  })
}

// Products
export function useProducts() {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<ProductRow[]>({
    queryKey: ['products', companyId],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['products']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const insertPayload = withCompanyId(payload, cid)
      const { data, error } = await supabase.from('products').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity(`"${(data as ProductRow).name}" ürünü eklendi.`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['products']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('products')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('products').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// Notes
export function useCustomerNotes(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<NoteRow[]>({
    queryKey: ['notes', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['notes']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const insertPayload = withCompanyId(
        {
          ...payload,
          user_id: payload.user_id ?? userId,
        },
        cid
      )

      const { data, error } = await supabase.from('notes').insert(insertPayload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['notes', companyId, vars.customer_id] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['notes']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const patchPayload = withCompanyId(payload.patch, cid)
      const { data, error } = await supabase
        .from('notes')
        .update(patchPayload)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      const customerId = (data as NoteRow)?.customer_id
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['notes', customerId] })
      }
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload<{ customer_id: string }>) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('notes').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['notes', payload.customer_id] })
    },
  })
}

// Activities
export function useActivities() {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<ActivityRow[]>({
    queryKey: ['activities', companyId],
    enabled: !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('company_id', cid)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerActivities(customerId?: string | null) {
  const { companyId, tenantLoading } = useCompanyScope()

  return useQuery<ActivityRow[]>({
    queryKey: ['activities', companyId, customerId],
    enabled: Boolean(customerId) && !tenantLoading && Boolean(companyId),
    queryFn: async () => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('customer_id', customerId as string)
        .eq('company_id', cid)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateActivity() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: Tables['activities']['Insert']) => {
      const cid = ensureCompanyId(companyId)
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const insertPayload = withCompanyId(
        {
          ...payload,
          user_id: payload.user_id ?? userId,
        },
        cid
      )

      const { data, error } = await supabase.from('activities').insert(insertPayload).select().single()
      if (error) throw error

      await logActivity(`"${(data as ActivityRow).subject}" aktivitesi oluşturuldu.`)
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['activities', companyId] })
      if (vars.customer_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', companyId, vars.customer_id] })
      }
    },
  })
}

export function useUpdateActivity() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['activities']['Update'] }) => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('activities')
        .update(payload.patch)
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities', companyId] })
      const customerId = (data as ActivityRow)?.customer_id
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['activities', companyId, customerId] })
      }
    },
  })
}

export function useToggleActivityCompleted() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: { id: string; is_completed: boolean }) => {
      const cid = ensureCompanyId(companyId)
      const { data, error } = await supabase
        .from('activities')
        .update({ is_completed: payload.is_completed })
        .eq('id', payload.id)
        .eq('company_id', cid)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities', companyId] })
      const customerId = (data as ActivityRow)?.customer_id
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['activities', companyId, customerId] })
      }
    },
  })
}

export function useDeleteActivity() {
  const queryClient = useQueryClient()
  const { companyId } = useCompanyScope()

  return useMutation({
    mutationFn: async (payload: DeletePayload<{ customer_id?: string | null }>) => {
      const cid = ensureCompanyId(companyId)
      const { error } = await supabase.from('activities').delete().eq('id', payload.id).eq('company_id', cid)
      if (error) throw error
      return payload
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['activities', companyId] })
      if (payload.customer_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', companyId, payload.customer_id] })
      }
    },
  })
}
