import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { 
  SubscriptionPlanInsert, 
  SubscriptionPlanUpdate,
  CompanyUsageStats,
  QuotaCheckResult,
  PlanFeatures
} from '../types/subscription'
import { toast } from '../components/ui/use-toast'

// =====================================================
// SUBSCRIPTION PLANS QUERIES
// =====================================================

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      return (data ?? []).map(plan => ({
        ...plan,
        features: plan.features as unknown as PlanFeatures
      }))
    },
  })
}

export function useActiveSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return (data ?? []).map(plan => ({
        ...plan,
        features: plan.features as unknown as PlanFeatures
      }))
    },
  })
}

export function useSubscriptionPlan(planId: string | null) {
  return useQuery({
    queryKey: ['subscription-plan', planId],
    queryFn: async () => {
      if (!planId) return null
      
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (error) throw error
      if (!data) return null
      return {
        ...data,
        features: data.features as unknown as PlanFeatures
      }
    },
    enabled: !!planId,
  })
}

// =====================================================
// SUBSCRIPTION PLAN MUTATIONS
// =====================================================

export function useCreateSubscriptionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (plan: SubscriptionPlanInsert) => {
      const insertData = {
        ...plan,
        features: plan.features as unknown as Record<string, unknown>
      }
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error('Insert failed')
      return {
        ...data,
        features: data.features as unknown as PlanFeatures
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
      toast({
        title: 'Plan oluşturuldu',
        description: 'Yeni abonelik planı başarıyla oluşturuldu.',
      })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Plan oluşturulurken bir hata oluştu.'
      toast({
        title: 'Hata',
        description: message,
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: SubscriptionPlanUpdate }) => {
      const updateData: Record<string, unknown> = { ...updates }
      if (updates.features) {
        updateData.features = updates.features as unknown as Record<string, unknown>
      }
      const { data, error } = await supabase
        .from('subscription_plans')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error('Update failed')
      return {
        ...data,
        features: data.features as unknown as PlanFeatures
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-plan', variables.id] })
      toast({
        title: 'Plan güncellendi',
        description: 'Abonelik planı başarıyla güncellendi.',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Hata',
        description: error.message || 'Plan güncellenirken bir hata oluştu.',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteSubscriptionPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
      toast({
        title: 'Plan silindi',
        description: 'Abonelik planı başarıyla silindi.',
      })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Plan silinirken bir hata oluştu.'
      toast({
        title: 'Hata',
        description: message,
        variant: 'destructive',
      })
    },
  })
}

// =====================================================
// COMPANY SUBSCRIPTION QUERIES
// =====================================================

export function useCompanyUsageStats(companyId: string | null) {
  return useQuery({
    queryKey: ['company-usage-stats', companyId],
    queryFn: async () => {
      if (!companyId) return null

      const { data, error } = await supabase.rpc('get_company_usage_stats', {
        company_uuid: companyId,
      })

      if (error) throw error
      return data as unknown as CompanyUsageStats
    },
    enabled: !!companyId,
  })
}

export function useCheckCompanyQuota(companyId: string | null, resourceType: string) {
  return useQuery({
    queryKey: ['company-quota', companyId, resourceType],
    queryFn: async () => {
      if (!companyId) return null

      const { data, error } = await supabase.rpc('check_company_quota', {
        company_uuid: companyId,
        resource_type: resourceType,
      })

      if (error) throw error
      return data as unknown as QuotaCheckResult
    },
    enabled: !!companyId && !!resourceType,
  })
}

// =====================================================
// COMPANY PLAN UPDATE
// =====================================================

export function useUpdateCompanyPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      planId,
      startTrial = false 
    }: { 
      companyId: string
      planId: string | null
      startTrial?: boolean
    }) => {
      const updates: Record<string, unknown> = {
        plan_id: planId,
      }

      if (startTrial) {
        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() + 14) // 14 günlük trial
        
        updates.is_trial = true
        updates.trial_ends_at = trialEndsAt.toISOString()
        updates.subscription_status = 'trial'
      } else if (planId) {
        updates.is_trial = false
        updates.subscription_status = 'active'
        updates.subscription_started_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['company', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['company-usage-stats', variables.companyId] })
      toast({
        title: 'Plan güncellendi',
        description: 'Şirket abonelik planı başarıyla güncellendi.',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Hata',
        description: error.message || 'Plan güncellenirken bir hata oluştu.',
        variant: 'destructive',
      })
    },
  })
}

// =====================================================
// ACTIVITY LOGS
// =====================================================

export interface ActivityLog {
  id: string
  company_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  message?: string
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export function useActivityLogs(filters?: {
  companyId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId)
      }

      if (filters?.search) {
        query = query.textSearch('description', filters.search, {
          type: 'websearch',
          config: 'turkish',
        })
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      } else {
        query = query.limit(100)
      }

      const { data, error } = await query

      if (error) throw error
      return data as unknown as ActivityLog[]
    },
  })
}

export function useCreateActivityLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (log: Omit<ActivityLog, 'id' | 'created_at'>) => {
      const insertData = {
        ...log,
        user_id: log.user_id ?? '',
        message: log.message ?? log.description
      }
      const { data, error } = await supabase
        .from('activity_logs')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      return data as unknown as ActivityLog
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
    },
  })
}
