import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']

type AccountRow = Tables['accounts']['Row']
type CustomerRow = Tables['customers']['Row']
type TransactionRow = Tables['transactions']['Row']
type CategoryRow = Tables['categories']['Row']
type ProductRow = Tables['products']['Row']
type QuoteRow = Tables['quotes']['Row']
type QuoteItemRow = Tables['quote_items']['Row']
type DealRow = Tables['deals']['Row']
type ActivityLogRow = Tables['activity_logs']['Row']
type InvoiceRow = Tables['invoices']['Row']
type InvoiceItemRow = Tables['invoice_items']['Row']
type PaymentRow = Tables['payments']['Row']
type ActivityRow = Tables['activities']['Row']
type NoteRow = Tables['notes']['Row']
type AttachmentRow = Tables['attachments']['Row']

const CUSTOMER_FILES_BUCKET = (import.meta as any).env?.VITE_CUSTOMER_FILES_BUCKET || 'customer-files'

async function logActivity(message: string) {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) return

  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    message,
  })

  if (error) {
    console.warn('Activity log insert failed:', error)
  }
}

export function useCategories(type?: 'income' | 'expense') {
  return useQuery<CategoryRow[]>({
    queryKey: ['categories', type],
    queryFn: async () => {
      let query = supabase.from('categories').select('*')

      if (type) {
        query = query.eq('type', type)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export type CustomerFileItem = {
  name: string
  path: string
  signed_url: string | null
  metadata?: any
  created_at?: string | null
  updated_at?: string | null
}

export function useCustomerFiles(customerId?: string | null) {
  return useQuery<CustomerFileItem[]>({
    queryKey: ['customer-files', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const prefix = `${userId}/${customerId as string}/`
      const { data, error } = await supabase.storage.from(CUSTOMER_FILES_BUCKET).list(prefix, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (error) throw error

      const files = (data ?? []).filter((x: any) => x?.name)
      const withUrls = await Promise.all(
        files.map(async (f: any) => {
          const path = `${prefix}${String(f.name)}`
          const { data: signed, error: signedError } = await supabase.storage
            .from(CUSTOMER_FILES_BUCKET)
            .createSignedUrl(path, 60 * 60)
          if (signedError) {
            return {
              name: String(f.name),
              path,
              signed_url: null,
              metadata: (f as any).metadata,
              created_at: (f as any).created_at ?? null,
              updated_at: (f as any).updated_at ?? null,
            } as CustomerFileItem
          }

          return {
            name: String(f.name),
            path,
            signed_url: (signed as any)?.signedUrl ?? null,
            metadata: (f as any).metadata,
            created_at: (f as any).created_at ?? null,
            updated_at: (f as any).updated_at ?? null,
          } as CustomerFileItem
        })
      )

      return withUrls
    },
  })
}

export function useUploadCustomerFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { customer_id: string; file: File }) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const safeName = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${userId}/${payload.customer_id}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(CUSTOMER_FILES_BUCKET)
        .upload(path, payload.file, { upsert: false, contentType: payload.file.type })

      if (uploadError) {
        const msg = String((uploadError as any)?.message ?? '')
        if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found')) {
          throw new Error(`Bucket not found: ${CUSTOMER_FILES_BUCKET}`)
        }
        throw uploadError
      }

      return { path }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customer-files', vars.customer_id] })
    },
  })
}

export function useDeleteCustomerFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { customer_id: string; path: string }) => {
      const { error } = await supabase.storage.from(CUSTOMER_FILES_BUCKET).remove([payload.path])
      if (error) throw error
      return true
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customer-files', vars.customer_id] })
    },
  })
}

export function useCustomerNotes(customerId?: string | null) {
  return useQuery<NoteRow[]>({
    queryKey: ['notes', 'customer', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { customer_id: string; content: string }) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          customer_id: payload.customer_id,
          content: payload.content,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'customer', vars.customer_id] })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; content: string }) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const { data, error } = await supabase
        .from('notes')
        .update({ content: payload.content })
        .eq('id', payload.id)
        .eq('user_id', userId)
        .select()
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Not bulunamadı veya bu işlem için yetkiniz yok.')
      return data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      const customerId = data?.customer_id as string | undefined
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['notes', 'customer', customerId] })
      }
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string }) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const { error } = await supabase.from('notes').delete().eq('id', payload.id).eq('user_id', userId)
      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useCustomerAttachments(customerId?: string | null) {
  return useQuery<Array<AttachmentRow & { signed_url: string | null }>>({
    queryKey: ['attachments', 'customer', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data ?? []) as AttachmentRow[]
      const withUrls = await Promise.all(
        rows.map(async (row) => {
          const path = String((row as any).file_url ?? '')
          if (!path) return { ...row, signed_url: null }
          const { data: signed, error: signedError } = await supabase
            .storage
            .from(CUSTOMER_FILES_BUCKET)
            .createSignedUrl(path, 60 * 60)
          if (signedError) return { ...row, signed_url: null }
          return { ...row, signed_url: signed?.signedUrl ?? null }
        })
      )

      return withUrls
    },
  })
}

