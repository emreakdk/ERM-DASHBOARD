import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Tables = Database['public']['Tables']

type AccountRow = Tables['accounts']['Row']
type CustomerRow = Tables['customers']['Row']
type TransactionRow = Tables['transactions']['Row']
type InvoiceRow = Tables['invoices']['Row']
type InvoiceItemRow = Tables['invoice_items']['Row']

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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useDeleteCustomerCascade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customerId: string) => {
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
      return customerId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice_items', id] })
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

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
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
  return useQuery<TransactionRow[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
      
      if (error) throw error
      return data ?? []
    },
  })
}

export function useInvoices() {
  return useQuery<InvoiceRow[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false })
      
      if (error) throw error
      return data ?? []
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
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
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
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