export function useUploadCustomerAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { customer_id: string; file: File }) => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) throw new Error('Oturum bulunamadı')

      const safeName = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${userId}/${payload.customer_id}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase
        .storage
        .from(CUSTOMER_FILES_BUCKET)
        .upload(path, payload.file, { upsert: false, contentType: payload.file.type })

      if (uploadError) {
        const msg = String((uploadError as any)?.message ?? '')
        if (msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found')) {
          throw new Error(`Bucket not found: ${CUSTOMER_FILES_BUCKET}`)
        }
        throw uploadError
      }

      const { data, error } = await supabase
        .from('attachments')
        .insert({
          user_id: userId,
          customer_id: payload.customer_id,
          file_name: payload.file.name,
          file_url: path,
          file_type: payload.file.type || 'application/octet-stream',
          file_size: payload.file.size,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'customer', vars.customer_id] })
    },
  })
}

export function useDeleteCustomerAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; customer_id: string; file_url: string }) => {
      const path = payload.file_url
      if (path) {
        const { error: removeError } = await supabase.storage.from(CUSTOMER_FILES_BUCKET).remove([path])
        if (removeError) throw removeError
      }

      const { error } = await supabase.from('attachments').delete().eq('id', payload.id)
      if (error) throw error
      return true
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', 'customer', vars.customer_id] })
    },
  })
}

export function useActivities() {
  return useQuery<ActivityRow[]>({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerActivities(customerId?: string) {
  return useQuery<ActivityRow[]>({
    queryKey: ['activities', 'customer', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      if (!customerId) return []

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('customer_id', customerId)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Tables['activities']['Insert']) => {
      const { data, error } = await supabase.from('activities').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['activities', 'customer'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['activities']['Update'] }) => {
      const { data, error } = await supabase
        .from('activities')
        .update(payload.patch)
        .eq('id', payload.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['activities', 'customer'] })
      const customerId = (vars.patch as any)?.customer_id as string | undefined
      if (customerId) queryClient.invalidateQueries({ queryKey: ['activities', 'customer', customerId] })
    },
  })
}

export function useToggleActivityCompleted() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; is_completed: boolean }) => {
      const { data, error } = await supabase
        .from('activities')
        .update({ is_completed: payload.is_completed })
        .eq('id', payload.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['activities', 'customer'] })
    },
  })
}

export function useDeleteActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string }) => {
      const { error } = await supabase.from('activities').delete().eq('id', payload.id)
      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['activities', 'customer'] })
    },
  })
}

export function useDeals() {
  return useQuery<DealRow[]>({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (deal: Tables['deals']['Insert']) => {
      const { data, error } = await supabase
        .from('deals')
        .insert(deal)
        .select()
        .single()

      if (error) throw error

      const title = (data as any)?.title as string | undefined
      if (title) {
        await logActivity(`"${title}" fırsatı oluşturuldu.`)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useUpdateDeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['deals']['Update'] }) => {
      const { data, error } = await supabase
        .from('deals')
        .update(payload.patch)
        .eq('id', payload.id)
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

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('deals').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useQuotes() {
  return useQuotesByDateRange()
}

export function useQuotesByDateRange(params?: { from?: string; to?: string }) {
  const fromKey = params?.from ?? 'all'
  const toKey = params?.to ?? 'all'

  return useQuery<QuoteRow[]>({
    queryKey: ['quotes', fromKey, toKey],
    queryFn: async () => {
      let q = supabase
        .from('quotes')
        .select('*')
        .order('issue_date', { ascending: false })

      if (params?.from) {
        q = q.gte('issue_date', params.from)
      }

      if (params?.to) {
        q = q.lte('issue_date', params.to)
      }

      const { data, error } = await q

      if (error) throw error
      return data ?? []
    },
  })
}

export function useQuoteItems(quoteId?: string | null) {
  return useQuery<QuoteItemRow[]>({
    queryKey: ['quote_items', quoteId],
    enabled: Boolean(quoteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId as string)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      quote: Tables['quotes']['Insert']
      items: Array<Omit<Tables['quote_items']['Insert'], 'quote_id'>>
    }) => {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert(payload.quote)
        .select()
        .single()

      if (quoteError) throw quoteError

      const quoteId = (quote as any).id as string
      const itemsToInsert: Tables['quote_items']['Insert'][] = payload.items.map((it) => ({
        ...it,
        quote_id: quoteId,
      }))

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert)

      if (itemsError) {
        await supabase.from('quotes').delete().eq('id', quoteId)
        throw itemsError
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', payload.quote.customer_id)
        .single()

      const customerName = (customer as any)?.name as string | undefined
      const totalAmount = Number((quote as any)?.total_amount ?? payload.quote.total_amount ?? 0)
      await logActivity(
        `"${customerName ?? 'Müşteri'}" için ${totalAmount.toLocaleString('tr-TR')} TL tutarında teklif oluşturuldu.`
      )

      return quote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useUpdateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      id: string
      quote: Tables['quotes']['Update']
      items: Array<Omit<Tables['quote_items']['Insert'], 'quote_id'>>
    }) => {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .update(payload.quote)
        .eq('id', payload.id)
        .select()
        .single()

      if (quoteError) throw quoteError

      const { error: deleteItemsError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', payload.id)

      if (deleteItemsError) throw deleteItemsError

      const itemsToInsert: Tables['quote_items']['Insert'][] = payload.items.map((it) => ({
        ...it,
        quote_id: payload.id,
      }))

      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      return quote
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote_items', variables.id] })
    },
  })
}

export function useDeleteQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('quotes').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote_items', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useConvertQuoteToInvoice() {
  const queryClient = useQueryClient()

  const createInvoiceNumber = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand = Math.floor(Math.random() * 9000 + 1000)
    return `INV-${yyyy}${mm}${dd}-${rand}`
  }

  return useMutation({
    mutationFn: async (payload: { quoteId: string }) => {
      const quoteId = payload.quoteId

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single()

      if (quoteError) throw quoteError

      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true })

      if (itemsError) throw itemsError

      const invoiceInsert: Tables['invoices']['Insert'] = {
        user_id: (quote as any).user_id,
        customer_id: (quote as any).customer_id,
        invoice_number: createInvoiceNumber(),
        invoice_date: (quote as any).issue_date,
        due_date: (quote as any).expiry_date,
        status: 'draft',
        subtotal: Number((quote as any).subtotal ?? 0),
        tax_amount: Number((quote as any).tax_amount ?? 0),
        total_amount: Number((quote as any).total_amount ?? 0),
        notes: (quote as any).notes ?? null,
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceInsert)
        .select()
        .single()

      if (invoiceError) throw invoiceError

      const invoiceId = (invoice as any).id as string
      const taxRate = Number((quote as any).tax_rate ?? 0)

      const invoiceItems: Tables['invoice_items']['Insert'][] = (items ?? []).map((it: any) => ({
        invoice_id: invoiceId,
        description: String(it.description ?? ''),
        quantity: Number(it.quantity ?? 0),
        unit_price: Number(it.unit_price ?? 0),
        tax_rate: taxRate,
        amount: Number(it.amount ?? 0),
      }))

      const { error: invoiceItemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems)

      if (invoiceItemsError) {
        await supabase.from('invoices').delete().eq('id', invoiceId)
        throw invoiceItemsError
      }

      const { error: markConvertedError } = await supabase
        .from('quotes')
        .update({ status: 'converted' })
        .eq('id', quoteId)

      if (markConvertedError) throw markConvertedError

      await logActivity(`"${(quote as any).quote_number}" teklifi faturaya dönüştürüldü.`)

      return invoiceId
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (category: Tables['categories']['Insert']) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category)
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

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('categories').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useActivityLogs(limit = 10) {
  return useQuery<ActivityLogRow[]>({
    queryKey: ['activity_logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data ?? []
    },
  })
}

export function useAccounts() {
  return useQuery<AccountRow[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['customers']['Update'] }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(payload.patch)
        .eq('id', payload.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('customers').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useDeleteCustomerCascade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const customerId = payload.id

      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('id')
        .eq('customer_id', customerId)

      if (quotesError) throw quotesError

      const quoteIds = (quotes ?? []).map((q) => q.id)

      if (quoteIds.length > 0) {
        const { error: deleteQuoteItemsError } = await supabase
          .from('quote_items')
          .delete()
          .in('quote_id', quoteIds)

        if (deleteQuoteItemsError) throw deleteQuoteItemsError

        const { error: deleteQuotesError } = await supabase
          .from('quotes')
          .delete()
          .eq('customer_id', customerId)

        if (deleteQuotesError) throw deleteQuotesError
      }

      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id')
        .eq('customer_id', customerId)

      if (dealsError) throw dealsError

      const dealIds = (deals ?? []).map((d) => d.id)

      const { error: deleteCustomerActivitiesError } = await supabase
        .from('activities')
        .delete()
        .eq('customer_id', customerId)

      if (deleteCustomerActivitiesError) throw deleteCustomerActivitiesError

      if (dealIds.length > 0) {
        const { error: deleteDealActivitiesError } = await supabase
          .from('activities')
          .delete()
          .in('deal_id', dealIds)

        if (deleteDealActivitiesError) throw deleteDealActivitiesError

        const { error: deleteDealsError } = await supabase
          .from('deals')
          .delete()
          .eq('customer_id', customerId)

        if (deleteDealsError) throw deleteDealsError
      }

      const { error: detachTransactionsError } = await supabase
        .from('transactions')
        .update({ customer_id: null })
        .eq('customer_id', customerId)

      if (detachTransactionsError) throw detachTransactionsError

      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id')
        .eq('customer_id', customerId)

      if (invoicesError) throw invoicesError

      const invoiceIds = (invoices ?? []).map((i) => i.id)

      if (invoiceIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .delete()
          .in('invoice_id', invoiceIds)

        if (itemsError) throw itemsError

        const { error: deleteInvoicesError } = await supabase
          .from('invoices')
          .delete()
          .eq('customer_id', customerId)

        if (deleteInvoicesError) throw deleteInvoicesError
      }

      const { error: deleteCustomerError } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)

      if (deleteCustomerError) throw deleteCustomerError

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return customerId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['transactions']['Update'] }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(payload.patch)
        .eq('id', payload.id)
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

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('transactions').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useProducts() {
  return useQuery<ProductRow[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (product: Tables['products']['Insert']) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()

      if (error) throw error

      const name = (data as any)?.name as string | undefined
      if (name) {
        await logActivity(`"${name}" ürünü/hizmeti eklendi.`)
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['products']['Update'] }) => {
      const { data, error } = await supabase
        .from('products')
        .update(payload.patch)
        .eq('id', payload.id)
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

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('products').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; patch: Tables['accounts']['Update'] }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(payload.patch)
        .eq('id', payload.id)
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

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('accounts').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      id: string
      invoice: Tables['invoices']['Update']
      items: Array<Omit<Tables['invoice_items']['Insert'], 'invoice_id'>>
    }) => {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .update(payload.invoice)
        .eq('id', payload.id)
        .select()
        .single()

      if (invoiceError) throw invoiceError

      const { error: deleteItemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', payload.id)

      if (deleteItemsError) throw deleteItemsError

      const itemsToInsert: Tables['invoice_items']['Insert'][] = payload.items.map((it) => ({
        ...it,
        invoice_id: payload.id,
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      return invoice
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice_items', variables.id] })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; itemName: string }) => {
      const { error } = await supabase.from('invoices').delete().eq('id', payload.id)
      if (error) throw error

      await logActivity(`"${payload.itemName}" kaydı silindi.`)
      return payload.id
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice_items', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useInvoiceItems(invoiceId?: string | null) {
  return useQuery<InvoiceItemRow[]>({
    queryKey: ['invoice_items', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId as string)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      invoice: Tables['invoices']['Insert']
      items: Array<Omit<Tables['invoice_items']['Insert'], 'invoice_id'>>
    }) => {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(payload.invoice)
        .select()
        .single()

      if (invoiceError) throw invoiceError

      const invoiceId = (invoice as any).id as string
      const itemsToInsert: Tables['invoice_items']['Insert'][] = payload.items.map((it) => ({
        ...it,
        invoice_id: invoiceId,
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsError) {
        await supabase.from('invoices').delete().eq('id', invoiceId)
        throw itemsError
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', payload.invoice.customer_id)
        .single()

      const customerName = (customer as any)?.name as string | undefined
      const totalAmount = Number((invoice as any)?.total_amount ?? payload.invoice.total_amount ?? 0)
      await logActivity(
        `"${customerName ?? 'Müşteri'}" için ${totalAmount.toLocaleString('tr-TR')} TL tutarında fatura oluşturuldu.`
      )

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useCustomers() {
  return useQuery<CustomerRow[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomer(customerId?: string | null) {
  return useQuery<CustomerRow | null>({
    queryKey: ['customers', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId as string)
        .single()

      if (error) throw error
      return (data ?? null) as CustomerRow | null
    },
  })
}

export function useCustomerInvoices(customerId?: string | null) {
  return useQuery<
    Array<
      InvoiceRow & {
        invoice_items?: InvoiceItemRow[] | null
      }
    >
  >({
    queryKey: ['customer_invoices', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = (await supabase
        .from('invoices')
        .select('*, invoice_items(*), payments(amount)')
        .eq('customer_id', customerId as string)
        .order('invoice_date', { ascending: false })) as any

      if (error) throw error
      return (data ?? []) as Array<
        InvoiceRow & {
          invoice_items?: InvoiceItemRow[] | null
        }
      >
    },
  })
}

export function useCustomerDeals(customerId?: string | null) {
  return useQuery<DealRow[]>({
    queryKey: ['customer_deals', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

export function useCustomerQuotes(customerId?: string | null) {
  return useQuery<
    Array<
      QuoteRow & {
        quote_items?: QuoteItemRow[] | null
      }
    >
  >({
    queryKey: ['customer_quotes', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const { data, error } = (await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('customer_id', customerId as string)
        .order('issue_date', { ascending: false })) as any

      if (error) throw error
      return (data ?? []) as Array<
        QuoteRow & {
          quote_items?: QuoteItemRow[] | null
        }
      >
    },
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (account: Tables['accounts']['Insert']) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(account)
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

export function useTransactions() {
  return useTransactionsByDateRange()
}

export function useTransactionsByDateRange(params?: { from?: string; to?: string }) {
  const fromKey = params?.from ?? 'all'
  const toKey = params?.to ?? 'all'

  return useQuery<TransactionRow[]>({
    queryKey: ['transactions', fromKey, toKey],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })

      if (params?.from) {
        q = q.gte('transaction_date', params.from)
      }

      if (params?.to) {
        q = q.lte('transaction_date', params.to)
      }

      const { data, error } = await q

      if (error) throw error
      return data ?? []
    },
  })
}

export function useInvoices() {
  return useInvoicesByDateRange()
}

export function useInvoicesByDateRange(params?: { from?: string; to?: string }) {
  const fromKey = params?.from ?? 'all'
  const toKey = params?.to ?? 'all'

  return useQuery<
    Array<
      InvoiceRow & {
        customer?: CustomerRow | null
        invoice_items?: InvoiceItemRow[] | null
      }
    >
  >({
    queryKey: ['invoices', fromKey, toKey],
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('*, customer:customers(*), invoice_items(*), payments(amount)')
        .order('invoice_date', { ascending: false })

      if (params?.from) {
        q = q.gte('invoice_date', params.from)
      }

      if (params?.to) {
        q = q.lte('invoice_date', params.to)
      }

      const { data, error } = (await q) as any

      if (error) throw error
      return (data ?? []) as Array<
        InvoiceRow & {
          customer?: CustomerRow | null
          invoice_items?: InvoiceItemRow[] | null
        }
      >
    },
  })
}

export function useInvoicePayments(invoiceId?: string | null) {
  return useQuery<PaymentRow[]>({
    queryKey: ['payments', invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId as string)
        .order('payment_date', { ascending: false })

      if (error) throw error
      return (data ?? []) as PaymentRow[]
    },
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Tables['payments']['Insert']) => {
      const { data, error } = await supabase
        .from('payments')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', (variables as any)?.invoice_id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['customer_invoices'] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: string; invoice_id: string }) => {
      const { error } = await supabase.from('payments').delete().eq('id', payload.id)
      if (error) throw error
      return payload
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.invoice_id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['customer_invoices'] })
    },
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (customer: Tables['customers']['Insert']) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single()
      
      if (error) throw error

      const name = (data as any)?.name as string | undefined
      if (name) {
        await logActivity(`"${name}" isminde yeni müşteri eklendi.`)
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (transaction: Tables['transactions']['Insert']) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transaction)
        .select()
        .single()
      
      if (error) throw error

      let accountName: string | undefined
      if (transaction.bank_account) {
        const { data: account } = await supabase
          .from('accounts')
          .select('name')
          .eq('id', transaction.bank_account)
          .single()

        accountName = (account as any)?.name as string | undefined
      }
      const amount = Number(transaction.amount ?? 0)
      const category = transaction.category
      const txType = transaction.type
      const verb = txType === 'income' ? 'hesabına' : 'hesabından'
      const kindLabel = txType === 'income' ? 'gelir' : 'gider'
      await logActivity(
        `"${accountName ?? 'Hesap'}" ${verb} ${amount.toLocaleString('tr-TR')} TL ${category} ${kindLabel} işlemi eklendi.`
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] })
    },
  })
}
